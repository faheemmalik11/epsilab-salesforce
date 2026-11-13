import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { buildApiApp } from '../src/server/app.js';
import { fixedClock } from '../src/server/clock.js';
import { buildDatabase } from '../src/server/db/build.js';
import { openDatabase, type Db } from '../src/server/db/connection.js';
import { SEED_DIR } from './helpers.js';

export const CLOCK = '2028-11-11T09:00:00Z';

export interface Harness {
  db: Db;
  dbFile: string;
  app: FastifyInstance;
  baseUrl: string;
  rest(method: string, url: string, body?: unknown, headers?: Record<string, string>): Promise<RestResponse>;
  mcp(): Promise<Client>;
  tool(client: Client, name: string, args?: Record<string, unknown>): Promise<ToolResult>;
  count(table: string): number;
  close(): Promise<void>;
}

export interface RestResponse {
  status: number;
  body: any;
}

export interface ToolResult {
  isError: boolean;
  data: any;
}

/** A real seeded database (21,628 leads) behind the API app, listening on a random local port. */
export async function startHarness(options: { defaultUserId?: string } = {}): Promise<Harness> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-api-'));
  const dbFile = path.join(dir, 'app.db');
  buildDatabase(dbFile, SEED_DIR, { profile: 'default', clock: CLOCK });
  const db = openDatabase(dbFile);
  const app = await buildApiApp({
    db,
    clock: fixedClock(CLOCK),
    defaultUserId: options.defaultUserId ?? null,
    mcpAllowedHosts: ['127.0.0.1', 'localhost'],
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (typeof address !== 'object' || !address) throw new Error('no address');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const clients: Client[] = [];

  return {
    db,
    dbFile,
    app,
    baseUrl,
    async rest(method, url, body, headers = {}) {
      const response = await fetch(baseUrl + url, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
    async mcp() {
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
      clients.push(client);
      return client;
    },
    async tool(client, name, args = {}) {
      const result = await client.callTool({ name, arguments: args });
      const data = result.structuredContent as any;
      return { isError: result.isError === true, data: result.isError ? data.errors : data };
    },
    count: (table) => (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n,
    async close() {
      await Promise.all(clients.map((c) => c.close()));
      await app.close();
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** The All Leads view filtered to Hot and sorted by Company: acceptance criterion #2. */
export const ALL_LEADS_HOT = {
  object: 'Lead',
  where: [
    { field: 'IsConverted', op: 'eq', value: false },
    { field: 'Rating', op: 'eq', value: 'Hot' },
  ],
  orderBy: [{ field: 'Company' }],
  limit: 50,
};
