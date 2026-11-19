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
  assert.ok(panel.startsWith('rgba(255, 255, 255') || panel==='rgb(255, 255, 255)','Frosted sign-in card background was not applied');
  assert.equal(await page.locator('.auth-story').isVisible(),true,'Premium sign-in should include the portfolio story panel');
  const centered=await page.locator('.auth-layout').evaluate(el=>el.getBoundingClientRect());
  assert.ok(centered.width>900,'Premium sign-in should use a spacious two-column layout');
  const loginType=await page.locator('#login-heading').evaluate(el=>({
    family:getComputedStyle(el).fontFamily,size:getComputedStyle(el).fontSize,
    weight:Number(getComputedStyle(el).fontWeight)
  }));
  assert.ok(loginType.family.includes('Inter'),'Authentication header must use Figma Inter typography');
  assert.equal(loginType.size,'32px','Authentication headings must use current display scale');
  assert.ok(loginType.weight>=400,'Authentication heading must remain legible');
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
  assert.ok(Number.parseFloat(signupSize)>=24 && Number.parseFloat(signupSize)<=38,'Signup heading must use accessible display typography');
  const signupLabel=await page.getByText('Work email address',{exact:false}).first().evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(signupLabel,'12px','Signup labels should follow shared typography');
  await page.getByRole('link',{name:'Sign in'}).click();
  await page.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await page.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await page.getByRole('button',{name:/Sign In/i}).click();
  await page.waitForURL('**/#/portfolio',{timeout:15000});
  await page.getByRole('heading',{name:'Portfolio Overview'}).waitFor();
  // Profile badge opens management, and sidebar navigation scrolls independently.
  const sidebar = page.getByRole('complementary',{name:'Primary navigation'});
  const nav = sidebar.getByRole('navigation',{name:'PMO modules'});
  const navOverflow = await nav.evaluate(el=>getComputedStyle(el).overflowY);
  assert.equal(navOverflow,'auto','Sidebar navigation must scroll within the fixed sidebar');
  const sidebarHeight = await sidebar.evaluate(el=>Math.round(el.getBoundingClientRect().height));
  assert.equal(sidebarHeight,900,'Desktop sidebar must span the viewport height');
  assert.ok(await sidebar.getByRole('button',{name:'Sign out'}).isVisible());
  assert.equal(await page.getByRole('link',{name:'Connected workflows'}).count(),0);
  await page.getByRole('button',{name:/Manage profile for/}).click();
  const profileDialog = page.getByRole('dialog',{name:'Profile management'});
  await profileDialog.waitFor();
  await profileDialog.getByText('Department').waitFor();
  await profileDialog.getByLabel(/Upload profile picture/).waitFor();
  await profileDialog.getByLabel('Full name').fill('PMO Browser Administrator');
  await profileDialog.getByRole('button',{name:'Save changes'}).click();
  await profileDialog.getByText('Profile updated successfully.').waitFor();
  await page.getByRole('button',{name:/Manage profile for PMO Browser Administrator/}).waitFor();
  await profileDialog.getByLabel('Full name').fill('PMO Administrator');
  await profileDialog.getByRole('button',{name:'Save changes'}).click();
  await profileDialog.getByText('Profile updated successfully.').waitFor();
  await profileDialog.getByRole('button',{name:'Appearance',exact:true}).click();
  await profileDialog.getByRole('button',{name:'Dark'}).click();
  await profileDialog.getByRole('button',{name:'Purple'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.locator('html').getAttribute('data-accent'),'purple');
  await profileDialog.getByRole('button',{name:'Save appearance'}).click();
  await profileDialog.getByText('Appearance preferences saved.').waitFor();
  assert.deepEqual(await request('/profile',await page.evaluate(()=>localStorage.getItem('access_token'))).then(p=>[p.themeMode,p.accentColor]),['dark','purple']);
  await profileDialog.getByRole('button',{name:'Close profile management'}).click();
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Theme must persist on reload');
  assert.equal(await page.locator('html').getAttribute('data-accent'),'purple','Accent must persist on reload');
  const accentBackground=await page.locator('.app-sidebar .brand-symbol').evaluate(el=>getComputedStyle(el).backgroundColor);
  await sidebar.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/#/login',{timeout:15000});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Dark appearance must carry over to sign-in');
  assert.equal(await page.locator('html').getAttribute('data-accent'),'purple','Accent appearance must carry over to sign-in');
  assert.equal(await page.locator('.auth-primary').evaluate(el=>getComputedStyle(el).backgroundColor),accentBackground,'Sign-in primary button must use the same accent');
  await page.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await page.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await page.getByRole('button',{name:/Sign In/i}).click();
  await page.waitForURL('**/#/portfolio',{timeout:15000});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','Theme must restore after signing back in');
  await page.getByRole('button',{name:/Manage profile for/}).click();
  const preferencesDialog=page.getByRole('dialog',{name:'Profile management'});
  await preferencesDialog.getByRole('button',{name:'Appearance',exact:true}).click();
  await preferencesDialog.getByRole('button',{name:'Light'}).click();
  await preferencesDialog.getByRole('button',{name:'Blue'}).click();
  await preferencesDialog.getByRole('button',{name:'Save appearance'}).click();
  await preferencesDialog.getByRole('button',{name:'Close profile management'}).click();
  assert.equal(await page.getByRole('dialog',{name:'Profile management'}).count(),0);

  // Shared shell: signout belongs in sidebar; profile and notifications stay in topbar.
  const topbar=page.locator('.app-topbar');
  assert.equal(await sidebar.getByRole('button',{name:'Sign out'}).count(),1);
  assert.equal(await topbar.getByRole('button',{name:'Sign out'}).count(),0);
  assert.equal(await topbar.locator('.profile-badge').count(),1);
  assert.equal(await topbar.locator('.user-label, .profile-role').count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Notification Center'}).count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Connected Workflows'}).count(),0);
  assert.equal(await topbar.getByRole('button',{name:'Recent notifications'}).count(),1);

  const headingSize=await page.getByRole('heading',{name:'Portfolio Overview'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.ok(Number.parseFloat(headingSize)>=28 && Number.parseFloat(headingSize)<=36,'Portfolio page title must follow display hierarchy');
  const portfolioH2=await page.getByRole('heading',{name:'Portfolio health'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.ok(Number.parseFloat(portfolioH2)>=18 && Number.parseFloat(portfolioH2)<=24,'Portfolio section headings must remain readable');
  const tableHeader=await page.locator('thead th').first().evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(tableHeader,'11px','Table headings should share type scale');

  await page.getByRole('link',{name:/Projects & Tasks/}).click();
  await page.getByRole('heading',{name:'Projects & tasks'}).waitFor();
  const projectHeading=await page.getByRole('heading',{name:'Projects & tasks'}).evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(projectHeading,headingSize,'Operational module headings should match Portfolio');
  await page.getByText('E2E Delivery Project').first().waitFor({timeout:15000});
  await page.getByRole('link',{name:/Create project/}).click();
  await page.getByRole('heading',{name:'Create a project'}).waitFor();
  await page.getByLabel('Project name (required)').fill('Approved Browser Project');
  await page.getByRole('radio',{name:/Waterfall/}).check();
  await page.getByRole('button',{name:'Submit project for approval'}).click();
  await page.getByRole('heading',{name:'Project submitted for approval'}).waitFor({timeout:15000});
  await approve('PROJECT_CREATE','Approved Browser Project');
  await page.getByRole('button',{name:'Recent notifications'}).click();
  await page.getByRole('dialog',{name:'Recent notifications'}).waitFor();
  await page.getByRole('link',{name:/View details · Notification Center/}).click();
  await page.getByRole('heading',{name:'Notification Center'}).waitFor();
  await page.getByText('Request approved').first().waitFor({timeout:15000});
  await page.getByRole('button',{name:'Mark all read'}).click();
  await page.getByText('No notifications yet.').count().then(count => assert.equal(count,0));
  await page.getByRole('link',{name:/Projects & Tasks/}).click();
  await page.reload();
  await page.getByText('Approved Browser Project').first().waitFor({timeout:15000});
  await page.locator('.project-record-link').filter({hasText:'Approved Browser Project'}).click();
  await page.getByRole('heading',{name:'Approved Browser Project'}).waitFor();
  await page.getByRole('button',{name:'Waterfall'}).click();
  await page.getByRole('button',{name:'+ New work item'}).click();
  await page.getByRole('combobox',{name:'Work item type'}).click();
  await page.getByRole('listbox',{name:'Work item type'}).getByRole('option',{name:'STORY'}).click();
  await page.getByPlaceholder('As a user, I want…').fill('Approved Browser Story');
  await page.getByRole('button',{name:'Submit work item for approval'}).click();
  await page.getByText(/Work item submitted for independent approval/).waitFor({timeout:15000});
  await approve('TASK_CREATE','Approved Browser Story');
  await page.reload();
  await page.getByRole('button',{name:'Backlog'}).click();
  await page.getByText('Approved Browser Story').waitFor({timeout:15000});
  await page.getByRole('button',{name:'Kanban'}).click();
  await page.getByText('Approved Browser Story').waitFor({timeout:15000});
  await page.getByRole('button',{name:'Approved Browser Story',exact:true}).click();
  const workDialog=page.getByRole('dialog',{name:'Approved Browser Story'});
  await workDialog.getByLabel('Detail priority').click();
  await workDialog.getByRole('option',{name:'HIGH'}).click();
  await workDialog.getByRole('button',{name:'Submit changes for approval'}).click();
  await workDialog.getByText('Changes submitted for independent approval.').waitFor();
  await approve('TASK_UPDATE','Approved Browser Story');
  await workDialog.getByRole('button',{name:'Cancel'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Kanban'}).click();
  const storyCard=page.locator('.board-card').filter({hasText:'Approved Browser Story'});
  await storyCard.getByText('HIGH').waitFor();
  await storyCard.dragTo(page.locator('.board-column').filter({has:page.locator('.column-head', {hasText:'In progress'})}));
  await page.getByText('Status update submitted for independent approval.').waitFor();
  await approve('TASK_UPDATE','Approved Browser Story');
  await page.reload();
  await page.getByRole('button',{name:'Kanban'}).click();
  await page.locator('.board-column').filter({has:page.locator('.column-head',{hasText:'In progress'})}).getByText('Approved Browser Story').waitFor();
  await page.getByRole('button',{name:'Timeline'}).click();
  await page.getByRole('combobox',{name:'Timeline scale'}).click();
  await page.getByRole('option',{name:'Quarter'}).click();
  await page.getByRole('button',{name:'Project info'}).click();
  await page.getByRole('button',{name:'Timesheets'}).click();
  await page.getByRole('link',{name:'← Projects & Tasks'}).click();
  await page.locator('.project-records li').filter({hasText:'Approved Browser Project'}).getByRole('button',{name:'Quick view'}).click();
  await page.getByRole('button',{name:'Add delivery task'}).click();
  await page.getByRole('dialog',{name:'New delivery task'}).waitFor();
  await page.getByLabel('New task').fill('Approved Browser Task');
  await page.getByRole('button',{name:'Submit task'}).click();
  await page.getByText(/Task proposal submitted/).waitFor({timeout:15000});
  await approve('TASK_CREATE','Approved Browser Task');
  await page.reload();
  await page.locator('.project-records li').filter({hasText:'Approved Browser Project'}).getByRole('button',{name:'Quick view'}).click();
  await page.getByText('Approved Browser Task').waitFor({timeout:15000});

  await page.getByRole('link',{name:/RAID Register/}).click();
  await page.getByRole('heading',{name:'RAID Register'}).waitFor();
  await page.getByRole('button',{name:'Add risk'}).click();
  await page.getByRole('dialog',{name:'New risk'}).waitFor();
  await page.getByLabel('New risk title').fill('Approved Browser Risk');
  await page.getByRole('button',{name:'Submit item'}).click();
  await page.getByText(/RAID item submitted/).waitFor({timeout:15000});
  await approve('RISK_CREATE','Approved Browser Risk');
  await page.getByRole('button',{name:'Refresh'}).click();
  await page.getByText('Approved Browser Risk').waitFor({timeout:15000});

  await page.getByRole('link',{name:/Timesheets/}).click();
  await page.getByRole('heading',{name:'Timesheets'}).waitFor();
  await page.getByRole('button',{name:/Log time/}).click();
  await page.getByRole('dialog',{name:'New time entry'}).waitFor();
  await page.getByLabel('Hours worked').fill('7.5');
  await page.getByLabel('Work completed').fill('Browser approval walkthrough');
  await page.getByRole('button',{name:'Submit for review'}).click();
  await page.getByText(/Timesheet submitted for independent approval/).waitFor({timeout:15000});
  await approve('TIMESHEET_CREATE','7.5 hours');
  await page.reload();
  await page.getByText('Browser approval walkthrough').waitFor({timeout:15000});

  await page.getByRole('link',{name:/Executive Reports/}).click();
  await page.getByRole('heading',{name:'Executive status reports'}).waitFor();
  await page.getByText('Approved Browser Project').waitFor({timeout:15000});
  await page.getByRole('button',{name:/Submit.*snapshot/i}).first().click();
  await page.getByRole('dialog',{name:'Submit executive snapshot'}).getByRole('button',{name:'Submit snapshot'}).click();
  await page.getByText(/Publication submitted/).waitFor({timeout:15000});
  await approve('REPORT_PUBLISH');
  await page.getByRole('button',{name:'Refresh snapshots'}).click();
  await page.getByRole('combobox',{name:'Approved executive snapshots'}).click();
  await page.getByRole('listbox',{name:'Approved executive snapshots'}).getByRole('option').nth(1).click();
  assert.equal(await page.getByRole('button',{name:'Download CSV'}).isEnabled(),true);

  // Each business module owns its own maker-checker approval subtab.
  assert.equal(await sidebar.getByRole('link',{name:'Approval Center'}).count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Admin Parameters'}).count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Users & Roles'}).count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Audit & Security'}).count(),0);
  assert.equal(await sidebar.getByRole('link',{name:'Parameters'}).count(),1);
  await page.getByRole('navigation',{name:'Executive Reports tabs'}).getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'Report approvals'}).waitFor();
  await page.getByText('Publication submitted').count().then(count=>assert.equal(count,0));
  await page.getByRole('link',{name:/RAID Register/}).click();
  await page.getByRole('navigation',{name:'RAID Register tabs'}).getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'RAID approvals'}).waitFor();
  await page.getByText('Approved Browser Risk').first().waitFor({timeout:15000});
  await page.getByRole('link',{name:/Projects & Tasks/}).click();
  const projectTabs=page.getByRole('navigation',{name:'Projects & Tasks tabs'});
  const tabChrome=await projectTabs.evaluate(el=>({display:getComputedStyle(el).display,wrapping:getComputedStyle(el).flexWrap,background:getComputedStyle(el).backgroundColor,height:el.getBoundingClientRect().height}));
  assert.equal(tabChrome.display,'flex','Secondary module navigation must be flex-aligned');
  assert.equal(tabChrome.wrapping,'nowrap','Secondary navigation must stay on one line');
  assert.ok(tabChrome.height<=74,'Secondary navigation should remain compact');
  assert.ok(await projectTabs.locator('.module-tabs-track').isVisible(),'Module navigation must use an inset segmented track');
  assert.equal(await projectTabs.locator('a[aria-current="page"]').count(),1,'Exactly one contextual tab must be active');
  await page.getByRole('navigation',{name:'Projects & Tasks tabs'}).getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'Project approvals'}).waitFor();
  await page.getByText('Approved Browser Project').first().waitFor({timeout:15000});
  await page.getByRole('link',{name:/Timesheets/}).click();
  await page.getByRole('navigation',{name:'Timesheets tabs'}).getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'Timesheet approvals'}).waitFor();
  await page.getByText('7.5 hours').first().waitFor({timeout:15000});

  await page.getByRole('link',{name:/Leave Tracker/}).click();
  await page.getByRole('heading',{name:'Leave tracker'}).waitFor();
  assert.equal(await sidebar.getByRole('link',{name:'Team Calendar'}).count(),0);
  assert.equal(await page.getByRole('navigation',{name:'Leave Tracker tabs'}).getByRole('link',{name:'Team calendar'}).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Connected workflows'}).count(),0);

  await page.getByRole('button',{name:'Request leave'}).click();
  await page.getByRole('dialog',{name:'New leave request'}).waitFor();
  await page.getByRole('combobox',{name:'Leave type'}).click();
  await page.getByRole('option',{name:'Annual leave'}).click();
  async function chooseDate(label, dateString) {
    await page.getByRole('button',{name:label,exact:true}).click();
    const dialog=page.getByRole('dialog',{name:label,exact:true});
    const target=new Date(dateString+'T12:00:00');
    for(let tries=0;tries<24;tries++){
      const month=await dialog.locator('.calendar-heading strong').textContent();
      const expected=target.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
      if(month===expected)break;
      const current=new Date(Date.parse('1 '+month));
      const delta=(target.getFullYear()-current.getFullYear())*12+target.getMonth()-current.getMonth();
      await dialog.getByRole('button',{name:delta>=0?'Next month':'Previous month'}).click();
    }
    await dialog.getByRole('button',{name:target.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}).click();
  }
  await chooseDate('Start date','2026-12-20');
  await chooseDate('End date','2026-12-21');
  await page.getByLabel('Reason and handover (required)').fill('Browser approved leave');
  await page.getByRole('button',{name:'Submit for review'}).click();
  await page.getByText(/Request submitted for independent approval/).waitFor({timeout:15000});
  await approve('LEAVE_REQUEST','2026-12-20');
  await page.reload();
  await page.getByText('Browser approved leave').waitFor({timeout:15000});
  await page.getByRole('navigation',{name:'Leave Tracker tabs'}).getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'Leave approvals'}).waitFor();
  await page.getByText('2026-12-20').first().waitFor({timeout:15000});


  await sidebar.getByRole('link',{name:'Parameters'}).click();
  const adminTabs=page.getByRole('navigation',{name:'Administration tabs'});
  assert.equal(await adminTabs.getByRole('link').count(),4);
  await page.getByRole('heading',{name:'Admin Parameters'}).waitFor();
  await page.getByRole('button',{name:'Propose change to Reporting currency'}).click();
  await page.getByRole('dialog',{name:'Change organization parameter'}).waitFor();
  await page.getByRole('combobox',{name:'Parameter'}).click();
  await page.getByRole('listbox',{name:'Parameter'}).getByRole('option',{name:/Currency/i}).click();
  await page.getByLabel('Proposed value').fill('MYR');
  await page.getByLabel('Change rationale (required)').fill('Browser report currency setting');
  await page.getByRole('button',{name:'Submit for check'}).click();
  await page.getByText(/Change request created/).waitFor({timeout:15000});
  await approve('PARAMETER_UPDATE','Browser report currency setting');
  await page.reload();
  await page.getByText('Approved configuration').first().waitFor({timeout:15000});
  await adminTabs.getByRole('link',{name:'Users & Roles'}).click();
  await page.getByRole('heading',{name:'Users & Roles'}).waitFor();
  await adminTabs.getByRole('link',{name:'Audit & Security'}).click();
  await page.getByRole('heading',{name:'Audit & Security'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Related administration controls'}).count(),0);
  await adminTabs.getByRole('link',{name:'Approvals'}).click();
  await page.getByRole('heading',{name:'Administration approvals'}).waitFor();
  await page.getByText('Browser report currency setting').first().waitFor({timeout:15000});
  await adminTabs.getByRole('link',{name:'Admin Parameters'}).click();
  await page.getByRole('heading',{name:'Admin Parameters'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Connected administration workflows'}).count(),0);


  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/desktop-admin.png',fullPage:true});
  await sidebar.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/#/login',{timeout:15000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('access_token')),null);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light','Login must inherit the previously chosen appearance');
  assert.equal(await page.locator('html').getAttribute('data-accent'),'blue','Login must inherit the last accent color');
  // Exercise responsive mobile sidebar, navigation and leave form.
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto('http://localhost:5174/#/login',{waitUntil:'networkidle'});
  const mobileLayout=await mobile.locator('.auth-layout').evaluate(el=>getComputedStyle(el).display);
  assert.equal(mobileLayout,'grid','Mobile login should keep its centered single-card layout');
  assert.equal(await mobile.locator('.auth-story').isVisible(),false,'Mobile login must hide decorative brand panel');
  await mobile.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await mobile.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await mobile.getByRole('button',{name:/Sign In/i}).click();
  await mobile.waitForURL('**/#/portfolio',{timeout:15000});
  await mobile.getByRole('button',{name:'Toggle navigation'}).click();
  const mobileNav = mobile.getByRole('complementary',{name:'Primary navigation'}).getByRole('navigation',{name:'PMO modules'});
  assert.equal(await mobileNav.evaluate(el=>getComputedStyle(el).overflowY),'auto');
  assert.ok(await mobile.getByRole('button',{name:'Sign out'}).isVisible());

  assert.ok(await mobile.locator('.sidebar-signout').isVisible(),'Sign out should be accessible in mobile navigation');
  assert.equal(await mobile.getByRole('complementary',{name:'Primary navigation'}).getByRole('link',{name:'Notification Center'}).count(),0);

  await mobile.getByRole('link',{name:/Leave Tracker/}).click();
  await mobile.getByRole('heading',{name:'Leave tracker'}).waitFor();
  const mobileTabs=mobile.getByRole('navigation',{name:'Leave Tracker tabs'});
  assert.equal(await mobileTabs.evaluate(el=>getComputedStyle(el).flexWrap),'nowrap','Mobile second-line navigation must not wrap');
  assert.ok(await mobileTabs.locator('.module-tabs-track').isVisible(),'Mobile should retain the compact tab selector');
  assert.ok(await mobileTabs.locator('.module-tabs-track').evaluate(el=>el.scrollWidth>=el.clientWidth));

  await mobile.screenshot({path:'test-results/mobile-leave.png',fullPage:true});
  await mobile.getByRole('button',{name:'Request leave'}).click();
  assert.ok(await mobile.getByRole('dialog',{name:'New leave request'}).isVisible(),'Premium leave composer must work on mobile');
  assert.ok(await mobile.getByLabel('Leave duration').isVisible());
  await mobile.close();
  assert.deepEqual(errors,[],'Browser runtime exceptions');
  console.log('Playwright PASS: signup, portfolio, project/task, RAID, timesheet, published reporting, leave, admin + checker API approvals');
} finally {await browser.close();}
