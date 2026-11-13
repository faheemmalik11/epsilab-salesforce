import type { Page } from '@playwright/test';
import { checkByLabel, expect, expectHealthy, pickLookup, restCount, restCreate, restGet, test } from './fixtures';

const openConvert = async (page: Page, leadId: string) => {
  await page.goto(`/lightning/r/Lead/${leadId}/view`);
  await page.getByTestId('convert-lead').click();
  const dialog = page.getByRole('dialog', { name: 'Convert Lead' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('Account Search is required only for Choose Existing Account, and Account Name only for Create New', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'Required', Company: 'Required Fields Co' });
  try {
    const accountsBefore = await restCount(api, 'Account');
    const dialog = await openConvert(page, leadId);
    await expect(dialog.getByTestId('account-name-required')).toBeVisible();
    // Account Name can't be edited (it is the lead's Company), so it is text, not an input.
    await expect(dialog.getByTestId('convert-account-name')).toHaveText('Required Fields Co');
    expect(await dialog.getByTestId('convert-account-name').evaluate((el) => el.tagName)).toBe('P');
    await expect(dialog.getByTestId('account-search-required')).toHaveCount(0);

    await checkByLabel(dialog, 'Choose Existing Account');
    await expect(dialog.getByTestId('account-search-required')).toBeVisible();
    await expect(dialog.getByTestId('account-name-required')).toHaveCount(0);

    // Convert without an account: the field asks for one and nothing is sent.
    let converts = 0;
    page.on('request', (request) => request.url().includes('/convert') && converts++);
    await page.getByTestId('convert-submit').click();
    await expect(dialog.getByTestId('field-error-convert-account')).toHaveText('Complete this field.');
    expect(converts).toBe(0);
    expect((await restGet(api, 'Lead', leadId)).IsConverted).toBe(false);

    // Switching to Create New clears the requirement and the error; switching back brings it back.
    await checkByLabel(dialog, 'Create New Account');
    await expect(dialog.getByTestId('field-error-convert-account')).toHaveCount(0);
    await expect(dialog.getByTestId('account-search-required')).toHaveCount(0);
    await checkByLabel(dialog, 'Choose Existing Account');
    await expect(dialog.getByTestId('field-error-convert-account')).toBeVisible();

    // Picking an account satisfies it.
    await pickLookup(page, 'convert-account', 'Roofing');
    await expect(dialog.getByTestId('field-error-convert-account')).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Convert Lead' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await restCount(api, 'Account')).toBe(accountsBefore);
    expect(converts).toBe(0);
  } finally {
    await api.delete(`/api/sobjects/Lead/${leadId}`);
  }
  expectHealthy(health);
});

test('Choose Existing Contact and Opportunity are disabled, labelled, and cannot change the conversion', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { FirstName: 'Una', LastName: 'Supported', Company: 'Unsupported Options Co' });
  const dialog = await openConvert(page, leadId);
  for (const [id, feature] of [
    ['contact-existing', 'Converting into an existing contact'],
    ['opportunity-existing', 'Converting into an existing opportunity'],
  ] as const) {
    const option = dialog.getByTestId(`${id}-unsupported`);
    await expect(option.locator(`#${id}`)).toBeDisabled();
    // A choice that can't be used has no input box.
    await expect(option.getByRole('textbox')).toHaveCount(0);
    await expect(option.getByTestId('scope-label')).toHaveText('Not in scope');
    await expect(option.getByTestId('scope-label')).toHaveAttribute('title', `${feature} is not in scope for this Salesforce clone`);
    // Clicking the option does nothing: it stays unchecked and the Create New choice stays selected.
    await option.locator('label').click({ force: true });
    await expect(option.locator(`#${id}`)).not.toBeChecked();
    expect(await option.locator('label').evaluate((el) => getComputedStyle(el).cursor)).toBe('default');
  }
  await expect(dialog.locator('#contact-new')).toBeChecked();
  await expect(dialog.locator('#opportunity-new')).toBeChecked();
  // The dialog has no warning boxes or trial wording.
  await expect(dialog.getByText(/in this trial|Stub/)).toHaveCount(0);

  await page.getByTestId('convert-submit').click();
  await expect(page.getByTestId('convert-success')).toBeVisible();
  const lead = await restGet(api, 'Lead', leadId);
  expect(lead.IsConverted).toBe(true);
  expect(lead.ConvertedContactId).toMatch(/^003/);
  expect((await restGet(api, 'Contact', lead.ConvertedContactId)).Name).toBe('Una Supported');
  expect(lead.ConvertedOpportunityId).toMatch(/^006/);
  expectHealthy(health);
});

test('the conversion works through an existing account, with and without an opportunity', async ({ page, api, health }) => {
  const account = (await (await api.post('/api/query', { data: { object: 'Account', orderBy: [{ field: 'Name' }], limit: 1, offset: 100 } })).json()).records[0];
  for (const createOpportunity of [true, false]) {
    const leadId = await restCreate(api, 'Lead', { LastName: `Existing ${createOpportunity}`, Company: account.Name });
    const dialog = await openConvert(page, leadId);
    await checkByLabel(dialog, 'Choose Existing Account');
    await pickLookup(page, 'convert-account', account.Name);
    if (!createOpportunity) await checkByLabel(dialog, "Don't create an opportunity upon conversion");
    await page.getByTestId('convert-submit').click();
    await expect(page.getByTestId('convert-success')).toBeVisible();
    const lead = await restGet(api, 'Lead', leadId);
    expect(lead.ConvertedAccountId).toBe(account.Id);
    expect((await restGet(api, 'Contact', lead.ConvertedContactId)).AccountId).toBe(account.Id);
    if (createOpportunity) expect((await restGet(api, 'Opportunity', lead.ConvertedOpportunityId)).AccountId).toBe(account.Id);
    else expect(lead.ConvertedOpportunityId).toBeNull();
  }
  expectHealthy(health);
});

test('a lead with no name shows a clear note instead of an empty contact pill', async ({ page, api, health }) => {
  const noName = (await (await api.post('/api/query', { data: { object: 'Lead', where: [{ field: 'Name', op: 'isNull' }], limit: 1 } })).json()).records[0];
  const dialog = await openConvert(page, noName.Id);
  await expect(dialog.getByTestId('convert-contact-name')).toHaveText('This lead has no last name. Add one to the lead before converting.');
  await page.getByTestId('modal-close').click();
  expect((await restGet(api, 'Lead', noName.Id)).IsConverted).toBe(false);
  expectHealthy(health);
});
