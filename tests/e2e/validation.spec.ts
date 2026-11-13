import { expect, expectHealthy, restCreate, saveModal, test } from './fixtures';

test('AC5a: saving a lead without required fields shows exactly the REST error', async ({ page, api, health }) => {
  const rest = await api.post('/api/sobjects/Lead', { data: { FirstName: 'Only' } });
  const restBody = await rest.json();
  expect(rest.status()).toBe(400);

  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('new-record').click();
  await page.locator('#field-FirstName').fill('Only');
  const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/sobjects/Lead') && r.request().method() === 'POST');
  await saveModal(page);
  const guiResponse = await responsePromise;

  expect(guiResponse.status()).toBe(400);
  expect(await guiResponse.json()).toEqual(restBody);
  await expect(page.getByTestId('page-error-message')).toHaveText([restBody[0].message]);
  expect(restBody[0]).toEqual({
    errorCode: 'REQUIRED_FIELD_MISSING',
    message: 'Required fields are missing: [LastName, Company]',
    fields: ['LastName', 'Company'],
  });
  await expect(page.getByTestId('field-error-LastName')).toHaveText('Complete this field.');
  await expect(page.getByTestId('field-error-Company')).toHaveText('Complete this field.');
  // Lightning's footer popover: the fields are links that move focus, and the icon button reopens it.
  const popover = page.getByTestId('page-error');
  await expect(popover).toContainText('We hit a snag.');
  await expect(popover.getByTestId('form-error-field')).toHaveText(['Name', 'Company']);
  await expect(page.locator('#field-LastName')).toHaveCSS('background-color', 'rgb(253, 221, 227)');
  await expect(page.locator('#field-LastName')).toHaveCSS('border-top-color', 'rgb(182, 5, 84)');
  await popover.getByTestId('form-error-field').last().click();
  await expect(page.locator('#field-Company')).toBeFocused();
  await popover.getByRole('button', { name: 'Close error dialog' }).click();
  await expect(popover).toHaveCount(0);
  await page.getByTestId('form-error-toggle').click();
  await expect(popover).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  expectHealthy(health, [/400 POST .*\/api\/sobjects\/Lead/]);
});

test('AC5b: moving an opportunity past Qualification without an Amount shows exactly the REST error', async ({ page, api, health }) => {
  const id = await restCreate(api, 'Opportunity', { Name: 'Validation Deal', StageName: 'Qualification', CloseDate: '2028-12-31' });
  const rest = await api.patch(`/api/sobjects/Opportunity/${id}`, { data: { StageName: 'Value Proposition' } });
  const restBody = await rest.json();

  await page.goto(`/lightning/r/Opportunity/${id}/view`);
  await page.getByTestId('path-step-Value Proposition').click();
  const responsePromise = page.waitForResponse((r) => r.url().endsWith(`/api/sobjects/Opportunity/${id}`) && r.request().method() === 'PATCH');
  await page.getByTestId('path-action').click();
  const guiResponse = await responsePromise;

  expect(guiResponse.status()).toBe(400);
  expect(await guiResponse.json()).toEqual(restBody);
  expect(restBody).toEqual([
    { errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Amount is required for stages after Qualification.', fields: ['Amount'] },
  ]);
  await expect(page.getByTestId('page-error-message')).toHaveText(restBody[0].message);
  await expect(page.getByTestId('detail-StageName')).toHaveText('Qualification');

  await page.getByTestId('edit-record').click();
  await page.locator('#field-StageName').selectOption('Closed Won');
  await saveModal(page);
  await expect(page.getByRole('dialog').getByTestId('page-error-message')).toHaveText(restBody[0].message);
  await expect(page.getByTestId('field-error-Amount')).toHaveText(restBody[0].message);
  expectHealthy(health, [/400 PATCH .*\/api\/sobjects\/Opportunity\//]);
});
