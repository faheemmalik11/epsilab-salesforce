import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/server/db/connection.js';
import { getHealth } from '../../src/server/services/health.js';
import { createTestDb, type TestDb } from '../helpers.js';

const manifest = JSON.parse(fs.readFileSync('seed/manifest.json', 'utf8'));

describe('getHealth', () => {
  let t: TestDb;
  beforeEach(() => (t = createTestDb()));
  afterEach(() => t.cleanup());

  it('reports the seed fixture and manifest counts', () => {
    expect(getHealth(t.db)).toMatchObject({
      status: 'ok',
      fixture: manifest.fixture,
      expectedLeads: manifest.counts.leads,
      expectedUsers: manifest.counts.users,
    });
  });

  it('reads without changing the database file', () => {
    const before = fs.readFileSync(t.file);
    getHealth(t.db);
    expect(fs.readFileSync(t.file).equals(before)).toBe(true);
  });
});

describe('openDatabase', () => {
  it('fails clearly when the database file is missing', () => {
    expect(() => openDatabase('/nonexistent/app.db')).toThrow(/Database not found/);
  });
});
