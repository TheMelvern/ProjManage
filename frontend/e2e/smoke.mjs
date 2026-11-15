import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base='http://127.0.0.1:3000/api';
async function request(path,token,method='GET',body) {
  const response=await fetch(base+path,{method,headers:{
    'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})
  },...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  assert.ok(response.ok,method+' '+path+': '+response.status+' '+JSON.stringify(data));
  return data.data;
}
const checker=(await request('/auth/login',null,'POST',{
  email:'checker@pmo.test',password:'checker-test-password-123'
})).accessToken;
async function approve(kind,matching) {
  const rows=await request('/reviews',checker);
  const review=rows.find(r=>r.kind===kind && r.status==='PENDING' &&
    (!matching || r.summary.includes(matching)));
  assert.ok(review,'Missing pending '+kind+' '+(matching||''));
  const approved=await request('/reviews/'+review.id+'/decision',checker,'POST',{decision:'APPROVED'});
  assert.equal(approved.status,'APPROVED');
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto('http://localhost:5174/#/login',{waitUntil:'networkidle'});
  // Login uses the same design tokens and layout conventions as signup and dashboard.
  const layout=await page.locator('.auth-layout').evaluate(el=>getComputedStyle(el).display);
  assert.equal(layout,'grid','Unified PMO authentication layout CSS was not applied');
  const panel=await page.locator('.auth-form-card').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(panel,'rgb(255, 255, 255)','Unified PMO login card CSS was not applied');
  const story=await page.locator('.auth-story').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(story,'rgb(20, 34, 61)','PMO navy brand color does not match application sidebar');
  assert.equal(await page.getByText('Illustrative').isVisible(),true,'Sample dashboard preview must be labelled');
  const loginType=await page.locator('.auth-form-card h2').evaluate(el=>({
    family:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize,
    weight:Number(getComputedStyle(el).fontWeight)
  }));
  assert.ok(loginType.family.includes('Inter'),'Authentication header must use Inter');
  assert.equal(loginType.size,'30px','Authentication headings must use global display size');
  assert.ok(loginType.weight>=700);
  const loginInput=await page.locator('#login-email').evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(loginInput,'13px','Authentication input typography must match design system');

  await page.getByRole('link',{name:'Forgot password?'}).click();
  await page.getByRole('heading',{name:'Reset your password'}).waitFor();
  await page.getByRole('link',{name:'Resend verification'}).click();
  await page.getByRole('heading',{name:'Resend verification'}).waitFor();
  await page.getByRole('link',{name:'Back to sign in'}).click();
  await page.waitForURL('**/#/login');
  await page.getByRole('link',{name:'Create an account'}).click();
  await page.getByRole('heading',{name:'Create your account'}).waitFor();
  const signupSize=await page.getByRole('heading',{name:'Create your account'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(signupSize,loginType.size,'Signup and sign-in headings should have identical size');
  const signupLabel=await page.getByText('Work email address',{exact:false}).first().evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(signupLabel,'12px','Signup labels should follow shared typography');
  await page.getByRole('link',{name:'Sign in'}).click();
  await page.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await page.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await page.getByRole('button',{name:/Sign In/i}).click();
  await page.waitForURL('**/#/portfolio',{timeout:15000});
  await page.getByRole('heading',{name:'Portfolio Overview'}).waitFor();
  const headingSize=await page.getByRole('heading',{name:'Portfolio Overview'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(headingSize,'30px','Portfolio page title should follow global type scale');
  const portfolioH2=await page.getByRole('heading',{name:'Portfolio health'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(portfolioH2,'18px','Portfolio card heading should follow global section scale');
  const tableHeader=await page.locator('thead th').first().evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(tableHeader,'11px','Table headings should share type scale');

  await page.getByRole('link',{name:/Projects & Tasks/}).click();
  await page.getByRole('heading',{name:'Projects & tasks'}).waitFor();
  const projectHeading=await page.getByRole('heading',{name:'Projects & tasks'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(projectHeading,headingSize,'Operational module headings should match Portfolio');
  await page.getByText('E2E Delivery Project').first().waitFor({timeout:15000});
  await page.getByLabel('New project name').fill('Approved Browser Project');
  await page.getByRole('button',{name:'Submit project'}).click();
  await page.getByText(/Project proposal submitted/).waitFor({timeout:15000});
  await approve('PROJECT_CREATE','Approved Browser Project');
  await page.getByRole('link',{name:'Notification Center'}).first().click();
  await page.getByRole('heading',{name:'Notification Center'}).waitFor();
  await page.getByText('Request approved').first().waitFor({timeout:15000});
  await page.getByRole('button',{name:'Mark all read'}).click();
  await page.getByText('No notifications yet.').count().then(count => assert.equal(count,0));
  await page.getByRole('link',{name:/Projects & Tasks/}).click();
  await page.reload();
  await page.getByText('Approved Browser Project').first().waitFor({timeout:15000});
  await page.getByRole('button',{name:/Approved Browser Project/}).click();
  await page.getByLabel('New task').fill('Approved Browser Task');
  await page.getByRole('button',{name:'Submit task'}).click();
  await page.getByText(/Task proposal submitted/).waitFor({timeout:15000});
  await approve('TASK_CREATE','Approved Browser Task');
  await page.reload();
  await page.getByText('Approved Browser Task').waitFor({timeout:15000});

  await page.getByRole('link',{name:/RAID Register/}).click();
  await page.getByRole('heading',{name:'RAID Register'}).waitFor();
  await page.getByLabel('New risk title').fill('Approved Browser Risk');
  await page.getByRole('button',{name:'Submit item'}).click();
  await page.getByText(/RAID item submitted/).waitFor({timeout:15000});
  await approve('RISK_CREATE','Approved Browser Risk');
  await page.getByRole('button',{name:'Refresh'}).click();
  await page.getByText('Approved Browser Risk').waitFor({timeout:15000});

  await page.getByRole('link',{name:/Timesheets/}).click();
  await page.getByRole('heading',{name:'Project timesheets'}).waitFor();
  await page.getByLabel('Hours worked').fill('7.5');
  await page.getByLabel('Work completed').fill('Browser approval walkthrough');
  await page.getByRole('button',{name:'Submit for check'}).click();
  await page.getByText(/Timesheet submitted for independent approval/).waitFor({timeout:15000});
  await approve('TIMESHEET_CREATE','7.5 hours');
  await page.reload();
  await page.getByText('Browser approval walkthrough').waitFor({timeout:15000});

  await page.getByRole('link',{name:/Executive Reports/}).click();
  await page.getByRole('heading',{name:'Executive status reports'}).waitFor();
  await page.getByText('Approved Browser Project').waitFor({timeout:15000});
  await page.getByRole('button',{name:'Submit report for check'}).click();
  await page.getByText(/Publication submitted/).waitFor({timeout:15000});
  await approve('REPORT_PUBLISH');
  await page.getByRole('button',{name:'Refresh'}).click();
  await page.getByLabel('Approved executive snapshots').selectOption({index:1});
  assert.equal(await page.getByRole('button',{name:'Export approved CSV'}).isEnabled(),true);

  await page.getByRole('link',{name:/Approval Center/}).click();
  await page.getByRole('heading',{name:'Approval Center'}).waitFor();
  await page.getByText('Approved Browser Risk').first().waitFor({timeout:15000});

  await page.getByRole('link',{name:/Leave Tracker/}).click();
  await page.getByRole('heading',{name:'Leave Tracker Management'}).waitFor();
  await page.getByLabel('Leave type').selectOption('ANNUAL');
  await page.getByLabel('Start date').fill('2026-12-20');
  await page.getByLabel('End date').fill('2026-12-21');
  await page.getByLabel('Reason / handover details').fill('Browser approved leave');
  await page.getByRole('button',{name:'Submit for check'}).click();
  await page.getByText(/Request submitted for independent approval/).waitFor({timeout:15000});
  await approve('LEAVE_REQUEST','2026-12-20');
  await page.reload();
  await page.getByText('Browser approved leave').waitFor({timeout:15000});

  await page.getByRole('link',{name:/Admin Parameters/}).click();
  await page.getByRole('heading',{name:'Admin Parameters'}).waitFor();
  await page.getByLabel('Parameter').selectOption('currency');
  await page.getByLabel('Proposed value').fill('MYR');
  await page.getByLabel('Change rationale').fill('Browser report currency setting');
  await page.getByRole('button',{name:'Submit for check'}).click();
  await page.getByText(/Change request created/).waitFor({timeout:15000});
  await approve('PARAMETER_UPDATE','Browser report currency setting');
  await page.reload();
  await page.getByText('Approved configuration').first().waitFor({timeout:15000});

  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/desktop-admin.png',fullPage:true});
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/#/login',{timeout:15000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('access_token')),null);
  // Exercise responsive mobile sidebar, navigation and leave form.
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://localhost:5174/#/login',{waitUntil:'networkidle'});
  const mobileLayout=await mobile.locator('.auth-layout').evaluate(el=>getComputedStyle(el).display);
  assert.equal(mobileLayout,'block','Mobile login should use a fluid single-column layout');
  assert.equal(await mobile.locator('.auth-story').isVisible(),false,'Mobile login must hide decorative brand panel');
  await mobile.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await mobile.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await mobile.getByRole('button',{name:/Sign In/i}).click();
  await mobile.waitForURL('**/#/portfolio',{timeout:15000});
  await mobile.getByRole('button',{name:'Toggle navigation'}).click();
  await mobile.getByRole('link',{name:/Leave Tracker/}).click();
  await mobile.getByRole('heading',{name:'Leave Tracker Management'}).waitFor();
  await mobile.screenshot({path:'test-results/mobile-leave.png',fullPage:true});
  assert.ok(await mobile.getByLabel('Leave duration').isVisible());
  await mobile.close();
  assert.deepEqual(errors,[],'Browser runtime exceptions');
  console.log('Playwright PASS: signup, portfolio, project/task, RAID, timesheet, published reporting, leave, admin + checker API approvals');
} finally {await browser.close();}
