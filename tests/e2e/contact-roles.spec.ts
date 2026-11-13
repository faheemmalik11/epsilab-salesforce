import type { APIRequestContext, Page } from '@playwright/test';
import { checkByLabel, expect, expectHealthy, restCreate, saveModal, test } from './fixtures';

const rolesOf = async (api: APIRequestContext, opportunityId: string) => {
  const res = await api.post('/api/query', { data: { object: 'OpportunityContactRole', where: [{ field: 'OpportunityId', op: 'eq', value: opportunityId }] } });
  const records = (await res.json()).records as { Contact: { Name: string }; Role: string | null; IsPrimary: boolean }[];
  return records.map((r) => ({ contact: r.Contact.Name, role: r.Role, primary: r.IsPrimary })).sort((a, b) => a.contact.localeCompare(b.contact));
};

const selectContact = (page: Page, name: string) => checkByLabel(page.getByTestId('contact-roles-row').filter({ hasText: name }), `Select ${name}`);

test('Add Contact Roles: pick contacts, then set roles and the primary contact', async ({ page, api, health }) => {
  const accountId = await restCreate(api, 'Account', { Name: 'Roles Co' });
  const otherAccountId = await restCreate(api, 'Account', { Name: 'Elsewhere Co' });
  await restCreate(api, 'Contact', { FirstName: 'Ada', LastName: 'Rolesone', AccountId: accountId });
  await restCreate(api, 'Contact', { FirstName: 'Ben', LastName: 'Rolestwo', AccountId: accountId });
  await restCreate(api, 'Contact', { FirstName: 'Cy', LastName: 'Outsider', AccountId: otherAccountId });
  const opportunityId = await restCreate(api, 'Opportunity', { Name: 'Roles deal', AccountId: accountId, StageName: 'Prospecting', CloseDate: '2028-12-31' });
  const card = page.getByTestId('related-OpportunityContactRole');

  await page.goto(`/lightning/r/Opportunity/${opportunityId}/view`);
  await expect(card).toContainText('Contact Roles (0)');
  await page.getByTestId('related-new-OpportunityContactRole').click();

  // The first step lists the opportunity's account contacts; nothing can be saved until one is chosen.
  await expect(page.getByTestId('contact-roles-search')).toBeFocused();
  await expect(page.getByTestId('contact-roles-row')).toHaveCount(2);
  await expect(page.getByTestId('contact-roles-next')).toBeDisabled();
  await selectContact(page, 'Ada Rolesone');
  await selectContact(page, 'Ben Rolestwo');
  await expect(page.getByTestId('contact-roles-show-selected')).toHaveText('Show Selected (2)');

  // Searching reaches contacts of other accounts and keeps the selection.
  await page.getByTestId('contact-roles-search').fill('Outsider');
  await expect(page.getByTestId('contact-roles-row')).toHaveCount(1);
  await selectContact(page, 'Cy Outsider');
  await page.getByTestId('contact-roles-show-selected').click();
  await expect(page.getByTestId('contact-roles-row')).toHaveCount(3);
  await selectContact(page, 'Cy Outsider');
  await expect(page.getByTestId('contact-roles-row')).toHaveCount(2);

  await page.getByTestId('contact-roles-next').click();
  await expect(page.getByTestId('contact-roles-edit-row')).toHaveCount(2);
  await page.getByTestId('contact-roles-back').click();
  await expect(page.getByTestId('contact-roles-row')).toHaveCount(2);
  await page.getByTestId('contact-roles-next').click();

  await page.getByLabel('Role for Ada Rolesone').selectOption('Decision Maker');
  await page.locator('#contact-role-primary').click();
  await page.getByRole('option', { name: 'Ben Rolestwo' }).click();
  await expect(page.getByTestId('contact-role-primary-pill')).toHaveText(/Ben Rolestwo/);
  await saveModal(page);

  await expect(page.getByTestId('toast')).toContainText('2 contact roles were created.');
  await expect(card).toContainText('Contact Roles (2)');
  expect(await rolesOf(api, opportunityId)).toEqual([
    { contact: 'Ada Rolesone', role: 'Decision Maker', primary: false },
    { contact: 'Ben Rolestwo', role: null, primary: true },
  ]);

  // A second pass shows the current primary and can move it to an existing role.
  await restCreate(api, 'Contact', { FirstName: 'Dee', LastName: 'Rolesthree', AccountId: accountId });
  await page.getByTestId('related-new-OpportunityContactRole').click();
  await selectContact(page, 'Dee Rolesthree');
  await page.getByTestId('contact-roles-next').click();
  await expect(page.getByTestId('contact-role-primary-pill')).toHaveText(/Ben Rolestwo/);
  await page.getByRole('button', { name: 'Remove primary contact' }).click();
  await page.locator('#contact-role-primary').click();
  await page.getByRole('option', { name: 'Ada Rolesone' }).click();
  await saveModal(page);

  await expect(page.getByTestId('toast').last()).toContainText('Contact role was created.');
  await expect(card).toContainText('Contact Roles (3)');
  expect(await rolesOf(api, opportunityId)).toEqual([
    { contact: 'Ada Rolesone', role: 'Decision Maker', primary: true },
    { contact: 'Ben Rolestwo', role: null, primary: false },
    { contact: 'Dee Rolesthree', role: null, primary: false },
  ]);

  expectHealthy(health);
});

test('Add Contact Roles asks before discarding a selection', async ({ page, api, health }) => {
  const accountId = await restCreate(api, 'Account', { Name: 'Discard Co' });
  await restCreate(api, 'Contact', { LastName: 'Keeper', AccountId: accountId });
  const opportunityId = await restCreate(api, 'Opportunity', { Name: 'Discard deal', AccountId: accountId, StageName: 'Prospecting', CloseDate: '2028-12-31' });

  await page.goto(`/lightning/r/Opportunity/${opportunityId}/view`);
  await page.getByTestId('related-new-OpportunityContactRole').click();
  await selectContact(page, 'Keeper');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('discard-prompt')).toBeVisible();
  await page.getByTestId('discard-confirm').click();
  await expect(page.getByTestId('modal')).toHaveCount(0);
  await expect(page.getByTestId('related-OpportunityContactRole')).toContainText('Contact Roles (0)');

  expectHealthy(health);
});
