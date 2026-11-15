import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const emails=[];
const mailbox=createServer((req,res)=>{
  let raw='';
  req.on('data',c=>raw+=c);
  req.on('end',()=>{
    try {
      emails.push(JSON.parse(raw));
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({id:'browser-mock'}));
    } catch {
      res.writeHead(400);res.end();
    }
  });
});
await new Promise(resolve=>mailbox.listen(39222,'127.0.0.1',resolve));
const base='http://127.0.0.1:3000/api';
async function api(path,token,method='GET',body) {
  const response=await fetch(base+path,{
    method,
    headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const payload=await response.json();
  assert.ok(response.ok,method+' '+path+' failed: '+JSON.stringify(payload));
  return payload.data;
}
function deliveredToken(recipient,subject) {
  const email=emails.filter(m=>m.to?.includes(recipient)&&m.subject?.includes(subject)).at(-1);
  assert.ok(email,'Expected '+subject+' email');
  const match=/[?&]token=([a-f0-9]{64})/.exec(email.text);
  assert.ok(match,'Email did not include an activation token');
  return match[1];
}
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
try {
  const unique=String(Date.now());
  const recipient='browser-auth-'+unique+'@pmo.test';
  await page.goto('http://localhost:5174/#/signup',{waitUntil:'networkidle'});
  await page.getByLabel('First name').fill('Browser');
  await page.getByLabel('Last name').fill('Colleague');
  await page.getByLabel('Work email address').fill(recipient);
  await page.getByLabel('Organization name').fill('PMO Development');
  await page.getByLabel('Password',{exact:true}).fill('browser-unique-password-123');
  await page.getByLabel('Confirm password').fill('browser-unique-password-123');
  await page.getByRole('checkbox',{name:/I agree/}).check();
  await page.getByRole('button',{name:'Request account'}).click();
  await page.getByText(/Registration submitted for administrator approval/).waitFor({timeout:15000});

  const checker=(await api('/auth/login',null,'POST',{
    email:'checker@pmo.test',password:'checker-test-password-123'
  })).accessToken;
  const queue=await api('/reviews',checker);
  const request=queue.find(r=>r.kind==='REGISTRATION'&&r.summary===recipient);
  assert.ok(request,'Pending browser registration not found');
  await api('/reviews/'+request.id+'/decision',checker,'POST',{decision:'APPROVED'});
  const token=deliveredToken(recipient,'Verify');
  await page.goto('http://localhost:5174/#/verify-email?token='+token,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Verify my email'}).click();
  await page.getByText(/Email verified/).waitFor({timeout:15000});

  await page.goto('http://localhost:5174/#/login',{waitUntil:'networkidle'});
  await page.getByPlaceholder('name@company.com').fill(recipient);
  await page.getByPlaceholder('••••••••').fill('browser-unique-password-123');
  await page.getByRole('button',{name:/Sign In/i}).click();
  await page.waitForURL('**/#/portfolio',{timeout:15000});
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.waitForURL('**/#/login',{timeout:15000});

  await page.getByRole('link',{name:'Forgot password?'}).click();
  await page.getByLabel('Work email').fill(recipient);
  await page.getByRole('button',{name:'Send password reset link'}).click();
  await page.getByText(/password reset link will be sent/).waitFor({timeout:15000});
  const recovery=deliveredToken(recipient,'Reset');
  await page.goto('http://localhost:5174/#/reset-password?token='+recovery,{waitUntil:'networkidle'});
  await page.getByLabel('New password').fill('browser-recovered-password-123');
  await page.getByLabel('Confirm new password').fill('browser-recovered-password-123');
  await page.getByRole('button',{name:'Reset password'}).click();
  await page.getByText(/Password reset/).waitFor({timeout:15000});

  await page.goto('http://localhost:5174/#/login',{waitUntil:'networkidle'});
  await page.getByPlaceholder('name@company.com').fill(recipient);
  await page.getByPlaceholder('••••••••').fill('browser-recovered-password-123');
  await page.getByRole('button',{name:/Sign In/i}).click();
  await page.waitForURL('**/#/portfolio',{timeout:15000});
  console.log('Account E2E PASS: signup, independent approval, verification and recovery');
} finally {
  await browser.close();
  await new Promise(resolve=>mailbox.close(resolve));
}
