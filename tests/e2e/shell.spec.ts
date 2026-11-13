import { expect, expectHealthy, restCount, restCreate, restGet, saveModal, test } from './fixtures';

const TABS = [
  ['Leads', 'Lead'],
  ['Accounts', 'Account'],
  ['Contacts', 'Contact'],
  ['Opportunities', 'Opportunity'],
  ['Tasks', 'Task'],
] as const;

test('navigation reaches every object list and the home page, with no errors', async ({ page, api, health }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/lightning\/page\/home$/);
  await expect(page.getByTestId('home-page')).toBeVisible();
  for (const [tab, object] of TABS) {
    const where = object === 'Lead' ? [{ field: 'IsConverted', op: 'eq', value: false }] : [];
    const total = await restCount(api, object, where);
    await page.getByRole('link', { name: tab, exact: true }).click();
    await expect(page.getByTestId('list-meta')).toContainText(`${total.toLocaleString('en-US')} item`);
    await expect(page.getByTestId('data-row').first()).toBeVisible();
  }
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  await page.getByTestId('record-link').first().click();
  await expect(page.getByTestId('record-page')).toBeVisible();
  await expect(page.getByTestId('related-Contact')).toBeVisible();
  expectHealthy(health);
});

test('Seller Home shows the six cards, with live pipeline and tasks and marked stubs', async ({ page, api, health }) => {
  await page.goto('/lightning/page/home');
  await expect(page.getByTestId('home-greeting')).toContainText("Let's get selling!");
  for (const card of ['build-pipeline', 'goals', 'events', 'todays-tasks', 'recent-records', 'salesblazer']) {
    await expect(page.getByTestId(`home-${card}`)).toBeVisible();
  }
  for (const card of ['goals', 'events', 'salesblazer']) {
    await expect(page.getByTestId(`home-${card}`).getByTestId('scope-label')).toHaveText('Not in scope');
  }
  const count = Number(await page.getByTestId('pipeline-count').locator('.pipeline__count').textContent({ timeout: 10_000 }));
  const leadId = await restCreate(api, 'Lead', { LastName: 'Pipeline', Company: 'Home Co' });
  const clock = await (await api.get('/api/admin/clock')).json();
  const taskId = await restCreate(api, 'Task', { Subject: 'Home task today', WhoId: leadId, ActivityDate: clock.today });
  await page.reload();
  await expect(page.getByTestId('pipeline-count')).toContainText(`${count + 1}`);
  await expect(page.getByTestId('pipeline-upcoming')).not.toContainText('…');
  await expect(page.getByTestId('home-todays-tasks').getByTestId('home-task').filter({ hasText: 'Home task today' })).toBeVisible();
  await expect(page.getByTestId('home-recent-records')).toContainText('Pipeline');
  expectHealthy(health);
  // Later tests count unconverted leads, so leave none behind.
  for (const [object, id] of [['Task', taskId], ['Lead', leadId]]) expect((await api.delete(`/api/sobjects/${object}/${id}`)).status()).toBe(204);
});

test('out-of-scope entry points are visibly marked as stubs', async ({ page, health }) => {
  await page.goto('/lightning/page/home');
  for (const name of ['Reports', 'Dashboards', 'Forecasts', 'Campaigns', 'Cases']) {
    const tab = page.getByRole('link', { name: new RegExp(`^${name}`) });
    await expect(tab).toHaveClass(/nav-stub/);
    await expect(tab.locator('[title]').first()).toHaveAttribute('title', `${name} is not in scope for this Salesforce clone`);
    await tab.click();
    await expect(page.getByTestId('stub-page')).toContainText(`${name}`);
    await expect(page.getByTestId('stub-page').getByTestId('scope-label')).toHaveText('Not in scope');
    await expect(page.getByTestId('stub-page')).toContainText('is not in scope for this Salesforce clone');
  }
  await expect(page.getByTestId('global-search-stub')).toBeDisabled();
  await expect(page.getByTestId('global-search-stub')).toHaveAttribute('title', 'Global search is not in scope for this Salesforce clone');
  // No page anywhere uses the old trial wording.
  await expect(page.getByText(/in this trial/i)).toHaveCount(0);
  expectHealthy(health);
});

test('the acting user switcher sets ownership and audit fields, and inactive users cannot be chosen', async ({ page, api, health }) => {
  await page.goto('/lightning/o/Account/list');
  await page.getByTestId('acting-user').click();
  await expect(page.getByRole('menuitemcheckbox', { name: /Christy Sanchez \(inactive\)/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitemcheckbox', { name: 'Jon Santiago' }).click();
  await expect(page.getByTestId('acting-user')).toContainText('Acting as: Jon Santiago');

  await page.getByTestId('new-record').click();
  await page.locator('#field-Name').fill('Owned By Jon');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('Owned By Jon');
  const id = page.url().match(/Account\/(\w{18})/)![1]!;
  const account = await restGet(api, 'Account', id);
  expect(account.Owner.Name).toBe('Jon Santiago');
  expect(account.CreatedBy.Name).toBe('Jon Santiago');
  await expect(page.getByTestId('highlight-OwnerId')).toHaveText('Jon Santiago');

  await page.reload();
  await expect(page.getByTestId('acting-user')).toContainText('Acting as: Jon Santiago');
  expectHealthy(health);
});

for (const width of [1280, 1440, 1920]) {
  test(`the list and record pages fit a ${width}px desktop without horizontal page scroll`, async ({ page, health }) => {
    await page.setViewportSize({ width, height: 900 });
    // The app scrolls inside .app-body, so check that container as well as the document.
    const noHorizontalScroll = () =>
      page.evaluate(() => {
        const body = document.querySelector('.app-body')!;
        return document.documentElement.scrollWidth <= window.innerWidth && body.scrollWidth <= body.clientWidth;
      });
    await page.goto('/lightning/page/home');
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('home-recent-record').first()).toBeVisible();
    // Let Home's card queries finish, so navigating away doesn't abort them.
    await page.waitForLoadState('networkidle');
    expect(await noHorizontalScroll(), 'home').toBe(true);
    for (const url of ['/lightning/o/Lead/list', '/lightning/o/Opportunity/list']) {
      await page.goto(url);
      await expect(page.getByTestId('data-row').first()).toBeVisible();
      expect(await noHorizontalScroll(), url).toBe(true);
    }
    await page.getByTestId('record-link').first().click();
    await expect(page.getByTestId('record-page')).toBeVisible();
    await expect(page.getByTestId('path')).toBeVisible();
    expect(await noHorizontalScroll(), 'record page').toBe(true);
    expectHealthy(health);
  });
}

test('the header and navigation bar keep the measurements taken in the org', async ({ page, health }) => {
  await page.setViewportSize({ width: 1854, height: 927 });
  await page.goto('/lightning/o/Lead/list');
  const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;

  const search = page.getByTestId('global-search-stub');
  expect((await search.boundingBox())!.width).toBe(592);
  expect((await search.boundingBox())!.height).toBe(32);
  await expect(search).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(search).toHaveCSS('border-top-color', 'rgb(92, 92, 92)');

  // The bar is 40px with 32px items; a tab's label is padded 12px and its 24px menu button sits 12px from the edge.
  expect((await box('.slds-context-bar')).height).toBe(40);
  const item = await box('[data-testid=nav-Lead]');
  const label = await box('[data-testid=nav-Lead] a span');
  const menu = await box('[data-testid=nav-chevron-Lead]');
  expect(item.height).toBe(32);
  expect(Math.round(label.x - item.x)).toBe(12);
  expect(Math.round(menu.x - (label.x + label.width))).toBe(12);
  expect(Math.round(item.x + item.width - (menu.x + menu.width))).toBe(12);
  expect(menu.width).toBe(24);
  const next = await box('[data-testid=nav-Account]');
  expect(Math.round(next.x - (item.x + item.width))).toBe(3);

  expectHealthy(health);
});
