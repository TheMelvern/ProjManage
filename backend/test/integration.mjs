import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const db = new PrismaClient();
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
  const maker=await login('admin@pmo.test','local-test-password-12345');
  const organization=await db.organization.findFirst({where:{name:'PMO Development'}});
  assert.ok(organization);
  const suffix=String(Date.now());
  const memberUser=await db.user.create({data:{
    email:'member-'+suffix+'@pmo.test',name:'Team Member',
    passwordHash:await bcryptjs.hash('member-password-123456',12)
  }});
  await db.membership.create({data:{userId:memberUser.id,organizationId:organization.id,role:'MEMBER'}});
  const member=await login(memberUser.email,'member-password-123456');
  const checkerUser=await db.user.create({data:{
    email:'checker-'+suffix+'@pmo.test',name:'Independent Reviewer',
    passwordHash:await bcryptjs.hash('checker-password-12345',12)
  }});
  await db.membership.create({data:{userId:checkerUser.id,organizationId:organization.id,role:'ADMIN'}});
  const checker=await login(checkerUser.email,'checker-password-12345');
  const outsiderOrg=await db.organization.create({data:{name:'Other tenant '+suffix}});
  const outsiderUser=await db.user.create({data:{
    email:'outsider-'+suffix+'@pmo.test',name:'External User',
    passwordHash:await bcryptjs.hash('outsider-password-1234',12)
  }});
  await db.membership.create({data:{userId:outsiderUser.id,organizationId:outsiderOrg.id,role:'MEMBER'}});
  const outsider=await login(outsiderUser.email,'outsider-password-1234');

  // Account registration remains pending until second administrator approval.
  const registrant='new-'+suffix+'@pmo.test';
  const signup=await request('POST','/auth/register',null,{
    name:'New Colleague',email:registrant,password:'new-user-password-1234',
    organization:'PMO Development'
  },201);
  assert.equal(signup.data.status,'PENDING');
  await request('POST','/auth/login',null,{email:registrant,password:'new-user-password-1234'},401);
  const queue=await request('GET','/reviews',maker,undefined,200);
  assert.ok(queue.data.some(r=>r.id===signup.data.id));
  const visible=queue.data.find(r=>r.id===signup.data.id);
  assert.equal(visible.proposed,undefined,'Password must never appear in API review payload');
  await approve(checker,signup.data.id);
  await login(registrant,'new-user-password-1234');

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
  await approve(checker,projectProposal.id);
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

  // Governed admin parameters, user roles, audited decisions.
  await request('GET','/admin/parameters',member,undefined,403);
  const param=(await request('POST','/admin/parameters/proposals',maker,{
    key:'currency',value:'MYR',summary:'Set report currency'
  },201)).data;
  await approve(checker,param.id);
  const parameters=(await request('GET','/admin/parameters',maker,undefined,200)).data;
  assert.equal(parameters.find(x=>x.key==='currency').value,'MYR');
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
  const freshLogin=await login(checkerUser.email,'checker-password-12345');
  await request('POST','/auth/logout',freshLogin,{},201);
  await request('GET','/projects',freshLogin,undefined,401);
  const lockedUser=await db.user.create({data:{
    email:'locked-'+suffix+'@pmo.test',name:'Login Protection Test',
    passwordHash:await bcryptjs.hash('correct-password-1234',12)
  }});
  await db.membership.create({data:{organizationId:organization.id,userId:lockedUser.id,role:'MEMBER'}});
  for(let i=0;i<5;i++)await request('POST','/auth/login',null,{
    email:lockedUser.email,password:'invalid-password-1234'
  },401);
  await request('POST','/auth/login',null,{
    email:lockedUser.email,password:'correct-password-1234'
  },429);
  console.log('PASS: tenant isolation, registration, projects/tasks, RAID, timesheets, reports, leave, parameters, users, role approvals, audit, JWT revocation');
} finally { await db.$disconnect(); }
