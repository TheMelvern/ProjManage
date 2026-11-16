import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import { createServer } from 'node:http';

const db = new PrismaClient();
const delivered = [];
const mailServer = createServer((req,res)=>{
  let text='';
  req.on('data',chunk=>text+=chunk);
  req.on('end',()=>{
    try { delivered.push(JSON.parse(text)); res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'local-ci-mock'})); }
    catch { res.writeHead(400);res.end(); }
  });
});
await new Promise(resolve=>mailServer.listen(39222,'127.0.0.1',resolve));
const tokenFromMail = (email,kind) => {
  const message=delivered.filter(e=>e.to?.includes(email) && e.subject?.includes(kind)).at(-1);
  assert.ok(message,'Missing email for '+email+' '+kind);
  const match=/[?&]token=([a-f0-9]{64})/.exec(message.text);
  assert.ok(match,'Missing one-time token in delivered link');
  return match[1];
};
const base = 'http://127.0.0.1:3000/api';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(method, path, token, body, expected) {
  const res = await fetch(base + path, {
    method, headers: { ...jsonHeaders, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let result;
  try { result = await res.json(); } catch { result = null; }
  if (expected !== undefined) {
    assert.equal(res.status, expected, method + ' ' + path + ' expected ' + expected +
      ' but got ' + res.status + ': ' + JSON.stringify(result));
  }
  return { status: res.status, data: result?.data, body: result };
}
async function login(email, password) {
  const resp = await request('POST','/auth/login',null,{ email,password },201);
  assert.ok(resp.data?.accessToken);
  return resp.data.accessToken;
}
async function proposal(token, kind, projectId, values, summary, targetId) {
  return (await request('POST','/reviews/operations',token,{
    kind, projectId, values, summary, ...(targetId ? { targetId } : {})
  },201)).data;
}
async function approve(token, id) {
  return (await request('POST','/reviews/' + id + '/decision',token,{ decision:'APPROVED' },201)).data;
}
let ready = false;
for (let i=0;i<35;i++) {
  try { if ((await fetch(base+'/health')).ok) { ready=true; break; } } catch {}
  await delay(1000);
}
assert.ok(ready, 'API did not start');
try {
  await request('GET','/projects',null,undefined,401);
  // Signup must be mounted: invalid payload is 400, never an endpoint 404.
  await request('POST','/auth/register',null,{},400);
  const maker=await login('admin@pmo.test','local-test-password-12345');
  const organization=await db.organization.findFirst({where:{name:'PMO Development'}});
  assert.ok(organization);
  const suffix=String(Date.now());
  const memberUser=await db.user.create({data:{
    email:'member-'+suffix+'@pmo.test',name:'Team Member',
    emailVerifiedAt:new Date(),
    passwordHash:await bcryptjs.hash('member-password-123456',12)
  }});
  await db.membership.create({data:{userId:memberUser.id,organizationId:organization.id,role:'MEMBER'}});
  const member=await login(memberUser.email,'member-password-123456');
  const checkerUser=await db.user.create({data:{
    email:'checker-'+suffix+'@pmo.test',name:'Independent Reviewer',
    emailVerifiedAt:new Date(),
    passwordHash:await bcryptjs.hash('checker-password-12345',12)
  }});
  await db.membership.create({data:{userId:checkerUser.id,organizationId:organization.id,role:'ADMIN'}});
  const checker=await login(checkerUser.email,'checker-password-12345');
  const outsiderOrg=await db.organization.create({data:{name:'Other tenant '+suffix}});
  const outsiderUser=await db.user.create({data:{
    email:'outsider-'+suffix+'@pmo.test',name:'External User',
    emailVerifiedAt:new Date(),
    passwordHash:await bcryptjs.hash('outsider-password-1234',12)
  }});
  await db.membership.create({data:{userId:outsiderUser.id,organizationId:outsiderOrg.id,role:'MEMBER'}});
  const outsider=await login(outsiderUser.email,'outsider-password-1234');

  // Profile API limits modifications to the current authenticated identity.
  await request('GET', '/profile', null, undefined, 401);
  const account = (await request('GET', '/profile', member, undefined, 200)).data;
  assert.equal(account.id, memberUser.id);
  assert.equal(account.email, memberUser.email);
  assert.equal(account.organization, organization.name);
  assert.equal(account.passwordHash, undefined);
  await request('PATCH', '/profile', member, {name:' '}, 400);
  const renamed = (await request('PATCH', '/profile', member, {name:'Updated Team Member'}, 200)).data;
  assert.equal(renamed.name, 'Updated Team Member');
  assert.equal((await request('GET','/profile',member,undefined,200)).data.name, 'Updated Team Member');
  assert.equal((await request('GET','/profile',outsider,undefined,200)).data.id, outsiderUser.id);
  await request('PATCH', '/profile', member, {name:'Team Member'}, 200);

  // Notification endpoints reject anonymous and tenant-crossing access.
  await request('GET','/notifications',null,undefined,401);
  const emptyInbox=(await request('GET','/notifications',member,undefined,200)).data;
  assert.equal(emptyInbox.unread,0);
  // Account registration remains pending until second administrator approval.
  const registrant='new-'+suffix+'@pmo.test';
  const signup=await request('POST','/auth/register',null,{
    name:'New Colleague',email:registrant,password:'new-user-password-1234',
    organization:'PMO Development'
  },201);
  assert.equal(signup.data.status,'PENDING');
  await request('POST','/auth/login',null,{email:registrant,password:'new-user-password-1234'},401);
  // The approval API applies category filtering server-side, preserving tenant and role guards.
  await request('GET','/reviews?module=unknown',maker,undefined,400);
  const adminQueue=(await request('GET','/reviews?module=admin',maker,undefined,200)).data;
  assert.ok(adminQueue.some(r=>r.id===signup.data.id));
  assert.ok(adminQueue.every(r=>['REGISTRATION','PARAMETER_UPDATE','MEMBERSHIP_UPDATE'].includes(r.kind)));
  const projectQueue=(await request('GET','/reviews?module=projects',maker,undefined,200)).data;
  assert.ok(projectQueue.every(r=>['PROJECT_CREATE','PROJECT_UPDATE','TASK_CREATE','TASK_UPDATE'].includes(r.kind)));
  const memberAdminQueue=(await request('GET','/reviews?module=admin',member,undefined,200)).data;
  assert.equal(memberAdminQueue.length,0);
  const queue=await request('GET','/reviews',maker,undefined,200);
  assert.ok(queue.data.some(r=>r.id===signup.data.id));
  const visible=queue.data.find(r=>r.id===signup.data.id);
  assert.equal(visible.proposed,undefined,'Password must never appear in API review payload');
  await approve(checker,signup.data.id);
  await request('POST','/auth/login',null,{email:registrant,password:'new-user-password-1234'},403);
  const firstLink=tokenFromMail(registrant,'Verify');
  await request('POST','/auth/resend-verification',null,{email:registrant},201);
  const verificationToken=tokenFromMail(registrant,'Verify');
  assert.notEqual(firstLink,verificationToken);
  await request('POST','/auth/verify-email',null,{token:firstLink},400);
  await request('POST','/auth/verify-email',null,{token:verificationToken},201);
  await request('POST','/auth/verify-email',null,{token:verificationToken},400);
  const registrantSession=await login(registrant,'new-user-password-1234');

  // Project creation cannot be performed directly or by a MEMBER.
  await request('POST','/projects',maker,{name:'Bypass project'},403);
  await request('POST','/reviews/operations',member,{
    kind:'PROJECT_CREATE',values:{name:'Unauthorized'},summary:'Unauthorized project'
  },403);
  const projectProposal=await proposal(maker,'PROJECT_CREATE',undefined,{
    name:'Approved Project '+suffix,client:'Example customer'
  },'Create approved integration project');
  await request('POST','/reviews/'+projectProposal.id+'/decision',maker,{decision:'APPROVED'},403);
  const preProjects=(await request('GET','/projects',maker,undefined,200)).data;
  assert.ok(!preProjects.some(x=>x.name==='Approved Project '+suffix));
  // Maker receives outcome only after independent checker action.
  const checkerBefore=(await request('GET','/notifications',checker,undefined,200)).data;
  assert.ok(checkerBefore.items.some(n=>n.kind==='REVIEW_PENDING'));
  await approve(checker,projectProposal.id);
  const makerInbox=(await request('GET','/notifications',maker,undefined,200)).data;
  const decisionNotice=makerInbox.items.find(n=>n.kind==='REVIEW_DECISION' && n.body.includes('Create approved integration project'));
  assert.ok(decisionNotice,'Maker must receive an approved-decision notification');
  assert.equal(decisionNotice.link,'/projects/approvals');
  const outsiderInbox=(await request('GET','/notifications',outsider,undefined,200)).data;
  assert.ok(!outsiderInbox.items.some(n=>n.id===decisionNotice.id));
  const otherMemberInbox=(await request('GET','/notifications',member,undefined,200)).data;
  assert.ok(!otherMemberInbox.items.some(n=>n.id===decisionNotice.id));
  const unauthorizedRead=await request('PATCH','/notifications/'+decisionNotice.id+'/read',outsider,{},200);
  assert.equal(unauthorizedRead.data.updated,0);
  const notified=(await request('GET','/notifications',maker,undefined,200)).data;
  assert.ok(notified.items.some(n=>n.id===decisionNotice.id && !n.readAt));
  const marked=await request('PATCH','/notifications/'+decisionNotice.id+'/read',maker,{},200);
  assert.equal(marked.data.updated,1);
  assert.equal((await request('PATCH','/notifications/'+decisionNotice.id+'/read',maker,{},200)).data.updated,0);
  const projects=(await request('GET','/projects',maker,undefined,200)).data;
  const project=projects.find(x=>x.name==='Approved Project '+suffix);
  assert.ok(project,'Project not effective after approval');
  await request('GET','/projects/'+project.id,outsider,undefined,404);
  await request('POST','/projects/'+project.id+'/tasks',maker,{title:'Bypass task'},403);

  // Project status and health changes are approved independently.
  await request('PATCH','/projects/'+project.id,maker,{status:'ACTIVE'},403);
  const statusReview=(await request('POST','/reviews/projects',maker,{
    projectId:project.id,status:'ACTIVE',health:'GREEN',summary:'Ready for delivery'
  },201)).data;
  assert.equal((await request('GET','/projects/'+project.id,maker,undefined,200)).data.status,'PLANNING');
  await approve(checker,statusReview.id);
  assert.equal((await request('GET','/projects/'+project.id,maker,undefined,200)).data.status,'ACTIVE');

  // Task lifecycle, versioned updates and progress.
  const t=await proposal(maker,'TASK_CREATE',project.id,{title:'Create migration plan'},'Create approved task');
  await approve(checker,t.id);
  const tasks=(await request('GET','/projects/'+project.id+'/tasks',maker,undefined,200)).data;
  const task=tasks.find(x=>x.title==='Create migration plan');
  assert.ok(task);
  await request('PATCH','/projects/'+project.id+'/tasks/'+task.id,maker,{status:'DONE'},403);
  const taskUpdate=await proposal(maker,'TASK_UPDATE',project.id,{status:'DONE'},'Complete delivery task',task.id);
  await approve(checker,taskUpdate.id);
  const updatedTasks=(await request('GET','/projects/'+project.id+'/tasks',maker,undefined,200)).data;
  assert.equal(updatedTasks.find(x=>x.id===task.id).status,'DONE');

  // RAID risks, issues, decisions and actions cannot bypass checker.
  for (const path of ['risks','issues','decisions','actions']) {
    await request('POST','/projects/'+project.id+'/raid/'+path,maker,{title:'Bypass'},403);
  }
  const raidTypes=[
    ['RISK_CREATE',{title:'Supplier delay',severity:'HIGH'},'risks'],
    ['ISSUE_CREATE',{title:'Integration test blocked',severity:'MEDIUM'},'issues'],
    ['DECISION_CREATE',{title:'Adopt phased rollout'},'decisions'],
    ['ACTION_CREATE',{title:'Confirm vendor readiness'},'actions']
  ];
  for(const [kind,values] of raidTypes){
    const item=await proposal(maker,kind,project.id,values,'Add approved '+kind.toLowerCase());
    await approve(checker,item.id);
  }
  let raid=(await request('GET','/projects/'+project.id+'/raid',maker,undefined,200)).data;
  assert.equal(raid.risks.length,1);
  assert.equal(raid.issues.length,1);
  assert.equal(raid.decisions.length,1);
  assert.equal(raid.actions.length,1);
  const riskUpdate=await proposal(maker,'RISK_UPDATE',project.id,{
    status:'IN_PROGRESS',mitigation:'Weekly vendor sync'
  },'Mitigate supplier delay',raid.risks[0].id);
  await approve(checker,riskUpdate.id);
  raid=(await request('GET','/projects/'+project.id+'/raid',maker,undefined,200)).data;
  assert.equal(raid.risks[0].status,'IN_PROGRESS');

  // Timesheet entry by staff is invisible until approved by an independent checker.
  await request('POST','/projects/'+project.id+'/timesheets',member,{
    workDate:'2026-10-15T00:00:00.000Z',hours:7.5
  },403);
  const time=await proposal(member,'TIMESHEET_CREATE',project.id,{
    workDate:'2026-10-15T00:00:00.000Z',hours:7.5,
    description:'Task planning'
  },'Submit 7.5 hours of project effort');
  await request('POST','/reviews/'+time.id+'/decision',member,{decision:'APPROVED'},403);
  await approve(checker,time.id);
  const logged=(await request('GET','/projects/'+project.id+'/timesheets',member,undefined,200)).data;
  assert.ok(logged.some(e=>Number(e.hours)===7.5));

  // Executive report publication captures a snapshot and requires a PMO checker.
  const live=(await request('GET','/reports/portfolio',maker,undefined,200)).data;
  assert.equal(live.projects.find(p=>p.id===project.id).progressPercent,100);
  const publication=await proposal(maker,'REPORT_PUBLISH',undefined,{},'Portfolio snapshot '+suffix);
  await approve(checker,publication.id);
  const published=(await request('GET','/reports/published',maker,undefined,200)).data;
  assert.ok(published.find(p=>p.id===publication.id)?.snapshot?.projects.some(p=>p.id===project.id));

  // Leave entitlement balances and team availability.
  const y=new Date().getUTCFullYear();
  const start=y+'-12-14',end=y+'-12-15';
  const beforeBalance=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.ok(beforeBalance.remaining.ANNUAL>=2);
  const leave=(await request('POST','/leave',member,{
    type:'ANNUAL',startDate:start,endDate:end,reason:'Planned absence'
  },201)).data;
  await request('POST','/leave',member,{
    type:'ANNUAL',startDate:start,endDate:end,reason:'Duplicate absence'
  },400);
  const pendingBal=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.equal(pendingBal.used.ANNUAL,beforeBalance.used.ANNUAL);
  await approve(checker,leave.id);
  const afterBal=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.equal(afterBal.used.ANNUAL,beforeBalance.used.ANNUAL+2);
  await request('GET','/leave/team',member,undefined,403);
  const team=(await request('GET','/leave/team',checker,undefined,200)).data;
  assert.ok(team.some(x=>x.id===leave.id));
  // Complementary AM/PM leave can be approved on the same workday.
  const morning=(await request('POST','/leave',member,{
    type:'ANNUAL',startDate:y+'-12-16',endDate:y+'-12-16',
    dayType:'AM',reason:'Medical appointment AM'
  },201)).data;
  const afternoon=(await request('POST','/leave',member,{
    type:'ANNUAL',startDate:y+'-12-16',endDate:y+'-12-16',
    dayType:'PM',reason:'Personal appointment PM'
  },201)).data;
  await approve(checker,morning.id);
  await approve(checker,afternoon.id);
  const halfBal=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.equal(halfBal.used.ANNUAL,beforeBalance.used.ANNUAL+3);

  // Cancellation is maker-only, only before approval, and must not spend leave balance.
  const cancelling = (await request('POST','/leave',member,{
    type:'ANNUAL',startDate:y+'-12-17',endDate:y+'-12-17',
    reason:'Cancelled annual leave request'
  },201)).data;
  await request('POST','/leave/'+cancelling.id+'/cancel',outsider,{},404);
  const beforeCancel=(await request('GET','/leave/balances',member,undefined,200)).data.used.ANNUAL;
  const cancelled=await request('POST','/leave/'+cancelling.id+'/cancel',member,{},201);
  assert.equal(cancelled.data.status,'CANCELLED');
  await request('POST','/leave/'+cancelling.id+'/cancel',member,{},409);
  await request('POST','/reviews/'+cancelling.id+'/decision',checker,{decision:'APPROVED'},409);
  assert.equal((await request('GET','/leave/balances',member,undefined,200)).data.used.ANNUAL,beforeCancel);
  assert.ok((await request('GET','/leave/mine',member,undefined,200)).data.some(r=>r.id===cancelling.id&&r.status==='CANCELLED'));

  // Governed admin parameters, user roles, audited decisions.
  await request('GET','/admin/parameters',member,undefined,403);
  const param=(await request('POST','/admin/parameters/proposals',maker,{
    key:'currency',value:'MYR',summary:'Set report currency'
  },201)).data;
  await approve(checker,param.id);
  const parameters=(await request('GET','/admin/parameters',maker,undefined,200)).data;
  assert.equal(parameters.find(x=>x.key==='currency').value,'MYR');
  // Approved holiday policy changes leave-day counting consistently at application and review time.
  const holidayDate=y+'-12-18';
  const holidayReview=(await request('POST','/admin/parameters/proposals',maker,{
    key:'leavePublicHolidays',value:holidayDate,summary:'Configure company public holiday'
  },201)).data;
  await approve(checker,holidayReview.id);
  const balanceWithHoliday=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.ok(balanceWithHoliday.holidays.includes(holidayDate));
  await request('POST','/leave',member,{
    type:'ANNUAL',startDate:holidayDate,endDate:holidayDate,reason:'Holiday must not be booked'
  },400);
  const holidaySpanning=(await request('POST','/leave',member,{
    type:'ANNUAL',startDate:holidayDate,endDate:y+'-12-21',reason:'One eligible weekday only'
  },201)).data;
  await approve(checker,holidaySpanning.id);
  const afterHolidayLeave=(await request('GET','/leave/balances',member,undefined,200)).data;
  assert.equal(afterHolidayLeave.used.ANNUAL,balanceWithHoliday.used.ANNUAL+1);
  const users=(await request('GET','/admin/users',maker,undefined,200)).data;
  const target=users.find(x=>x.userId===memberUser.id);
  assert.ok(target);
  const membership=(await request('POST','/admin/users/proposals',maker,{
    membershipId:target.membershipId,role:'PROJECT_MANAGER',reason:'Authorize delivery management'
  },201)).data;
  await approve(checker,membership.id);
  const changed=(await request('GET','/admin/users',maker,undefined,200)).data;
  assert.equal(changed.find(x=>x.userId===memberUser.id).role,'PROJECT_MANAGER');
  const audit=(await request('GET','/admin/audit',maker,undefined,200)).data;
  assert.ok(audit.some(e=>e.entityId===membership.id));
  await request('GET','/admin/audit',outsider,undefined,403);
  await request('POST','/reviews/'+membership.id+'/decision',checker,{decision:'APPROVED'},409);
  // Role changes revoke the old JWT and require a new login.
  await request('GET','/projects',member,undefined,401);
  const refreshedMember=await login(memberUser.email,'member-password-123456');
  await request('GET','/projects',refreshedMember,undefined,200);
  await db.membership.delete({where:{organizationId_userId:{
    organizationId:organization.id,userId:memberUser.id
  }}});
  await request('GET','/projects',refreshedMember,undefined,401);
  assert.equal((await request('GET','/projects',outsider,undefined,200)).data.length,0);
  const checkAll=await request('PATCH','/notifications/read-all',checker,{},200);
  assert.ok(checkAll.data.updated>=1);
  const afterAll=(await request('GET','/notifications',checker,undefined,200)).data;
  assert.equal(afterAll.unread,0);
  await request('POST','/auth/request-password-reset',null,{email:'does-not-exist-'+suffix+'@pmo.test'},201);
  const beforeUnknown=delivered.length;
  await request('POST','/auth/request-password-reset',null,{email:'absent-'+suffix+'@pmo.test'},201);
  assert.equal(delivered.length,beforeUnknown);
  await request('POST','/auth/request-password-reset',null,{email:registrant},201);
  const expiredToken=tokenFromMail(registrant,'Reset');
  const { createHash } = await import('node:crypto');
  await db.emailToken.update({
    where: { tokenHash: createHash('sha256').update(expiredToken).digest('hex') },
    data: { expiresAt: new Date(Date.now()-1000) }
  });
  await request('POST','/auth/reset-password',null,{token:expiredToken,password:'rejected-expired-password'},400);
  await request('POST','/auth/request-password-reset',null,{email:registrant},201);
  const resetToken=tokenFromMail(registrant,'Reset');
  await request('POST','/auth/verify-email',null,{token:resetToken},400);
  await request('POST','/auth/reset-password',null,{token:resetToken,password:'updated-password-123456'},201);
  await request('GET','/projects',registrantSession,undefined,401);
  await request('POST','/auth/reset-password',null,{token:resetToken,password:'another-password-123456'},400);
  await request('POST','/auth/login',null,{email:registrant,password:'new-user-password-1234'},401);
  await login(registrant,'updated-password-123456');
  const freshLogin=await login(checkerUser.email,'checker-password-12345');
  await request('POST','/auth/logout',freshLogin,{},201);
  await request('GET','/projects',freshLogin,undefined,401);
  const lockedUser=await db.user.create({data:{
    email:'locked-'+suffix+'@pmo.test',name:'Login Protection Test',
    emailVerifiedAt:new Date(),
    passwordHash:await bcryptjs.hash('correct-password-1234',12)
  }});
  await db.membership.create({data:{organizationId:organization.id,userId:lockedUser.id,role:'MEMBER'}});
  for(let i=0;i<5;i++)await request('POST','/auth/login',null,{
    email:lockedUser.email,password:'invalid-password-1234'
  },401);
  await request('POST','/auth/login',null,{
    email:lockedUser.email,password:'correct-password-1234'
  },429);
  // Password changes require current-password proof and invalidate prior JWTs.
  await request('POST','/profile/change-password',outsider,{
    currentPassword:'not-correct',newPassword:'changed-password-123456'
  },401);
  await request('POST','/profile/change-password',outsider,{
    currentPassword:'outsider-password-1234',newPassword:'changed-password-123456'
  },201);
  await request('GET','/profile',outsider,undefined,401);
  await request('POST','/auth/login',null,{
    email:outsiderUser.email,password:'outsider-password-1234'
  },401);
  const updatedOutsider=await login(outsiderUser.email,'changed-password-123456');
  assert.equal((await request('GET','/profile',updatedOutsider,undefined,200)).data.id,outsiderUser.id);
  const approvalGroups={
    projects:['PROJECT_CREATE','PROJECT_UPDATE','TASK_CREATE','TASK_UPDATE'],
    raid:['RISK_CREATE','RISK_UPDATE','ISSUE_CREATE','ISSUE_UPDATE','DECISION_CREATE','ACTION_CREATE','ACTION_UPDATE'],
    timesheets:['TIMESHEET_CREATE'],leave:['LEAVE_REQUEST'],
    reports:['REPORT_PUBLISH'],admin:['REGISTRATION','PARAMETER_UPDATE','MEMBERSHIP_UPDATE']
  };
  for (const [module,kinds] of Object.entries(approvalGroups)) {
    const items=(await request('GET','/reviews?module='+module,maker,undefined,200)).data;
    assert.ok(items.every(item=>kinds.includes(item.kind)),'Wrong category in '+module+' approvals');
  }
  const managerAdmin=(await request('GET','/reviews?module=admin',checker,undefined,200)).data;
  assert.ok(managerAdmin.every(item=>approvalGroups.admin.includes(item.kind)));
  console.log('PASS: tenant isolation, registration, projects/tasks, RAID, timesheets, reports, leave, parameters, users, role approvals, audit, JWT revocation');
} finally { await db.$disconnect(); await new Promise(resolve=>mailServer.close(resolve)); }
