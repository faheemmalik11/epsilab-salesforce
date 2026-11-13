import { expect, expectHealthy, restCreate, restGet, test } from './fixtures';

test('the lead page has the Lightning sections, in order, with the record values', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', {
    Salutation: 'Dr.', FirstName: 'Ada', LastName: 'Sections', Company: 'Sections Co', Title: 'CTO', Phone: '+1 212-555-0101',
    Email: 'ada@sections.example', Street: '1 Main St', City: 'Albany', State: 'New York', PostalCode: '12207', Country: 'United States',
    NumberOfEmployees: 42, AnnualRevenue: 1500000, LeadSource: 'Web', Industry: 'Construction', Rating: 'Warm',
  });
  try {
    await page.goto(`/lightning/r/Lead/${leadId}/view`);
    const details = page.getByTestId('record-details');
    await expect(details.locator('.slds-section__title')).toHaveText(['About', 'Get in Touch', 'Segment', 'History']);
    const labels = await details.locator('.detail-row > .slds-form-element__label').allTextContents();
    expect(labels).toEqual([
      'Lead Status', 'Name', 'Company', 'Title', 'Website', 'Description', 'Lead Owner', 'Rating',
      'Phone', 'Email', 'Address',
      'No. of Employees', 'Annual Revenue', 'Lead Source', 'Industry',
      'Created By', 'Last Modified By',
    ]);
    const lead = await restGet(api, 'Lead', leadId);
    await expect(page.getByTestId('detail-Name')).toHaveText('Dr. Ada Sections');
    await expect(page.getByTestId('detail-Address')).toHaveText('1 Main St Albany, New York 12207 United States');
    await expect(page.getByTestId('detail-NumberOfEmployees')).toHaveText('42');
    await expect(page.getByTestId('detail-AnnualRevenue')).toHaveText('$1,500,000.00');
    await expect(page.getByTestId('detail-CreatedBy')).toContainText(lead.CreatedBy.Name);
    await expect(page.getByTestId('detail-CreatedBy')).toContainText('11/11/2028');
    await expect(page.getByTestId('detail-LastModifiedBy')).toContainText(lead.LastModifiedBy.Name);
    // The lead page has no highlights row and no Details/Related tabs, as in Lightning.
    await expect(page.locator('.record-highlights__item')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);

    // The Address group edits in place, as one compound field.
    await page.getByTestId('inline-edit-Address').click();
    await expect(page.locator('#field-Street')).toBeFocused();
    await page.locator('#field-City').fill('Troy');
    await page.getByTestId('details-save').click();
    await expect(page.getByTestId('detail-Address')).toContainText('Troy, New York 12207');
    expect((await restGet(api, 'Lead', leadId)).City).toBe('Troy');
    // History has no pencil: audit fields can't be edited.
    await expect(page.getByTestId('inline-edit-CreatedBy')).toHaveCount(0);
  } finally {
    await api.delete(`/api/sobjects/Lead/${leadId}`);
  }
  expectHealthy(health);
});

test('the app sidebar navigates to supported apps and leaves the others inert and labelled', async ({ page, health }) => {
  await page.goto('/lightning/o/Opportunity/list');
  const sidebar = page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.locator('.app-sidebar__label')).toHaveText(['Home', 'Contacts', 'Accounts', 'Sales', 'Service', 'Marketing', 'Commerce', 'Your Account', 'Automation']);
  await expect(page.getByTestId('sidebar-Sales')).toHaveAttribute('aria-current', 'page');

  for (const [app, url, testId] of [
    ['Contacts', /\/lightning\/o\/Contact\/list/, 'list-view-name'],
    ['Accounts', /\/lightning\/o\/Account\/list/, 'list-view-name'],
    ['Home', /\/lightning\/page\/home/, 'home-page'],
    ['Sales', /\/lightning\/o\/Lead\/list/, 'list-view-name'],
  ] as const) {
    await page.getByTestId(`sidebar-${app}`).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByTestId(`sidebar-${app}`)).toHaveAttribute('aria-current', 'page');
  }

  for (const app of ['Service', 'Marketing', 'Commerce', 'YourAccount', 'Automation']) {
    const item = page.getByTestId(`sidebar-${app}`);
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toHaveAttribute('title', /is not in scope for this Salesforce clone/);
    // Playwright won't click an aria-disabled element unless forced; a user's click must do nothing.
    await item.click({ force: true });
    await expect(page).toHaveURL(/\/lightning\/o\/Lead\/list/);
  }
  const box = await sidebar.boundingBox();
  expect(box!.width).toBe(76);
  expect(box!.x).toBe(0);
  expectHealthy(health);
});

test('activity filters, Show All Activities, Refresh and Expand All work on the timeline', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'Timeline', Company: 'Timeline Co' });
  try {
    await restCreate(api, 'Task', { Subject: 'Old call', WhoId: leadId, TaskSubtype: 'Call', Type: 'Call', Status: 'Completed', ActivityDate: '2028-01-10' });
    await restCreate(api, 'Task', { Subject: 'Recent email', WhoId: leadId, TaskSubtype: 'Email', Type: 'Email', Status: 'Completed', ActivityDate: '2028-11-01' });
    await page.goto(`/lightning/r/Lead/${leadId}/view`);
    const timeline = page.getByTestId('activity-timeline');
    await expect(page.getByTestId('activity-filter-summary')).toHaveText('Filters: Within 2 months • All activities • All types');
    await expect(timeline.getByTestId('timeline-item')).toHaveText([/Recent email/]);
    await expect(page.getByTestId('activity-hidden')).toContainText("To change what's shown, try changing your filters.");
    await expect(page.getByTestId('timeline-group-upcoming').getByTestId('activity-empty')).toContainText('No activities to show.');

    await page.getByTestId('activity-show-all').click();
    await expect(timeline.getByTestId('timeline-item')).toHaveCount(2);
    await expect(page.getByTestId('activity-hidden')).toHaveCount(0);

    await page.getByTestId('activity-filter-button').click();
    await page.getByTestId('activity-filter-type-Call').click();
    await expect(page.getByTestId('activity-filter-summary')).toHaveText('Filters: All time • All activities • Calls');
    await expect(timeline.getByTestId('timeline-item')).toHaveText([/Old call/]);
    await page.getByTestId('activity-show-all').click();

    await page.getByTestId('activity-expand').click();
    await expect(page.getByTestId('activity-expand')).toHaveText('Expand All');
    await expect(timeline.getByTestId('timeline-item')).toHaveCount(0);
    await page.getByTestId('activity-expand').click();
    await expect(timeline.getByTestId('timeline-item')).toHaveCount(2);

    await restCreate(api, 'Task', { Subject: 'Made elsewhere', WhoId: leadId, ActivityDate: '2028-11-20' });
    await page.getByTestId('activity-refresh').click();
    await expect(page.getByTestId('timeline-group-upcoming').getByTestId('timeline-item')).toHaveText([/Made elsewhere/]);
  } finally {
    await api.delete(`/api/sobjects/Lead/${leadId}`);
  }
  expectHealthy(health);
});

test('account, contact and opportunity pages show details, activity and related lists side by side', async ({ page, api, health }) => {
  const opp = (await (await api.post('/api/query', { data: { object: 'Opportunity', where: [{ field: 'IsClosed', op: 'eq', value: false }], limit: 1 } })).json()).records[0];
  for (const url of [`/lightning/r/Opportunity/${opp.Id}/view`, `/lightning/r/Account/${opp.AccountId}/view`]) {
    await page.goto(url);
    const [details, activity, related] = await Promise.all([
      page.getByTestId('record-details').boundingBox(),
      page.getByTestId('activity-panel').boundingBox(),
      page.getByTestId('record-related').boundingBox(),
    ]);
    expect(details!.x).toBeLessThan(activity!.x);
    expect(activity!.x).toBeLessThan(related!.x);
    expect(Math.abs(details!.y - related!.y)).toBeLessThan(2);
    expect(Math.abs(details!.width - related!.width)).toBeLessThan(2);
  }
  await expect(page.getByTestId('related-Contact')).toBeVisible();
  expectHealthy(health);
});

test('detail and form sections collapse and expand on Lead, Contact, Account and Opportunity', async ({ page, api, health }) => {
  const accountId = await restCreate(api, 'Account', { Name: 'Collapse Co' });
  const ids = {
    Lead: await restCreate(api, 'Lead', { LastName: 'Collapse', Company: 'Collapse Co' }),
    Account: accountId,
    Contact: await restCreate(api, 'Contact', { LastName: 'Collapse', AccountId: accountId }),
    Opportunity: await restCreate(api, 'Opportunity', { Name: 'Collapse deal', AccountId: accountId, StageName: 'Prospecting', CloseDate: '2028-12-31' }),
  };
  for (const [object, id] of Object.entries(ids)) {
    // Wait for the icon sprite, so the next navigation doesn't abort its request.
    await page.goto(`/lightning/r/${object}/${id}/view`, { waitUntil: 'networkidle' });
    const sections = page.getByTestId('record-details').getByTestId('section');
    await expect(sections.first()).toBeVisible();
    for (let i = 0; i < (await sections.count()); i++) {
      const toggle = sections.nth(i).locator('.slds-section__title-action');
      const content = sections.nth(i).locator('.slds-section__content');
      await expect(toggle, `${object} section ${i}`).toHaveAttribute('aria-expanded', 'true');
      await expect(content).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(content).toBeHidden();
      await toggle.click();
      await expect(content).toBeVisible();
    }
  }

  await page.getByTestId('edit-record').click();
  const formSection = page.getByRole('dialog').getByTestId('section').first();
  await formSection.locator('.slds-section__title-action').click();
  await expect(formSection.locator('.slds-section__content')).toBeHidden();
  await formSection.locator('.slds-section__title-action').click();
  await expect(formSection.locator('.slds-section__content')).toBeVisible();

  expectHealthy(health);
});
