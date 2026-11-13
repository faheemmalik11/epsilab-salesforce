import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildGuiApp } from '../../src/server/app.js';
import { createTestDb, type TestDb } from '../helpers.js';

const NOT_FOUND = [{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }];

describe('GUI server', () => {
  let t: TestDb;
  let app: FastifyInstance;
  let webDir: string;

  beforeAll(async () => {
    t = createTestDb();
    webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-web-'));
    fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>app</title>');
    fs.mkdirSync(path.join(webDir, 'assets'));
    fs.writeFileSync(path.join(webDir, 'assets', 'app.js'), 'console.log(1)');
    app = await buildGuiApp({ db: t.db, mcpAllowedHosts: [], webDir });
  });
  afterAll(async () => {
    await app.close();
    t.cleanup();
    fs.rmSync(webDir, { recursive: true, force: true });
  });

  it('serves built assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(res.statusCode).toBe(200);
  });

  it('serves the app shell for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/lightning/o/Lead/list?filter=all' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('returns 404, not the app shell, for missing files', async () => {
    for (const url of ['/favicon.ico', '/assets/missing.js']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
      expect(res.json(), url).toEqual(NOT_FOUND);
    }
  });

  it('returns the same Salesforce error array as the API port for unknown API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual(NOT_FOUND);
  });

  it('serves the REST API on its own origin', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });
});
