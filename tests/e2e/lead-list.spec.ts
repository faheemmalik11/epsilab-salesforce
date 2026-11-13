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

  await expect(meta).toHaveText('7,111 items • Sorted by Company • Filtered by Rating');
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

test('the list view picker switches to My Leads and marks unsupported views as stubs', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  await expect(page.getByTestId('list-meta')).toContainText('21,628 items');
  await page.getByTestId('list-view-picker').click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('Recently Viewed')).toBeVisible();
  await expect(menu.getByTestId('stub-badge')).toHaveCount(2);
  await menu.getByText('My Leads').click();
  await expect(page.getByTestId('list-view-name')).toHaveText('My Leads');
  await expect(page.getByTestId('list-meta')).toContainText('0 items');
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
