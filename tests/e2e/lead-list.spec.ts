import { expect, expectHealthy, saveModal, test } from './fixtures';

const ALL_LEADS = [{ field: 'IsConverted', op: 'eq', value: false }];
const HOT = [...ALL_LEADS, { field: 'Rating', op: 'eq', value: 'Hot' }];

test('AC2: All Leads, sort by Company, filter Rating = Hot shows 7,111, each action under a second', async ({ page, api, health }) => {
  const firstCompany = async (where: unknown[]) => {
    const res = await api.post('/api/query', { data: { object: 'Lead', where, orderBy: [{ field: 'Company' }], limit: 1 } });
    const body = await res.json();
    return { company: body.records[0].Company as string, total: body.totalSize as number };
  };
  const expectedSorted = await firstCompany(ALL_LEADS);
  const expectedHot = await firstCompany(HOT);
  expect(expectedHot.total).toBe(7111);

  const meta = page.getByTestId('list-meta');
  const firstRowCompany = page.getByTestId('data-row').first().locator('td[data-field=Company]');
  const timings: Record<string, number> = {};

  await page.goto('/lightning/page/home');
  await expect(page.getByTestId('home-page')).toBeVisible();

  let started = Date.now();
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await expect(meta).toContainText('21,628 items');
  await expect(page.getByTestId('data-row').first()).toBeVisible();
  timings.openAllLeads = Date.now() - started;
  await expect(page.getByTestId('list-view-name')).toHaveText('All Leads');

  started = Date.now();
  await page.getByTestId('sort-Company').click();
  await expect(firstRowCompany).toHaveText(expectedSorted.company);
  timings.sortByCompany = Date.now() - started;
  await expect(meta).toContainText('Sorted by Company');

  await page.getByTestId('toggle-filters').click();
  await page.getByRole('button', { name: 'Add Filter' }).click();
  await page.locator('#filter-field').selectOption('Rating');
  await page.locator('#filter-value').selectOption('Hot');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('filter-item')).toContainText('equals Hot');

  started = Date.now();
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Save' }).click();
  await expect(meta).toContainText('7,111 items');
  await expect(firstRowCompany).toHaveText(expectedHot.company);
  timings.filterRatingHot = Date.now() - started;

  await expect(meta).toHaveText('7,111 items • Sorted by Company • Filtered by All leads - Rating • Updated a few seconds ago');
  const ratings = await page.getByTestId('data-row').locator('td[data-field=Rating]').allTextContents();
  expect(ratings.length).toBe(50);
  expect(new Set(ratings)).toEqual(new Set(['Hot']));

  const companies = (await page.getByTestId('data-row').locator('td[data-field=Company]').allTextContents()).map((c) => c.toLowerCase());
  expect(companies).toEqual([...companies].sort());

  started = Date.now();
  await page.getByTestId('data-row').last().scrollIntoViewIfNeeded();
  await expect(page.getByTestId('data-row')).toHaveCount(100);
  timings.loadNextPage = Date.now() - started;

  console.log(`AC2 timings (ms): ${JSON.stringify(timings)}`);
  test.info().annotations.push({ type: 'timings', description: JSON.stringify(timings) });
  for (const [action, ms] of Object.entries(timings)) expect(ms, action).toBeLessThan(1000);

  expectHealthy(health);
});

test('opening Filters keeps column widths and scrolls the table sideways', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list?sort=Company');
  await expect(page.getByTestId('data-row').first()).toBeVisible();
  const headerWidths = () =>
    page.locator('th.th-data').evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().width)));
  const closed = await headerWidths();

  await page.getByTestId('toggle-filters').click();
  await expect(page.getByTestId('filter-panel')).toBeVisible();
  const open = await headerWidths();
  for (const width of open) expect(width).toBeGreaterThanOrEqual(160);
  expect(open).toEqual(closed);

  const scroll = page.getByTestId('list-scroll');
  const overflows = await scroll.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflows).toBe(true);
  await expect(page.getByTestId('filter-panel')).toBeInViewport();

  expectHealthy(health);
});

test('the list view picker switches to My Leads and marks unsupported views as stubs', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  await expect(page.getByTestId('list-meta')).toContainText('21,628 items');
  await page.getByTestId('list-view-picker').click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('Recently Viewed')).toBeVisible();
  await expect(menu.getByTestId('scope-label')).toHaveCount(2);
  await menu.getByText('My Leads').click();
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');
  await expect(page.getByTestId('list-meta')).toContainText('0 items');
  expectHealthy(health);
});

test('pinning a list view makes it the view the tab opens with', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  const pin = page.getByTestId('list-view-pin');
  await expect(page.getByTestId('list-view-name')).toHaveText('All Leads');
  await expect(pin).toHaveAttribute('title', 'This list is pinned.');

  await page.goto('/lightning/o/Lead/list?view=mine');
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');
  await expect(pin).toHaveAttribute('title', 'Pin this list view.');
  await pin.click();
  await expect(pin).toHaveAttribute('title', 'This list is pinned.');
  await expect(page.getByTestId('toast')).toContainText('My Leads was pinned.');

  // The bare tab URL, as the navigation bar opens it, now shows the pinned view; other objects are unaffected.
  await page.goto('/lightning/o/Lead/list');
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');
  await page.goto('/lightning/o/Lead/list?view=all');
  await expect(page.getByTestId('list-view-name')).toHaveText('All Leads');
  await expect(pin).toHaveAttribute('title', 'Pin this list view.');
  await page.goto('/lightning/o/Account/list');
  await expect(page.getByTestId('list-view-name')).toHaveText('All Accounts');

  expectHealthy(health);
});

test('Search this list, Save & New and the row Edit action', async ({ page, api, health }) => {
  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('new-record').click();
  await page.locator('#field-LastName').fill('SaveNew One');
  await page.locator('#field-Company').fill('Save New Co');
  await page.getByTestId('save-and-new').click();
  await expect(page.getByTestId('toast')).toContainText('SaveNew One');
  await expect(page.locator('#field-LastName')).toHaveValue('');
  await page.locator('#field-LastName').fill('SaveNew Two');
  await page.locator('#field-Company').fill('Save New Co');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('SaveNew Two');

  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('list-search').fill('SaveNew');
  await expect(page.getByTestId('list-meta')).toContainText('2 items');
  await expect(page).toHaveURL(/q=SaveNew/);
  const row = page.getByTestId('data-row').filter({ hasText: 'SaveNew One' });
  await row.getByTestId('row-actions').click();
  await page.getByTestId('row-edit').click();
  await page.locator('#field-Title').fill('Buyer');
  await saveModal(page);
  await expect(row.locator('td[data-field=Title]')).toHaveText('Buyer');

  const found = await (await api.post('/api/query', { data: { object: 'Lead', where: [{ field: 'Name', op: 'contains', value: 'SaveNew' }] } })).json();
  expect(found.records.map((r: { Title: string | null }) => r.Title).sort()).toEqual(['Buyer', null].sort());
  for (const lead of found.records) expect((await api.delete(`/api/sobjects/Lead/${lead.Id}`)).status()).toBe(204);
  expectHealthy(health);
});

test('the other list views open, sort and page in under a second with the expanded data', async ({ page, api, health }) => {
  const timings: Record<string, number> = {};
  for (const [tab, object, sortField] of [
    ['Accounts', 'Account', 'Name'],
    ['Contacts', 'Contact', 'Title'],
    ['Opportunities', 'Opportunity', 'Amount'],
    ['Tasks', 'Task', 'Subject'],
  ] as const) {
    await page.goto('/lightning/page/home');
    await page.waitForLoadState('networkidle');
    const total = (await (await api.post('/api/query', { data: { object, limit: 1 } })).json()).totalSize as number;
    expect(total, object).toBeGreaterThan(1000);

    let started = Date.now();
    await page.getByRole('link', { name: tab, exact: true }).click();
    await expect(page.getByTestId('list-meta')).toContainText(`${total.toLocaleString('en-US')} items`);
    timings[`open ${object}`] = Date.now() - started;

    started = Date.now();
    await page.getByTestId(`sort-${sortField}`).click();
    await expect(page.getByTestId('list-meta')).toContainText(`Sorted by`);
    await expect(page).toHaveURL(new RegExp(`sort=${sortField}`));
    await expect(page.getByTestId('data-row')).toHaveCount(50);
    timings[`sort ${object}`] = Date.now() - started;

    started = Date.now();
    await page.getByTestId('data-row').last().scrollIntoViewIfNeeded();
    await expect(page.getByTestId('data-row')).toHaveCount(100);
    timings[`next page ${object}`] = Date.now() - started;
  }
  console.log(`List timings (ms): ${JSON.stringify(timings)}`);
  for (const [action, ms] of Object.entries(timings)) expect(ms, action).toBeLessThan(1000);
  expectHealthy(health);
});

test('filter by any column and value, with equals, not equal to and contains', async ({ page, api, health }) => {
  const total = async (where: unknown[]) => (await (await api.post('/api/query', { data: { object: 'Lead', where: [{ field: 'IsConverted', op: 'eq', value: false }, ...where], limit: 1 } })).json()).totalSize as number;
  const addFilter = async (field: string, op: string, value: string, kind: 'select' | 'fill') => {
    await page.getByRole('button', { name: 'Add Filter' }).click();
    await page.locator('#filter-field').selectOption(field);
    await page.locator('#filter-operator').selectOption(op);
    if (kind === 'select') await page.locator('#filter-value').selectOption(value);
    else await page.locator('#filter-value').fill(value);
    await page.getByTestId('filter-done').click();
  };
  const count = (n: number) => `${n.toLocaleString('en-US')} item${n === 1 ? '' : 's'}`;

  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('toggle-filters').click();
  // Text column, contains.
  await addFilter('Company', 'contains', '0BAC', 'fill');
  await expect(page.getByTestId('filter-item')).toContainText('Company');
  await expect(page.getByTestId('filter-item')).toContainText('contains 0BAC');
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Save' }).click();
  const companyContains = await total([{ field: 'Company', op: 'contains', value: '0BAC' }]);
  expect(companyContains).toBeGreaterThan(0);
  await expect(page.getByTestId('list-meta')).toContainText(count(companyContains));
  await expect(page).toHaveURL(/filter=Company\.contains%3A0BAC/);
  const companies = await page.getByTestId('data-row').locator('td[data-field=Company]').allTextContents();
  expect(companies.every((c) => c.toUpperCase().includes('0BAC'))).toBe(true);

  // A picklist column with "not equal to", combined with the first filter.
  await page.getByTestId('toggle-filters').click();
  await addFilter('Rating', 'ne', 'Hot', 'select');
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('list-meta')).toContainText(count(await total([{ field: 'Company', op: 'contains', value: '0BAC' }, { field: 'Rating', op: 'ne', value: 'Hot' }])));

  // Reloading keeps the filters; Remove All clears them.
  await page.reload();
  await expect(page.getByTestId('list-meta')).toContainText('Filtered by');
  await page.getByTestId('toggle-filters').click();
  await expect(page.getByTestId('filter-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove All' }).click();
  // The owner column filters by user, chosen by name.
  const users = (await (await api.get('/api/users')).json()) as { Id: string; Name: string }[];
  const jon = users.find((u) => u.Name === 'Jon Santiago')!;
  await addFilter('OwnerId', 'eq', jon.Id, 'select');
  await expect(page.getByTestId('filter-item')).toContainText('equals Jon Santiago');
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('list-meta')).toContainText(count(await total([{ field: 'OwnerId', op: 'eq', value: jon.Id }])));

  // A number field with a typed value.
  await page.getByTestId('toggle-filters').click();
  await page.getByRole('button', { name: 'Remove All' }).click();
  const revenue = (await (await api.post('/api/query', { data: { object: 'Lead', where: [{ field: 'AnnualRevenue', op: 'notNull' }], limit: 1 } })).json()).records[0].AnnualRevenue as number;
  await addFilter('AnnualRevenue', 'eq', String(revenue), 'fill');
  await page.getByTestId('filter-panel').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('list-meta')).toContainText(count(await total([{ field: 'AnnualRevenue', op: 'eq', value: revenue }])));
  expectHealthy(health);
});
