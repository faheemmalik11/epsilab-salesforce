import type { Page } from '@playwright/test';
import { expect, expectHealthy, restCount, restGet, saveModal, test } from './fixtures';

// The Environment Controls reset in the GUI. These run against Playwright's own server and database
// (or the smoke run's own stack), never a developer's running instance.

const openResetDialog = async (page: Page) => {
  await page.getByTestId('settings-button').click();
  const menu = page.getByTestId('settings-menu');
  await expect(menu).toContainText('Environment Controls (demo admin)');
  await menu.getByTestId('reset-to-baseline').click();
  const dialog = page.getByRole('dialog', { name: 'Reset Environment?' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('the reset dialog explains itself and Cancel changes nothing', async ({ page, api, health }) => {
  await page.goto('/lightning/o/Account/list');
  const created = (await (await api.post('/api/sobjects/Account', { data: { Name: 'Kept After Cancel' } })).json()).id as string;
  const dialog = await openResetDialog(page);
  await expect(dialog).toContainText('All changes made since the baseline');
  await expect(dialog).toContainText('are permanently discarded.');
  await expect(dialog).toContainText('not a standard Salesforce feature');
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Reset Environment', exact: true })).toBeVisible();

  let resets = 0;
  page.on('request', (request) => request.url().endsWith('/api/admin/reset') && resets++);
  await dialog.getByTestId('reset-cancel').click();
  await expect(dialog).toHaveCount(0);
  // Opening the menu and choosing the item alone never resets: it needs the confirmation.
  await openResetDialog(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(resets).toBe(0);
  expect((await api.get(`/api/sobjects/Account/${created}`)).status()).toBe(200);
  await api.delete(`/api/sobjects/Account/${created}`);
  expectHealthy(health);
});

test('Reset Environment restores the baseline after GUI edits and the UI shows it at once', async ({ page, api, health }) => {
  // Earlier specs may have added records, so the baseline's count comes from the snapshot, after the reset.
  const startAccounts = await restCount(api, 'Account');
  await page.goto('/lightning/o/Account/list');
  await page.getByTestId('new-record').click();
  await page.locator('#field-Name').fill('Made Before Reset');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('Made Before Reset');
  const accountId = page.url().match(/Account\/(\w{18})/)![1]!;
  expect(await restCount(api, 'Account')).toBe(startAccounts + 1);
  expect((await (await api.get('/api/mutations?limit=10')).json()).mutations.length).toBeGreaterThan(0);

  const dialog = await openResetDialog(page);
  await dialog.getByTestId('reset-confirm').click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Environment reset to the baseline' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/lightning\/page\/home$/);

  // The database is the baseline again.
  expect((await api.get(`/api/sobjects/Account/${accountId}`)).status()).toBe(404);
  expect((await (await api.get('/api/mutations?limit=10')).json()).mutations).toEqual([]);
  const verify = await (await api.get('/api/admin/snapshots/baseline/verify')).json();
  expect(verify).toMatchObject({ matches: true, contentMatches: true });
  const baselineAccounts = verify.tables.find((t: { name: string }) => t.name === 'Account').rows as number;
  expect(await restCount(api, 'Account')).toBe(baselineAccounts);
  expect((await restGet(api, 'Lead', (await (await api.post('/api/query', { data: { object: 'Lead', limit: 1 } })).json()).records[0].Id)).Id).toBeTruthy();
  expect(await restCount(api, 'Lead')).toBe(21628);

  // And the UI shows it: no stale record in Recent Records, the list count is the baseline's.
  await expect(page.getByTestId('home-recent-records')).not.toContainText('Made Before Reset');
  await page.getByTestId('sidebar-Accounts').click();
  await expect(page.getByTestId('list-meta')).toContainText(`${baselineAccounts.toLocaleString('en-US')} items`);
  await page.goto(`/lightning/r/Account/${accountId}/view`);
  await expect(page.getByTestId('page-error-message')).toBeVisible();
  expectHealthy(health, [/404 GET .*\/api\/sobjects\/Account\//]);
});

test('a reset in progress shows its state and ignores repeated clicks', async ({ page, health }) => {
  await page.goto('/lightning/page/home');
  let resets = 0;
  await page.route('**/api/admin/reset', async (route) => {
    resets++;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  const dialog = await openResetDialog(page);
  const confirm = dialog.getByTestId('reset-confirm');
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveText('Resetting…');
  await expect(dialog.getByTestId('reset-progress')).toBeVisible();
  await expect(dialog.getByTestId('reset-cancel')).toBeDisabled();
  await confirm.click({ force: true });
  await confirm.click({ force: true });
  // Escape doesn't abandon a reset halfway either.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('toast').filter({ hasText: 'Environment reset to the baseline' })).toBeVisible();
  expect(resets).toBe(1);
  expectHealthy(health);
});

test('a failed reset shows the API error, never claims success, and leaves the app usable', async ({ page, api, health }) => {
  const kept = (await (await api.post('/api/sobjects/Account', { data: { Name: 'Survives Failed Reset' } })).json()).id as string;
  await page.goto('/lightning/page/home');
  const error = [{ errorCode: 'INVALID_SNAPSHOT', message: 'Snapshot "baseline" failed its sha256 check; nothing was restored.' }];
  await page.route('**/api/admin/reset', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify(error) }));
  let dialog = await openResetDialog(page);
  await dialog.getByTestId('reset-confirm').click();
  await expect(dialog.getByTestId('page-error-message')).toHaveText(error[0]!.message);
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await expect(dialog.getByTestId('reset-confirm')).toBeEnabled();
  await dialog.getByTestId('reset-cancel').click();

  // A reset that answers 200 but doesn't match the baseline is reported as a failure too.
  await page.unroute('**/api/admin/reset');
  await page.route('**/api/admin/reset', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ snapshot: 'baseline', sha256: 'f'.repeat(64), matches: false, durationMs: 5, removedSideFiles: [] }) }),
  );
  dialog = await openResetDialog(page);
  await dialog.getByTestId('reset-confirm').click();
  await expect(dialog.getByTestId('page-error-message')).toContainText('does not match the baseline');
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await dialog.getByTestId('reset-cancel').click();

  // Nothing was reset, and the app still works.
  expect((await restGet(api, 'Account', kept)).Name).toBe('Survives Failed Reset');
  await page.getByTestId('sidebar-Accounts').click();
  await expect(page.getByTestId('data-row').first()).toBeVisible();
  await api.delete(`/api/sobjects/Account/${kept}`);
  expectHealthy(health, [/400 POST .*\/api\/admin\/reset/]);
});

test('Reset to Seed Only leaves leads and users, and Generate Synthetic Data brings the rest back', async ({ page, api, health }) => {
  const baselineAccounts = await restCount(api, 'Account');
  expect(baselineAccounts).toBeGreaterThan(0);
  const menu = page.getByTestId('settings-menu');
  try {
    await page.goto('/lightning/o/Account/list');
    await page.getByTestId('settings-button').click();
    // With generated data in place there is nothing to generate.
    await expect(menu.getByTestId('generate-synthetic-data')).toHaveAttribute('aria-disabled', 'true');
    await menu.getByTestId('reset-to-seed-only').click();
    const reset = page.getByRole('dialog', { name: 'Reset Environment?' });
    await expect(reset).toContainText('21,628 leads and 9 users');
    await reset.getByTestId('reset-confirm').click();
    await expect(page.getByTestId('toast')).toContainText('Environment reset to the seed only');
    expect(await restCount(api, 'Account')).toBe(0);
    expect(await restCount(api, 'Lead')).toBe(21628);
    await page.goto('/lightning/o/Account/list');
    await expect(page.getByTestId('list-meta')).toContainText('0 items');

    await page.getByTestId('settings-button').click();
    await expect(menu.getByTestId('generate-synthetic-data')).not.toHaveAttribute('aria-disabled', 'true');
    await menu.getByTestId('generate-synthetic-data').click();
    const generate = page.getByRole('dialog', { name: 'Generate Synthetic Data?' });
    await generate.getByTestId('generate-confirm').click();
    await expect(page.getByTestId('toast').last()).toContainText('Generated', { timeout: 30_000 });
    expect(await restCount(api, 'Account')).toBe(baselineAccounts);
    await page.goto('/lightning/o/Account/list');
    await expect(page.getByTestId('list-meta')).toContainText(`${baselineAccounts.toLocaleString('en-US')} items`);
  } finally {
    await api.post('/api/admin/reset', { data: {} });
  }
  expectHealthy(health);
});
