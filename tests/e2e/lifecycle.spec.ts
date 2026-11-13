import type { Page } from '@playwright/test';
import { checkByLabel, expect, expectHealthy, fill, pickLookup, restCount, restCreate, restGet, saveModal, test } from './fixtures';

const AMOUNT_MESSAGE = 'Amount is required for stages after Qualification.';

function recordId(page: Page): string {
  return page.url().match(/\/lightning\/r\/\w+\/(\w{18})\/view/)![1]!;
}

async function selectPathStep(page: Page, step: string) {
  await page.getByTestId(`path-step-${step}`).click();
  await page.getByTestId('path-action').click();
}

async function convertFromRecordPage(page: Page, options: { existingAccount?: string; noOpportunity?: boolean } = {}) {
  await page.getByTestId('convert-lead').click();
  const dialog = page.getByRole('dialog', { name: 'Convert Lead' });
  await expect(dialog).toBeVisible();
  if (options.existingAccount) {
    await checkByLabel(dialog, 'Choose Existing');
    await pickLookup(page, 'convert-account', options.existingAccount);
  }
  if (options.noOpportunity) await checkByLabel(dialog, "Don't create an opportunity upon conversion");
  await page.getByTestId('convert-submit').click();
}

test('L1-L5: a lead is created, worked, converted, progressed and Closed Won in the browser', async ({ page, api, health }) => {
  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('new-record').click();
  await fill(page, 'FirstName', 'Grace');
  await fill(page, 'LastName', 'Hopper');
  await fill(page, 'Company', 'Navy Compilers');
  await fill(page, 'Rating', 'Warm');
  await saveModal(page);
  await expect(page.getByTestId('toast')).toContainText('Lead "Grace Hopper" was created.');
  await expect(page.getByTestId('record-title')).toHaveText('Grace Hopper');
  const leadId = recordId(page);
  expect(await restGet(api, 'Lead', leadId)).toMatchObject({ Status: 'Open - Not Contacted', Company: 'Navy Compilers' });

  await page.locator('#call-comments').fill('Discussed compiler needs');
  await page.getByTestId('activity-save').click();
  await expect(page.getByTestId('timeline-item')).toHaveCount(1);
  await expect(page.getByTestId('timeline-item')).toContainText('Call');
  await expect(page.getByTestId('timeline-item')).toContainText('Completed');

  await selectPathStep(page, 'Working - Contacted');
  await expect(page.getByTestId('detail-Status')).toHaveText('Working - Contacted');

  await convertFromRecordPage(page);
  await expect(page.getByTestId('convert-success')).toBeVisible();
  const lead = await restGet(api, 'Lead', leadId);
  expect(lead).toMatchObject({ IsConverted: true, Status: 'Closed - Converted' });
  await page.getByTestId('converted-Opportunity').click();
  await expect(page.getByTestId('record-title')).toHaveText('Navy Compilers');
  const opportunityId = recordId(page);
  expect(opportunityId).toBe(lead.ConvertedOpportunityId);

  await page.getByTestId('path-action').click();
  await expect(page.getByTestId('detail-StageName')).toHaveText('Qualification');

  await selectPathStep(page, 'Needs Analysis');
  await expect(page.getByTestId('page-error-message')).toHaveText(AMOUNT_MESSAGE);
  await expect(page.getByTestId('detail-StageName')).toHaveText('Qualification');

  await page.getByTestId('edit-record').click();
  await fill(page, 'Amount', '50000');
  await fill(page, 'NextStep', 'Schedule demo');
  await saveModal(page);
  await expect(page.getByTestId('detail-NextStep')).toHaveText('Schedule demo');
  await selectPathStep(page, 'Needs Analysis');
  await expect(page.getByTestId('detail-StageName')).toHaveText('Needs Analysis');
  await expect(page.getByTestId('detail-Probability')).toHaveText('20%');

  await page.getByTestId('tab-related').click();
  await expect(page.getByTestId('related-OpportunityContactRole')).toContainText('Contact Roles (1)');
  await restCreate(api, 'Contact', { LastName: 'Backus', AccountId: lead.ConvertedAccountId });
  await page.getByTestId('related-new-OpportunityContactRole').click();
  await pickLookup(page, 'field-ContactId', 'Backus');
  await page.locator('#field-Role').selectOption('Economic Buyer');
  await checkByLabel(page.getByRole('dialog'), 'Primary');
  await saveModal(page);
  await expect(page.getByTestId('related-OpportunityContactRole')).toContainText('Contact Roles (2)');
  await expect(page.getByTestId('related-OpportunityContactRole')).toContainText('Economic Buyer');

  await page.getByTestId('composer-task').click();
  await page.locator('#task-subject').fill('Send proposal');
  await page.locator('#task-due').fill('2028-11-20');
  await page.getByTestId('activity-save').click();
  await expect(page.getByTestId('timeline-item').filter({ hasText: 'Send proposal' })).toBeVisible();

  await page.getByTestId('tab-details').click();
  await page.getByTestId('edit-record').click();
  await fill(page, 'NextStep', 'Sign contract');
  await saveModal(page);
  await expect(page.getByTestId('detail-NextStep')).toHaveText('Sign contract');

  await selectPathStep(page, '__closed');
  await page.locator('#close-stage').selectOption('Closed Won');
  await page.getByTestId('close-stage-save').click();
  await expect(page.getByTestId('detail-StageName')).toHaveText('Closed Won');
  expect(await restGet(api, 'Opportunity', opportunityId)).toMatchObject({
    StageName: 'Closed Won',
    IsClosed: true,
    IsWon: true,
    Probability: 100,
    ForecastCategoryName: 'Closed',
    NextStep: 'Sign contract',
    Amount: 50000,
  });

  await page.goto(`/lightning/r/Lead/${leadId}/view`);
  await expect(page.getByTestId('converted-banner')).toContainText('read-only');
  await expect(page.getByTestId('edit-record')).toHaveCount(0);
  await expect(page.getByTestId('convert-lead')).toHaveCount(0);
  await expect(page.getByTestId('path')).toHaveCount(0);
  await expect(page.getByTestId('converted-banner').getByRole('link', { name: 'Navy Compilers' })).toHaveCount(2);

  expectHealthy(health, [/400 PATCH .*\/api\/sobjects\/Opportunity\//]);
});

test('L3/L5: conversion into an existing account, then Closed Lost', async ({ page, api, health }) => {
  const accounts = await (await api.post('/api/query', { data: { object: 'Account', orderBy: [{ field: 'Name' }], limit: 1 } })).json();
  const account = accounts.records[0];
  const accountCount = await restCount(api, 'Account');
  const leadId = await restCreate(api, 'Lead', { LastName: 'Existing', Company: 'Existing Co Lead' });

  await page.goto(`/lightning/r/Lead/${leadId}/view`);
  await convertFromRecordPage(page, { existingAccount: account.Name });
  await expect(page.getByTestId('convert-success')).toBeVisible();
  expect(await restCount(api, 'Account')).toBe(accountCount);
  const lead = await restGet(api, 'Lead', leadId);
  expect(lead.ConvertedAccountId).toBe(account.Id);

  await page.getByTestId('converted-Opportunity').click();
  await page.getByTestId('edit-record').click();
  await fill(page, 'Amount', '9000');
  await saveModal(page);
  await expect(page.getByTestId('detail-Amount')).toHaveText('$9,000.00');
  await selectPathStep(page, '__closed');
  await page.locator('#close-stage').selectOption('Closed Lost');
  await page.getByTestId('close-stage-save').click();
  await expect(page.getByTestId('detail-StageName')).toHaveText('Closed Lost');
  expect(await restGet(api, 'Opportunity', lead.ConvertedOpportunityId)).toMatchObject({ IsClosed: true, IsWon: false, Probability: 0, ForecastCategoryName: 'Omitted' });
  expectHealthy(health);
});

test('L3: conversion without an opportunity', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'NoDeal', Company: 'No Deal Co' });
  await page.goto(`/lightning/r/Lead/${leadId}/view`);
  await convertFromRecordPage(page, { noOpportunity: true });
  await expect(page.getByTestId('convert-success')).toBeVisible();
  await expect(page.getByTestId('converted-Opportunity')).toHaveCount(0);
  await expect(page.getByTestId('converted-Account')).toBeVisible();
  expect(await restGet(api, 'Lead', leadId)).toMatchObject({ IsConverted: true, ConvertedOpportunityId: null });
  expectHealthy(health);
});

test('L3: a failed conversion shows the API error and leaves no partial records', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'Long', Company: 'L'.repeat(150) });
  const before = await Promise.all(['Account', 'Contact', 'Opportunity', 'OpportunityContactRole'].map((o) => restCount(api, o)));
  // The 150-character Company is valid for the account, then fails as the default opportunity name.
  const restError = await (await api.post(`/api/leads/${leadId}/convert`, { data: { convertedStatus: 'Closed - Converted' } })).json();
  expect(restError[0]).toMatchObject({ errorCode: 'STRING_TOO_LONG', fields: ['Name'] });

  await page.goto(`/lightning/r/Lead/${leadId}/view`);
  await convertFromRecordPage(page);
  await expect(page.getByTestId('page-error-message')).toHaveText(restError[0].message);
  await expect(page.getByRole('dialog', { name: 'Convert Lead' })).toBeVisible();

  expect(await Promise.all(['Account', 'Contact', 'Opportunity', 'OpportunityContactRole'].map((o) => restCount(api, o)))).toEqual(before);
  expect((await restGet(api, 'Lead', leadId)).IsConverted).toBe(false);
  expectHealthy(health, [/400 POST .*\/api\/leads\/.*\/convert/]);
});

test('L6: the direct path, Account then Contact then Opportunity, with no lead', async ({ page, api, health }) => {
  await page.goto('/lightning/o/Account/list');
  await page.getByTestId('new-record').click();
  await fill(page, 'Name', 'Direct Path Industries');
  await fill(page, 'Type', 'Prospect');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('Direct Path Industries');
  const accountId = recordId(page);

  await page.getByTestId('tab-related').click();
  await page.getByTestId('related-new-Contact').click();
  await expect(page.getByTestId('field-AccountId-pill')).toContainText('Direct Path Industries');
  await fill(page, 'FirstName', 'Dana');
  await fill(page, 'LastName', 'Direct');
  await saveModal(page);
  await expect(page.getByTestId('related-Contact')).toContainText('Contacts (1)');

  await page.getByTestId('related-new-Opportunity').click();
  await fill(page, 'Name', 'Direct Path - First Order');
  await fill(page, 'CloseDate', '2028-12-15');
  await fill(page, 'StageName', 'Prospecting');
  await saveModal(page);
  await expect(page.getByTestId('related-Opportunity')).toContainText('Opportunities (1)');

  await page.getByTestId('related-Opportunity').getByRole('link', { name: 'Direct Path - First Order' }).click();
  await expect(page.getByTestId('record-title')).toHaveText('Direct Path - First Order');
  const opportunity = await restGet(api, 'Opportunity', recordId(page));
  expect(opportunity).toMatchObject({ AccountId: accountId, StageName: 'Prospecting', Probability: 10 });
  expect(await restCount(api, 'Contact', [{ field: 'AccountId', op: 'eq', value: accountId }])).toBe(1);
  expectHealthy(health);
});
