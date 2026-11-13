import { expect, test } from '@playwright/test';

test('GUI renders SLDS, reads SQLite through the API, and makes no external requests', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin) && !url.startsWith('data:')) external.push(url);
  });

  await page.goto('/');
  await expect(page.getByTestId('fixture')).toHaveText('salesforce-seed-v4');

  const cardRadius = await page.getByTestId('health-card').evaluate((el) => getComputedStyle(el).borderRadius);
  expect(cardRadius).not.toBe('0px');

  const iconBox = await page.getByTestId('lead-icon').boundingBox();
  expect(iconBox?.width).toBeGreaterThan(0);
  const spriteResponse = await page.request.get(
    (await page.getByTestId('lead-icon').locator('use').getAttribute('href'))!.split('#')[0],
  );
  expect(spriteResponse.ok()).toBe(true);

  expect(external).toEqual([]);
});
