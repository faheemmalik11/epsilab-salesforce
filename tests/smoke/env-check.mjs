// Runs on the host against a container started with non-default settings:
// GUI_PORT=4100, API_PORT=9180, SEED_PROFILE=small, CLOCK=2029-03-01T10:00:00Z, CLOCK_MODE=fixed.
// The expected baseline hash is passed in as argv[2], read from the image.
const [, , expectedSha] = process.argv;
const api = 'http://localhost:9180';
const gui = 'http://localhost:4100';
const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};
const json = async (url, init) => (await fetch(url, init)).json();
const post = (path, body) => json(api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const count = async (object, where = []) => (await post('/api/query', { object, where, limit: 1 })).totalSize;

const page = await fetch(gui + '/');
if (!page.ok || !(await page.text()).includes('<div id="root">')) fail('GUI is not served on GUI_PORT 4100');
console.log('ok GUI on 4100, REST and MCP on 9180');

const clock = await json(api + '/api/admin/clock');
if (clock.now !== '2029-03-01T10:00:00.000Z' || clock.mode !== 'fixed') fail(`clock is ${JSON.stringify(clock)}`);
await new Promise((resolve) => setTimeout(resolve, 1100));
if ((await json(api + '/api/admin/clock')).now !== clock.now) fail('CLOCK_MODE=fixed clock moved');
console.log(`ok CLOCK and CLOCK_MODE: fixed at ${clock.now}`);

const [leads, users, hot, accounts] = await Promise.all([
  count('Lead'), count('User'),
  count('Lead', [{ field: 'IsConverted', op: 'eq', value: false }, { field: 'Rating', op: 'eq', value: 'Hot' }]),
  count('Account'),
]);
if (leads !== 21628 || users !== 9 || hot !== 7111) fail(`seed counts ${leads}/${users}/${hot}`);
if (!(accounts > 0 && accounts < 500)) fail(`SEED_PROFILE=small should give a small generated set, got ${accounts} accounts`);
console.log(`ok SEED_PROFILE=small: 21628 leads, 9 users, 7111 Hot, ${accounts} accounts`);

const created = await post('/api/sobjects/Lead', { LastName: 'Env', Company: 'Env Co' });
const lead = await json(`${api}/api/sobjects/Lead/${created.id}`);
if (lead.CreatedDate !== '2029-03-01T10:00:00.000Z') fail(`CreatedDate ${lead.CreatedDate} does not come from CLOCK`);
console.log('ok new records take their dates from CLOCK');

const reset = await post('/api/admin/reset', {});
if (!reset.matches || reset.sha256 !== expectedSha) fail(`reset ${JSON.stringify(reset)} (expected ${expectedSha})`);
if ((await count('Lead')) !== 21628) fail('reset did not remove the new lead');
console.log(`ok reset to the small baseline ${reset.sha256.slice(0, 12)} in ${reset.durationMs} ms`);
