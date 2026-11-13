import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { startHarness, type Harness } from '../../apiHarness.js';
import { cachedBaseline } from '../../baselines.js';

// Reset to the seed alone, then generate the synthetic records on request: the result is the baseline's data.

const GENERATED = ['Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task'];
const DATA_TABLES = ['Lead', 'User', ...GENERATED];

/** Every row of a table in a stable order, to compare two databases by content. */
function rows(db: Database.Database, table: string): unknown[] {
  return db.prepare(`SELECT * FROM "${table}" ORDER BY "Id"`).all();
}

describe('seed-only reset and synthetic data generation', () => {
  let h: Harness;
  let client: Client;
  beforeAll(async () => {
    h = await startHarness({ profile: 'small' });
    client = await h.mcp();
  });
  afterAll(() => h.close());

  const counts = (tables: string[]) => Object.fromEntries(tables.map((t) => [t, h.count(t)]));

  it('starts on the baseline with generated data, where generating again is refused', async () => {
    expect((await h.rest('GET', '/api/admin/synthetic-data')).body).toEqual({ status: 'generated' });
    const before = counts(DATA_TABLES);
    const refused = await h.rest('POST', '/api/admin/synthetic-data', {});
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual([{ errorCode: 'SYNTHETIC_DATA_EXISTS', message: 'Synthetic data has already been generated. Reset to the seed-only snapshot first.' }]);
    expect(counts(DATA_TABLES)).toEqual(before);
  });

  it('lists the seed-only snapshot and refuses to overwrite it', async () => {
    const names = (await h.rest('GET', '/api/admin/snapshots')).body.snapshots.map((s: { name: string }) => s.name);
    expect(names.slice(0, 2)).toEqual(['baseline', 'seed-only']);
    for (const name of ['seed-only', 'seed-only-small', 'baseline-small']) {
      const response = await h.rest('POST', '/api/admin/snapshots', { name });
      expect(response.status, name).toBe(400);
      expect(response.body[0].errorCode).toBe('INVALID_SNAPSHOT');
    }
  });

  it('resets to the seed alone, byte-identical: 21,628 leads, 9 users and nothing generated', async () => {
    const reset = await h.rest('POST', '/api/admin/reset', { snapshot: 'seed-only' });
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ snapshot: 'seed-only', matches: true });
    expect(reset.body.durationMs).toBeLessThan(10_000);
    expect(counts([...DATA_TABLES, 'mutation_log'])).toEqual({ Lead: 21628, User: 9, Account: 0, Contact: 0, Opportunity: 0, OpportunityContactRole: 0, Task: 0, mutation_log: 0 });
    expect((await h.rest('GET', '/api/admin/snapshots/seed-only/verify')).body).toMatchObject({ matches: true, contentMatches: true });
    expect((await h.tool(client, 'get_synthetic_data_status')).data).toEqual({ status: 'none' });
  });

  it('generates the baseline data into an untouched seed, row for row, and only once', async () => {
    const result = await h.tool(client, 'generate_synthetic_data');
    expect(result.isError).toBe(false);
    const expected = cachedBaseline('small').generated;
    expect(result.data).toMatchObject({ status: 'generated', generated: expected });
    expect(counts([...DATA_TABLES, 'mutation_log'])).toEqual({ Lead: 21628, User: 9, ...expected, mutation_log: 0 });

    const baseline = new Database(cachedBaseline('small').file, { readonly: true });
    try {
      for (const table of DATA_TABLES) expect(rows(h.db, table), table).toEqual(rows(baseline, table));
    } finally {
      baseline.close();
    }

    const again = await h.tool(client, 'generate_synthetic_data');
    expect(again.isError).toBe(true);
    expect(again.data[0].errorCode).toBe('SYNTHETIC_DATA_EXISTS');
    expect(counts(GENERATED)).toEqual(expected);
  });

  it('keeps records added since the reset, and their log entries, when generating', async () => {
    await h.rest('POST', '/api/admin/reset', { snapshot: 'seed-only' });
    const added = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Kept', Company: 'Kept Co' });
    expect(added.status).toBe(201);

    const result = await h.rest('POST', '/api/admin/synthetic-data', {});
    expect(result.status).toBe(201);
    expect(result.body.status).toBe('generated');
    expect((await h.rest('GET', `/api/sobjects/Lead/${added.body.id}`)).body.LastName).toBe('Kept');
    expect(h.count('Lead')).toBe(21629);
    for (const table of GENERATED) expect(h.count(table), table).toBeGreaterThan(0);
    // Only the lead created by hand is in the log; generation is not history.
    expect(h.count('mutation_log')).toBe(1);
  });

  it('returns to the baseline with a reset', async () => {
    const reset = await h.rest('POST', '/api/admin/reset', {});
    expect(reset.body).toMatchObject({ snapshot: 'baseline', matches: true, sha256: cachedBaseline('small').sha256 });
    expect(h.count('Lead')).toBe(21628);
    expect((await h.rest('GET', '/api/admin/synthetic-data')).body).toEqual({ status: 'generated' });
  });
});
