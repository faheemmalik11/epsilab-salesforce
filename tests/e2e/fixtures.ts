import { test as base, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { API_URL } from '../../playwright.config';

interface PageHealth {
  consoleErrors: string[];
  failedRequests: string[];
  externalRequests: string[];
}

/** Every test records console errors and failed requests; tests that expect API 400s allow them explicitly. */
export const test = base.extend<{ health: PageHealth; api: APIRequestContext }>({
  health: async ({ page, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    const health: PageHealth = { consoleErrors: [], failedRequests: [], externalRequests: [] };
    page.on('console', (msg) => msg.type() === 'error' && health.consoleErrors.push(msg.text()));
    page.on('pageerror', (error) => health.consoleErrors.push(error.message));
    page.on('response', (res) => res.status() >= 400 && health.failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`));
    page.on('requestfailed', (req) => health.failedRequests.push(`failed ${req.url()}`));
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(origin) && !url.startsWith('data:')) health.externalRequests.push(url);
    });
    await use(health);
  },
  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: API_URL });
    await use(context);
    await context.dispose();
  },
});

export { expect };

/** Asserts a clean session, allowing only the listed API failures (for tests that trigger validation errors). */
export function expectHealthy(health: PageHealth, allowedFailures: RegExp[] = []) {
  const allowed = (text: string) => allowedFailures.some((pattern) => pattern.test(text));
  expect(health.externalRequests).toEqual([]);
  expect(health.failedRequests.filter((f) => !allowed(f))).toEqual([]);
  // Chrome also logs each expected 4xx response to the console as "Failed to load resource".
  const allowedStatuses = new Set(allowedFailures.map((p) => p.source.match(/^(\d{3})/)?.[1]).filter(Boolean));
  const expectedLog = (e: string) => [...allowedStatuses].some((status) => e.includes(`status of ${status}`));
  expect(health.consoleErrors.filter((e) => !expectedLog(e))).toEqual([]);
}

export async function restCreate(api: APIRequestContext, object: string, fields: Record<string, unknown>): Promise<string> {
  const res = await api.post(`/api/sobjects/${object}`, { data: fields });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id;
}

export async function restGet(api: APIRequestContext, object: string, id: string) {
  return (await api.get(`/api/sobjects/${object}/${id}`)).json();
}

export async function restCount(api: APIRequestContext, object: string, where: unknown[] = []): Promise<number> {
  const res = await api.post('/api/query', { data: { object, where, limit: 1 } });
  return (await res.json()).totalSize;
}

/** Fills a record form field by its API name, whatever its input type. */
export async function fill(page: Page, field: string, value: string) {
  const input = page.locator(`#field-${field}`);
  const tag = await input.evaluate((el) => el.tagName);
  if (tag === 'SELECT') await input.selectOption(value);
  else await input.fill(value);
}

/** Picks a lookup value by typing part of its name and choosing the first match. */
export async function pickLookup(page: Page, inputId: string, text: string) {
  await page.locator(`#${inputId}`).click();
  await page.locator(`#${inputId}`).fill(text);
  await page.getByRole('option').filter({ hasText: text }).first().click();
}

/** SLDS hides the native checkbox or radio behind a styled one, so click its label as a user would. */
export async function checkByLabel(scope: Page | Locator, label: string) {
  await scope.locator('label', { hasText: label }).click();
}

export async function saveModal(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
}
