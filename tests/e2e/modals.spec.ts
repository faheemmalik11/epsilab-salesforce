import type { Page } from '@playwright/test';
import { expect, expectHealthy, restCreate, restGet, test } from './fixtures';

const dialog = (page: Page) => page.getByTestId('modal');

/** A point on the dimmed backdrop, left of the centred dialog. */
const clickBackdrop = (page: Page) => page.mouse.click(15, 450);

test('dialogs close on a backdrop click, Escape or the close button, and never on a click inside', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'Backdrop', Company: 'Backdrop Co' });
  try {
    await page.goto(`/lightning/r/Lead/${leadId}/view`);
    for (const close of ['backdrop', 'escape', 'button'] as const) {
      await page.getByTestId('edit-record').click();
      await expect(dialog(page)).toBeVisible();
      await page.getByRole('heading', { name: 'Edit Backdrop' }).click();
      await page.locator('#field-Title').click();
      await expect(dialog(page)).toBeVisible();
      if (close === 'backdrop') await clickBackdrop(page);
      else if (close === 'escape') await page.keyboard.press('Escape');
      else await page.getByTestId('modal-close').click();
      await expect(dialog(page), close).toHaveCount(0);
    }
  } finally {
    await api.delete(`/api/sobjects/Lead/${leadId}`);
  }
  expectHealthy(health);
});

test('unsaved changes ask before discarding, from the backdrop, Escape and the close button', async ({ page, api, health }) => {
  const leadId = await restCreate(api, 'Lead', { LastName: 'Unsaved', Company: 'Unsaved Co', Title: 'Original' });
  try {
    await page.goto(`/lightning/r/Lead/${leadId}/view`);
    await page.getByTestId('edit-record').click();
    await page.locator('#field-Title').fill('Changed');
    const prompt = page.getByTestId('discard-prompt');

    await clickBackdrop(page);
    await expect(prompt).toBeVisible();
    await page.getByTestId('discard-keep').click();
    await expect(prompt).toHaveCount(0);
    await expect(page.locator('#field-Title')).toHaveValue('Changed');

    await page.keyboard.press('Escape');
    await expect(prompt).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(prompt).toHaveCount(0);
    await expect(dialog(page)).toBeVisible();

    // Reverting the change makes the form clean again, so it closes without asking.
    await page.locator('#field-Title').fill('Original');
    await page.getByTestId('modal-close').click();
    await expect(prompt).toHaveCount(0);
    await expect(dialog(page)).toHaveCount(0);

    await page.getByTestId('edit-record').click();
    await page.locator('#field-Title').fill('Changed again');
    await page.getByTestId('modal-close').click();
    await expect(prompt).toBeVisible();
    await page.getByTestId('discard-confirm').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('detail-Title')).toHaveText('Original');
    expect((await restGet(api, 'Lead', leadId)).Title).toBe('Original');
  } finally {
    await api.delete(`/api/sobjects/Lead/${leadId}`);
  }
  expectHealthy(health);
});

for (const width of [1280, 1440, 1854]) {
  test(`the close button sits 40px above every dialog's header, right-aligned, at ${width}px`, async ({ page, api, health }) => {
    await page.setViewportSize({ width, height: 900 });
    const leadId = await restCreate(api, 'Lead', { LastName: 'Closepos', Company: 'Closepos Co' });
    const check = async (name: string) => {
      await expect(dialog(page)).toBeVisible();
      const [close, header] = await Promise.all([
        page.getByTestId('modal-close').boundingBox(),
        dialog(page).locator('.slds-modal__header').boundingBox(),
      ]);
      expect(close!.width, name).toBe(32);
      expect(Math.round(header!.y - close!.y), name).toBe(40);
      expect(Math.round(header!.x + header!.width - (close!.x + close!.width)), name).toBe(0);
      expect(close!.y, name).toBeGreaterThan(0);
      await page.getByTestId('modal-close').click();
      await expect(dialog(page)).toHaveCount(0);
    };
    try {
      await page.goto('/lightning/o/Lead/list');
      await page.getByTestId('new-record').click();
      await check('New Lead');
      await page.goto(`/lightning/r/Lead/${leadId}/view`);
      await page.getByTestId('edit-record').click();
      await check('Edit Lead');
      await page.getByTestId('convert-lead').click();
      await check('Convert Lead');
      await page.getByTestId('change-owner').click();
      await check('Change Owner');
      await page.getByTestId('more-actions').click();
      await page.getByTestId('more-delete').click();
      await check('Delete Lead');
      const opp = (await (await api.post('/api/query', { data: { object: 'Opportunity', where: [{ field: 'IsClosed', op: 'eq', value: false }], limit: 1 } })).json()).records[0];
      await page.goto(`/lightning/r/Opportunity/${opp.Id}/view`);
      await page.getByTestId('tab-related').click();
      await page.getByTestId('related-new-OpportunityContactRole').click();
      await check('Add Contact Roles');
      await page.getByTestId('path-step-__closed').click();
      await page.getByTestId('path-action').click();
      await check('Close stage');
    } finally {
      await api.delete(`/api/sobjects/Lead/${leadId}`);
    }
    expectHealthy(health);
  });
}

test('list table: only data column headers carry a divider, and headers line up with their cells', async ({ page, health }) => {
  await page.goto('/lightning/o/Lead/list');
  await expect(page.getByTestId('data-row').first()).toBeVisible();
  const header = page.locator('[data-testid=data-table] thead th');
  const cells = page.getByTestId('data-row').first().locator('td');
  const count = await header.count();
  expect(await cells.count()).toBe(count);

  const lines = await header.evaluateAll((ths) =>
    ths.map((th) => {
      const s = getComputedStyle(th);
      return { divider: s.boxShadow, left: s.borderLeftWidth, right: s.borderRightWidth, data: th.classList.contains('th-data') };
    }),
  );
  for (const [index, line] of lines.entries()) {
    expect(line.left, `header ${index} left border`).toBe('0px');
    expect(line.right, `header ${index} right border`).toBe('0px');
    if (line.data) expect(line.divider, `header ${index}`).toContain('inset');
    else expect(line.divider, `header ${index}`).toBe('none');
  }
  // Row number, checkbox and the actions column have no divider.
  expect(lines[0]!.data).toBe(false);
  expect(lines[1]!.data).toBe(false);
  expect(lines[count - 1]!.data).toBe(false);

  const cellLines = await cells.evaluateAll((tds) => tds.map((td) => [getComputedStyle(td).borderLeftWidth, getComputedStyle(td).borderRightWidth]));
  expect(cellLines.every(([l, r]) => l === '0px' && r === '0px')).toBe(true);

  for (let i = 0; i < count; i++) {
    const [h, c] = await Promise.all([header.nth(i).boundingBox(), cells.nth(i).boundingBox()]);
    expect(Math.abs(h!.x - c!.x), `column ${i} left`).toBeLessThan(1);
    expect(Math.abs(h!.width - c!.width), `column ${i} width`).toBeLessThan(1);
  }
  await page.getByTestId('data-row').first().locator('.cell-select label').click();
  await expect(page.getByTestId('list-meta')).toContainText('1 selected');
  expectHealthy(health);
});

test('the Edit title shows the record name, or "Edit Lead" when the lead has none', async ({ page, api, health }) => {
  const noName = (await (await api.post('/api/query', { data: { object: 'Lead', where: [{ field: 'Name', op: 'isNull' }], limit: 1 } })).json()).records[0];
  expect(noName, 'a seed lead without a name').toBeTruthy();
  const before = await restGet(api, 'Lead', noName.Id);
  await page.goto(`/lightning/r/Lead/${noName.Id}/view`);
  await page.getByTestId('edit-record').click();
  await expect(page.getByRole('dialog', { name: 'Edit Lead' })).toBeVisible();
  await expect(dialog(page).locator('.slds-modal__title')).toHaveText('Edit Lead');
  await page.getByTestId('modal-close').click();
  expect(await restGet(api, 'Lead', noName.Id)).toEqual(before);

  const named = await restCreate(api, 'Lead', { FirstName: 'Titled', LastName: 'Person', Company: 'Title Co' });
  try {
    await page.goto(`/lightning/r/Lead/${named}/view`);
    await page.getByTestId('edit-record').click();
    await expect(dialog(page).locator('.slds-modal__title')).toHaveText('Edit Titled Person');
  } finally {
    await page.getByTestId('modal-close').click();
    await api.delete(`/api/sobjects/Lead/${named}`);
  }
  expectHealthy(health);
});
