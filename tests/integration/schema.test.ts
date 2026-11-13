import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextId, isValidId } from '../../src/server/db/ids.js';
import { OBJECTS } from '../../src/server/metadata/index.js';
import { createTestDb, type TestDb } from '../helpers.js';

describe('database schema', () => {
  let t: TestDb;
  beforeEach(() => (t = createTestDb()));
  afterEach(() => t.cleanup());

  it('creates one STRICT table per object with a column per field', () => {
    for (const object of OBJECTS) {
      const columns = (t.db.prepare(`PRAGMA table_info("${object.name}")`).all() as { name: string }[]).map((c) => c.name);
      expect(columns, object.name).toEqual(object.fields.map((f) => f.name));
      const { strict } = t.db.prepare('SELECT strict FROM pragma_table_list WHERE name = ?').get(object.name) as { strict: number };
      expect(strict, object.name).toBe(1);
    }
  });

  it('rejects values of the wrong storage type', () => {
    expect(() => t.db.prepare('INSERT INTO "Lead" ("Id", "NumberOfEmployees") VALUES (?, ?)').run('x', 'many')).toThrow();
  });

  it('constrains booleans to 0 and 1 with a 0 default', () => {
    t.db.prepare('INSERT INTO "Lead" ("Id") VALUES (?)').run('a');
    expect(t.db.prepare('SELECT "IsConverted" AS v FROM "Lead" WHERE "Id" = ?').get('a')).toEqual({ v: 0 });
    expect(() => t.db.prepare('INSERT INTO "Lead" ("Id", "IsConverted") VALUES (?, 2)').run('b')).toThrow(/CHECK/);
  });

  it('serves the All Leads Hot query from an index, without a temp sort', () => {
    const plan = (t.db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT "Id" FROM "Lead"
         WHERE "IsConverted" = 0 AND "Rating" = 'Hot'
         ORDER BY "Company" COLLATE NOCASE, "Id" LIMIT 50`,
      )
      .all() as { detail: string }[]).map((r) => r.detail).join(' | ');
    expect(plan).toMatch(/USING (COVERING )?INDEX lead_rating_company/);
    expect(plan).not.toContain('TEMP B-TREE');
  });

  it('serves the All Leads sort by Company from an index', () => {
    const plan = (t.db
      .prepare(`EXPLAIN QUERY PLAN SELECT "Id" FROM "Lead" WHERE "IsConverted" = 0 ORDER BY "Company" COLLATE NOCASE, "Id" LIMIT 50`)
      .all() as { detail: string }[]).map((r) => r.detail).join(' | ');
    expect(plan).toMatch(/USING (COVERING )?INDEX lead_company/);
    expect(plan).not.toContain('TEMP B-TREE');
  });
});

describe('nextId', () => {
  let t: TestDb;
  beforeEach(() => (t = createTestDb()));
  afterEach(() => t.cleanup());

  it('issues sequential valid IDs per key prefix', () => {
    const accounts = [nextId(t.db, '001'), nextId(t.db, '001'), nextId(t.db, '001')];
    const contact = nextId(t.db, '003');
    expect(new Set(accounts).size).toBe(3);
    [...accounts, contact].forEach((id) => expect(isValidId(id)).toBe(true));
    expect(accounts.every((id) => id.startsWith('001'))).toBe(true);
    expect(contact.startsWith('003')).toBe(true);
    expect(contact.slice(6, 15)).toBe(accounts[0]!.slice(6, 15));
  });

  it('is deterministic: a fresh database issues the same sequence', () => {
    const first = [nextId(t.db, '006'), nextId(t.db, '006')];
    const other = createTestDb();
    try {
      expect([nextId(other.db, '006'), nextId(other.db, '006')]).toEqual(first);
    } finally {
      other.cleanup();
    }
  });
});
