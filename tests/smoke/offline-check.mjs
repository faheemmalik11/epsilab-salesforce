// Runs inside the container started with --network none.
const api = 'http://127.0.0.1:8080';
const gui = 'http://127.0.0.1:3000';

async function ok(label, promise) {
  const res = await promise;
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res;
}

const health = await (await ok('api health', fetch(`${api}/api/health`))).json();
const html = await (await ok('gui index', fetch(`${gui}/`))).text();
const css = html.match(/assets\/index-[^"]+\.css/)?.[0];
await ok('gui css', fetch(`${gui}/${css}`));

const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' };
const mcp = await (await ok('mcp tools/call', fetch(`${api}/mcp`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'health', arguments: {} } }),
}))).text();
const payload = JSON.parse(mcp.split('\n').find((line) => line.startsWith('data: ')).slice(6));
if (JSON.stringify(payload.result.structuredContent) !== JSON.stringify(health)) {
  throw new Error('MCP and REST health differ');
}
console.log(`offline ok: fixture=${health.fixture} css=${css}`);
