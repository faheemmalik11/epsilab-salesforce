import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { buildApiApp } from '../../src/server/app.js';
import { fixedClock } from '../../src/server/clock.js';
import { getHealth } from '../../src/server/services/health.js';
import { createTestDb, type TestDb } from '../helpers.js';

describe('MCP over Streamable HTTP', () => {
  let t: TestDb;
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    t = createTestDb();
    app = await buildApiApp({ db: t.db, clock: fixedClock('2028-11-11T09:00:00Z'), mcpAllowedHosts: ['localhost', '127.0.0.1'] });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (typeof address !== 'object' || !address) throw new Error('no address');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await app.close();
    t.cleanup();
  });

  async function connect(): Promise<Client> {
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
    return client;
  }

  it('lists the health tool', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('health');
    await client.close();
  });

  it('health tool returns the same data as the shared service', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'health', arguments: {} });
    expect(result.structuredContent).toEqual(getHealth(t.db));
    await client.close();
  });

  it('rejects requests whose Host header is not allowed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { host: 'evil.example', 'content-type': 'application/json' },
      payload: { jsonrpc: '2.0', id: 1, method: 'ping' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 405 for GET on the stateless endpoint', async () => {
    const res = await fetch(`${baseUrl}/mcp`);
    expect(res.status).toBe(405);
  });
});
