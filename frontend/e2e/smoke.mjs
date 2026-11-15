import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message));
try {
  await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('name@company.com').fill('admin@pmo.test');
  await page.getByPlaceholder('••••••••').fill('local-test-password-12345');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/#/portfolio', { timeout: 15000 });
  await page.getByRole('heading', { name: 'Portfolio Overview' }).waitFor();
  await page.getByRole('link', { name: /Delivery Workspace/ }).click();
  await page.getByRole('heading', { name: 'Projects & tasks' }).waitFor();
  const projectName = 'E2E Delivery Project';
  await page.getByLabel('New project name').fill(projectName);
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByText('Project created and saved to PostgreSQL.').waitFor({ timeout: 15000 });
  await page.getByLabel('New task').fill('E2E Delivery Task');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByText('Task created.').waitFor({ timeout: 15000 });
  await page.reload();
  await page.getByText(projectName).first().waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: /RAID Register/ }).click();
  await page.getByRole('heading', { name: 'RAID Register' }).waitFor();
  await page.getByLabel('New risk title').fill('E2E Project Risk');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByText('E2E Project Risk').waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: /Timesheets/ }).click();
  await page.getByRole('heading', { name: 'Project timesheets' }).waitFor();
  await page.getByRole('link', { name: /Executive Reports/ }).click();
  await page.getByRole('heading', { name: 'Executive status reports' }).waitFor();
  await page.getByText(projectName).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/#/login', { timeout: 15000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('access_token')), null);
  console.log('Chromium E2E passed: login, project/task persistence, RAID, timesheets, reports, logout.');
} finally {
  await browser.close();
}
