import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApiApp } from '../../src/server/app.js';
import { createTestDb, type TestDb } from '../helpers.js';

const manifest = JSON.parse(fs.readFileSync('seed/manifest.json', 'utf8'));

describe('REST API', () => {
  let t: TestDb;
  let app: FastifyInstance;

  beforeAll(async () => {
    t = createTestDb();
    app = await buildApiApp({ db: t.db, mcpAllowedHosts: ['localhost'] });
  });
  afterAll(async () => {
    await app.close();
    t.cleanup();
  });

  it('GET /api/health returns the fixture from SQLite', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', fixture: manifest.fixture });
  });

  it('returns the Salesforce error array for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual([{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }]);
  });
});
