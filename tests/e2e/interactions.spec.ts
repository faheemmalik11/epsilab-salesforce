import type { APIRequestContext, Page } from '@playwright/test';
import { expect, expectHealthy, restCreate, restGet, saveModal, test } from './fixtures';

/** Each test works on its own leads and deletes them, so later specs still see the 21,628-lead baseline. */
async function withLeads(api: APIRequestContext, names: string[], run: (ids: string[]) => Promise<void>) {
  const ids: string[] = [];
  try {
    for (const name of names) ids.push(await restCreate(api, 'Lead', { LastName: name, Company: `${name} Co`, Status: 'Open - Not Contacted' }));
    await run(ids);
  } finally {
    for (const id of ids) await api.delete(`/api/sobjects/Lead/${id}`);
  }
}

const openList = async (page: Page, search: string) => {
  await page.goto(`/lightning/o/Lead/list?q=${encodeURIComponent(search)}`);
  await expect(page.getByTestId('data-row').first()).toBeVisible();
};

test('object tab menus: New, recent records, list views, keyboard and click-outside closing', async ({ page, api, health }) => {
  await page.goto('/lightning/page/home');
  const chevron = page.getByTestId('nav-chevron-Lead');
  await chevron.click();
  const menu = page.getByTestId('nav-menu-Lead');
  await expect(menu).toBeVisible();
  await expect(menu.getByText('New Lead')).toBeVisible();
  await expect(menu.getByText('Recent records')).toBeVisible();
  const newest = (await (await api.post('/api/query', {
    data: { object: 'Lead', orderBy: [{ field: 'LastModifiedDate', direction: 'desc' }, { field: 'Id', direction: 'desc' }], limit: 1 },
  })).json()).records[0];
  await expect(menu.getByTestId('nav-recent-record').first()).toHaveText(newest.Name);

  // Keyboard: the first item has the focus, the arrows move it, Escape closes and returns to the chevron.
  await expect(menu.getByRole('menuitem', { name: 'New Lead' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByTestId('nav-recent-record').first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: /Open "Leads" in New Tab/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(chevron).toBeFocused();

  await chevron.click();
  await page.mouse.click(700, 500);
  await expect(menu).toHaveCount(0);

  await chevron.click();
  await page.getByTestId('nav-list-mine-Lead').click();
  await expect(page).toHaveURL(/\/lightning\/o\/Lead\/list\?view=mine/);
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');

  await page.getByTestId('nav-chevron-Account').click();
  await page.getByTestId('nav-new-Account').click();
  await page.locator('#field-Name').fill('Nav Menu Account');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('Nav Menu Account');
  await expect(page.getByTestId('nav-Account')).toHaveClass(/slds-is-active/);
  expectHealthy(health);
});

test('list inline edit: Escape restores, Cancel discards, Save writes through the API and shows its errors', async ({ page, api, health }) => {
  await withLeads(api, ['Inline Alpha', 'Inline Beta'], async ([alpha, beta]) => {
    await openList(page, 'Inline ');
    const row = (name: string) => page.getByTestId('data-row').filter({ hasText: name });
    const status = row('Inline Alpha').locator('td[data-field=Status]');

    await status.hover();
    await row('Inline Alpha').getByTestId('edit-cell-Status').click();
    await page.locator('#inline-Status').selectOption('Working - Contacted');
    await page.keyboard.press('Escape');
    await expect(status).toHaveText('Open - Not Contacted');
    await expect(page.getByTestId('inline-edit-footer')).toHaveCount(0);

    await row('Inline Alpha').getByTestId('edit-cell-Status').click();
    await page.locator('#inline-Status').selectOption('Working - Contacted');
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('Working - Contacted');
    await expect(status).toHaveClass(/cell-edited/);
    await page.getByTestId('inline-cancel').click();
    await expect(status).toHaveText('Open - Not Contacted');
    expect((await restGet(api, 'Lead', alpha!)).Status).toBe('Open - Not Contacted');

    // Two rows at once; the second one fails the API's required-field rule.
    await row('Inline Alpha').getByTestId('edit-cell-Status').click();
    await page.locator('#inline-Status').selectOption('Working - Contacted');
    await page.keyboard.press('Enter');
    await row('Inline Beta').getByTestId('edit-cell-Company').click();
    await page.locator('#inline-Company').fill('');
    await page.keyboard.press('Enter');
    const rest = await api.patch(`/api/sobjects/Lead/${beta}`, { data: { Company: null } });
    const restMessage = (await rest.json())[0].message as string;
    await page.getByTestId('inline-save').click();
    await expect(page.getByTestId('inline-edit-errors')).toContainText(restMessage);
    await expect(row('Inline Beta').getByTestId('row-error')).toBeVisible();
    await expect(page.getByTestId('toast').filter({ hasText: '1 Lead saved.' })).toBeVisible();
    expect((await restGet(api, 'Lead', alpha!)).Status).toBe('Working - Contacted');
    expect((await restGet(api, 'Lead', beta!)).Company).toBe('Inline Beta Co');

    await row('Inline Beta').getByTestId('edit-cell-Company').click();
    await page.locator('#inline-Company').fill('Fixed Co');
    await page.keyboard.press('Enter');
    await page.getByTestId('inline-save').click();
    await expect(page.getByTestId('inline-edit-footer')).toHaveCount(0);
    await expect(row('Inline Beta').locator('td[data-field=Company]')).toHaveText('Fixed Co');
    expect((await restGet(api, 'Lead', beta!)).Company).toBe('Fixed Co');
  });
  expectHealthy(health, [/400 PATCH .*\/api\/sobjects\/Lead\//]);
});

test('row actions: Change Owner and Delete work, Edit Labels is a marked stub', async ({ page, api, health }) => {
  await withLeads(api, ['Rowaction Owner', 'Rowaction Delete'], async ([ownerLead, deleteLead]) => {
    const users = (await (await api.get('/api/users')).json()) as { Id: string; Name: string; IsActive: boolean }[];
    const jon = users.find((u) => u.Name === 'Jon Santiago')!;
    await openList(page, 'Rowaction ');
    const row = (name: string) => page.getByTestId('data-row').filter({ hasText: name });

    await row('Rowaction Owner').getByTestId('row-actions').click();
    const menu = page.getByTestId('row-action-menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Edit', 'Delete', 'Change Owner', /Edit Labels/]);
    await expect(menu.getByRole('menuitem', { name: /Edit Labels/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(menu.getByTestId('scope-label')).toBeVisible();
    await menu.getByTestId('row-change-owner').click();
    await page.locator('#change-owner').selectOption(jon.Id);
    await page.getByTestId('change-owner-submit').click();
    await expect(row('Rowaction Owner').locator('td[data-field=OwnerId]')).toHaveText('Jon Santiago');
    expect((await restGet(api, 'Lead', ownerLead!)).OwnerId).toBe(jon.Id);

    await row('Rowaction Delete').getByTestId('row-actions').click();
    await page.getByTestId('row-delete').click();
    await expect(page.getByRole('dialog', { name: 'Delete Lead' })).toContainText('Are you sure you want to delete this lead?');
    await page.getByTestId('confirm-delete').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Lead "Rowaction Delete" was deleted.' })).toBeVisible();
    await expect(row('Rowaction Delete')).toHaveCount(0);
    expect((await api.get(`/api/sobjects/Lead/${deleteLead}`)).status()).toBe(404);
  });
  expectHealthy(health);
});

test('column menus wrap and clip text, and the list view picker searches its views', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  const company = page.getByTestId('data-row').first().locator('td[data-field=Company]');
  await page.getByTestId('column-actions-Company').click();
  await expect(page.getByTestId('clip-Company')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('wrap-Company').click();
  await expect(company).toHaveClass(/cell-wrap/);
  await page.getByTestId('column-actions-Company').click();
  await expect(page.getByTestId('wrap-Company')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('clip-Company').click();
  await expect(company).not.toHaveClass(/cell-wrap/);

  await page.getByTestId('list-view-picker').click();
  await expect(page.getByTestId('list-view-search')).toBeFocused();
  await page.getByTestId('list-view-search').fill('my');
  const menu = page.getByTestId('list-view-menu');
  await expect(menu.getByRole('menuitemradio')).toHaveText(['My Leads']);
  await menu.getByText('My Leads').click();
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');
  expectHealthy(health);
});

test('record inline edit, header actions, docked composer and delete', async ({ page, api, health }) => {
  await withLeads(api, ['Record Inline'], async ([leadId]) => {
    const rest = await api.patch(`/api/sobjects/Lead/${leadId}`, { data: { Company: null } });
    const requiredMessage = (await rest.json())[0].message as string;
    await page.goto(`/lightning/r/Lead/${leadId}/view`);

    await page.getByTestId('inline-edit-Title').click();
    await expect(page.getByTestId('details-edit-mode')).toBeVisible();
    await expect(page.locator('#field-Title')).toBeFocused();
    await page.locator('#field-Title').fill('Discarded');
    await page.getByTestId('details-cancel').click();
    await expect(page.getByTestId('detail-Title')).toHaveText('');

    await page.getByTestId('inline-edit-Company').click();
    await page.locator('#field-Company').fill('');
    await page.getByTestId('details-save').click();
    await expect(page.getByTestId('field-error-Company')).toHaveText('Complete this field.');
    await expect(page.getByTestId('details-footer')).toContainText(requiredMessage);
    await page.locator('#field-Company').fill('Inline Saved Co');
    await page.locator('#field-Title').fill('VP Sales');
    await page.getByTestId('details-save').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Lead "Record Inline" was saved.' })).toBeVisible();
    await expect(page.getByTestId('detail-Title')).toHaveText('VP Sales');
    expect(await restGet(api, 'Lead', leadId!)).toMatchObject({ Title: 'VP Sales', Company: 'Inline Saved Co' });

    await page.getByTestId('more-actions').click();
    const more = page.getByTestId('more-actions-menu');
    await expect(more.getByRole('menuitem', { name: /New Event/ })).toHaveAttribute('aria-disabled', 'true');
    await more.getByTestId('more-new-task').click();
    await expect(page.getByTestId('docked-composer')).toContainText('New Task');
    await expect(page.locator('#task-subject')).toBeFocused();
    await page.locator('#task-subject').fill('Composer task');
    await page.getByTestId('activity-save').click();
    await expect(page.getByTestId('timeline-group-upcoming').getByTestId('timeline-item')).toContainText('Composer task');

    await page.getByTestId('more-actions').click();
    await page.getByTestId('more-delete').click();
    await page.getByTestId('confirm-delete').click();
    await expect(page).toHaveURL(/\/lightning\/o\/Lead\/list$/);
    expect((await api.get(`/api/sobjects/Lead/${leadId}`)).status()).toBe(404);
  });
  expectHealthy(health, [/400 PATCH .*\/api\/sobjects\/Lead\//]);
});

test("Seller Home task filters, and completing a task from Today's Tasks", async ({ page, api, health }) => {
  const clock = await (await api.get('/api/admin/clock')).json();
  const today = await restCreate(api, 'Task', { Subject: 'Home due today', ActivityDate: clock.today });
  const overdue = await restCreate(api, 'Task', { Subject: 'Home overdue', ActivityDate: '2026-01-05' });
  try {
    await page.goto('/lightning/page/home');
    const card = page.getByTestId('home-todays-tasks');
    await expect(card.getByTestId('home-task').filter({ hasText: 'Home due today' })).toBeVisible();
    await expect(card.getByTestId('home-task').filter({ hasText: 'Home overdue' })).toHaveCount(0);
    await page.getByTestId('home-task-filter').click();
    await page.getByTestId('task-filter-overdue').click();
    await expect(card).toContainText('Overdue Tasks');
    await expect(card.getByTestId('home-task').filter({ hasText: 'Home overdue' })).toBeVisible();
    await page.getByTestId('home-task-filter').click();
    await page.getByTestId('task-filter-today').click();
    await card.getByTestId('home-task').filter({ hasText: 'Home due today' }).getByTestId('home-task-complete').click();
    await expect(page.getByTestId('toast').filter({ hasText: 'Task "Home due today" was completed.' })).toBeVisible();
    await expect(card.getByTestId('home-task').filter({ hasText: 'Home due today' })).toHaveCount(0);
    expect((await restGet(api, 'Task', today)).Status).toBe('Completed');
  } finally {
    for (const id of [today, overdue]) await api.delete(`/api/sobjects/Task/${id}`);
  }
  expectHealthy(health);
});

test('nav underline: the active tab keeps its blue line when hovered, and a hovered tab shows the dark line', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  const underline = (testId: string) =>
    page.getByTestId(testId).evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return { opacity: after.opacity, color: after.backgroundColor, height: after.height, display: after.display };
    });
  expect(await underline('nav-Lead')).toMatchObject({ opacity: '1', color: 'rgb(2, 80, 217)', height: '3px' });
  expect(await underline('nav-Contact')).toMatchObject({ opacity: '0' });
  await page.getByTestId('nav-Lead').hover();
  expect(await underline('nav-Lead')).toMatchObject({ opacity: '1', color: 'rgb(2, 80, 217)', display: 'block' });
  await page.getByTestId('nav-Contact').hover();
  expect(await underline('nav-Contact')).toMatchObject({ opacity: '1', color: 'rgb(0, 30, 91)', height: '3px', display: 'block' });
  expect(await underline('nav-Lead')).toMatchObject({ opacity: '1', color: 'rgb(2, 80, 217)' });
  expectHealthy(health);
});
