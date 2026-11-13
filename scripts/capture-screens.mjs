// Captures the main workflow surfaces at 1440x900 for the fidelity review (AC7).
//
// It never touches the development database: it builds a fresh database in a temporary folder,
// starts its own server on separate ports, creates its fixtures there, then shuts it down and
// deletes the folder. Requires a build (`pnpm build`).
//
// Usage: node scripts/capture-screens.mjs <outDir>
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'docs/fidelity/after';
const GUI_PORT = 3210;
const API_PORT = 8290;
const base = `http://127.0.0.1:${GUI_PORT}`;
const api = `http://127.0.0.1:${API_PORT}`;

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-capture-'));
const env = { ...process.env, DATA_DIR: dataDir, GUI_PORT: String(GUI_PORT), API_PORT: String(API_PORT), CLOCK_MODE: 'fixed' };
let server;

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const post = (route, body) =>
  fetch(api + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

try {
  const build = spawnSync('node', ['dist/server/scripts/build-db.js'], { env, stdio: 'ignore' });
  if (build.status !== 0) throw new Error('Database build failed; run "pnpm build" first');
  server = spawn('node', ['dist/server/src/server/main.js'], { env, stdio: 'ignore' });
  await waitFor(`${api}/api/health`);
  await waitFor(base);

  const lead = await post('/api/sobjects/Lead', {
    FirstName: 'Grace', LastName: 'Hopper', Company: 'Navy Compilers', Title: 'Rear Admiral',
    Email: 'grace@example.invalid', Phone: '+1 202-555-0100', Rating: 'Warm', LeadSource: 'Web',
  });
  await post('/api/tasks/log-call', { whoId: lead.id, description: 'Intro call, interested in a pilot' });
  const first = async (object, where = []) => (await post('/api/query', { object, where, orderBy: [{ field: 'Name' }], limit: 1 })).records[0];
  const opp = await first('Opportunity', [{ field: 'StageName', op: 'eq', value: 'Value Proposition' }]);
  const account = await first('Account');
  const contact = await first('Contact');
  const task = (await post('/api/query', { object: 'Task', limit: 1 })).records[0];

  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shot = async (name) => {
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  };

  await page.goto(`${base}/lightning/page/home`);
  await page.getByTestId('home-page').waitFor();
  await shot('01-seller-home');
  await page.goto(`${base}/lightning/o/Lead/list?sort=Company&filter=Rating%3AHot`);
  await page.getByTestId('data-row').first().waitFor();
  await shot('02-leads-all-hot-by-company');
  await page.getByTestId('toggle-filters').click();
  await shot('03-leads-filter-panel');
  await page.goto(`${base}/lightning/o/Lead/list`);
  await page.getByTestId('new-record').click();
  await page.getByRole('dialog').waitFor();
  await shot('04-new-lead-modal');
  await page.goto(`${base}/lightning/r/Lead/${lead.id}/view`);
  await page.getByTestId('record-title').waitFor();
  await shot('05-lead-record');
  await page.getByTestId('convert-lead').click();
  await page.getByRole('dialog').waitFor();
  await shot('06-convert-lead-dialog');
  await page.goto(`${base}/lightning/r/Opportunity/${opp.Id}/view`);
  await page.getByTestId('path').waitFor();
  await shot('07-opportunity-record');
  await page.getByTestId('tab-related').click();
  await page.getByTestId('related-OpportunityContactRole').waitFor();
  await shot('08-opportunity-contact-roles');
  await page.goto(`${base}/lightning/r/Account/${account.Id}/view`);
  await page.getByTestId('record-title').waitFor();
  await shot('09-account-record');
  await page.goto(`${base}/lightning/r/Contact/${contact.Id}/view`);
  await page.getByTestId('record-title').waitFor();
  await shot('10-contact-record');
  await page.goto(`${base}/lightning/r/Task/${task.Id}/view`);
  await page.getByTestId('record-title').waitFor();
  await shot('11-task-record');
  await page.goto(`${base}/lightning/o/Opportunity/list`);
  await page.getByTestId('data-row').first().waitFor();
  await shot('12-opportunities-list');
  await page.goto(`${base}/lightning/o/Account/list`);
  await page.getByTestId('data-row').first().waitFor();
  await shot('13-accounts-list');

  await browser.close();
  console.log(`Saved screenshots to ${out} (isolated server, data deleted)`);
} finally {
  server?.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
