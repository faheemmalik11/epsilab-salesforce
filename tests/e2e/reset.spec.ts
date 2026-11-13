import { expect, expectHealthy, fill, restCreate, saveModal, test } from './fixtures';

const HOT = { object: 'Lead', where: [{ field: 'IsConverted', op: 'eq', value: false }, { field: 'Rating', op: 'eq', value: 'Hot' }], limit: 1 };

test('AC6: edits through the GUI, REST and MCP are undone by a byte-identical reset in under 10 seconds', async ({ page, api, health }) => {
  const baseline = (await (await api.get('/api/admin/snapshots')).json()).snapshots.find((s: { name: string }) => s.name === 'baseline');
  await api.post('/api/admin/reset', { data: {} });

  // GUI: create and convert a lead, and change a seed lead's rating.
  await page.goto('/lightning/o/Lead/list');
  await page.getByTestId('new-record').click();
  await fill(page, 'LastName', 'Undo Me');
  await fill(page, 'Company', 'Reset Test Co');
  await saveModal(page);
  await expect(page.getByTestId('record-title')).toHaveText('Undo Me');
  const guiLeadUrl = page.url();
  await page.getByTestId('convert-lead').click();
  await page.getByTestId('convert-submit').click();
  await expect(page.getByTestId('convert-success')).toBeVisible();

  // REST and MCP edits on top.
  await restCreate(api, 'Account', { Name: 'REST Edit' });
  const seedHot = (await (await api.post('/api/query', { data: HOT })).json()).records[0];
  await api.patch(`/api/sobjects/Lead/${seedHot.Id}`, { data: { Rating: 'Cold' } });
  const mcp = await api.post('/mcp', {
    headers: { accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_record', arguments: { object: 'Contact', fields: { LastName: 'MCP Edit' } } } },
  });
  expect(await mcp.text()).toContain('"success":true');

  expect((await (await api.get('/api/admin/snapshots/baseline/verify')).json()).matches).toBe(false);
  expect((await (await api.post('/api/query', { data: HOT })).json()).totalSize).toBe(7110);

  const started = Date.now();
  const reset = await (await api.post('/api/admin/reset', { data: {} })).json();
  const elapsed = Date.now() - started;
  console.log(`Reset: ${reset.durationMs} ms in the server, ${elapsed} ms round trip`);
  expect(reset).toMatchObject({ snapshot: 'baseline', matches: true, sha256: baseline.sha256 });
  expect(elapsed).toBeLessThan(10_000);

  const verify = await (await api.get('/api/admin/snapshots/baseline/verify')).json();
  expect(verify).toMatchObject({ matches: true, contentMatches: true, sideFiles: [] });
  expect((await (await api.get('/api/mutations')).json()).mutations).toEqual([]);

  // The GUI sees the baseline again.
  await page.goto('/lightning/o/Lead/list?sort=Company&filter=Rating%3AHot');
  await expect(page.getByTestId('list-meta')).toContainText('7,111 items');
  await page.goto(guiLeadUrl);
  await expect(page.getByTestId('page-error-message')).toHaveText('The requested resource does not exist');

  expectHealthy(health, [/404 GET .*\/api\/sobjects\/Lead\//]);
});
