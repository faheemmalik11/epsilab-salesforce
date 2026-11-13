// Resets the running app through its API: `pnpm reset [snapshot]`, or inside the container
// `node dist/server/scripts/reset.js`. The server owns the database file, so the CLI never touches it.
const port = process.env.API_PORT || '8080';
const baseUrl = process.env.API_URL || `http://127.0.0.1:${port}`;
const snapshot = process.argv[2];

const response = await fetch(`${baseUrl}/api/admin/reset`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(snapshot ? { snapshot } : {}),
});
const result = (await response.json()) as { matches?: boolean };
console.log(JSON.stringify(result, null, 2));
if (!response.ok || !result.matches) process.exit(1);
