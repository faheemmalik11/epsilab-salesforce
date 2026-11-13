import { expect, test } from '@playwright/test';

test('GUI renders SLDS, reads SQLite through the API, and makes only successful same-origin requests', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  const failed: string[] = [];
  const consoleErrors: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(origin) && !url.startsWith('data:')) external.push(url);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => failed.push(`failed ${req.url()}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

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

  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
