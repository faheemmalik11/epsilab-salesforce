import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { sha256File } from '../../../src/server/environment/snapshots.js';
import { ALL_LEADS_HOT, startHarness, type Harness } from '../../apiHarness.js';
import { cachedBaseline } from '../../baselines.js';

// Phase 8 against the Phase 7 dataset, for both SEED_PROFILEs: resets restore every table of the
// selected baseline, whatever changed and however many times, and the app keeps working afterwards.

const TABLES = ['Lead', 'User', 'Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task', 'id_sequence', 'mutation_log'];

/** Row counts per table of a baseline file, read independently of the app. */
function baselineCounts(file: string): Record<string, number> {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return Object.fromEntries(TABLES.map((t) => [t, (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n]));
  } finally {
    db.close();
  }
}

for (const profile of ['default', 'small']) {
  describe(`reset with the "${profile}" profile`, () => {
    let h: Harness;
    let client: Client;
    let expected: Record<string, number>;
    let baselineSha: string;
    beforeAll(async () => {
      h = await startHarness({ profile });
      client = await h.mcp();
      baselineSha = cachedBaseline(profile).sha256;
      expected = baselineCounts(cachedBaseline(profile).file);
    });
    afterAll(() => h.close());

    const counts = () => Object.fromEntries(TABLES.map((t) => [t, h.count(t)]));
    const tool = (name: string, args: Record<string, unknown> = {}) => h.tool(client, name, args);
    const first = async (object: string, where: unknown[] = []) => (await h.rest('POST', '/api/query', { object, where, limit: 1 })).body.records[0];

    /** Edits to seed and generated records through REST and MCP: creates, updates, deletes and a conversion. */
    async function editGeneratedAndSeed() {
      const opp = await first('Opportunity', [{ field: 'IsClosed', op: 'eq', value: false }]);
      await tool('update_opportunity_stage', { opportunityId: opp.Id, stageName: 'Closed Lost' });
      const role = await first('OpportunityContactRole');
      await tool('delete_record', { object: 'OpportunityContactRole', id: role.Id });
      const task = await first('Task', [{ field: 'IsClosed', op: 'eq', value: false }]);
      await h.rest('PATCH', `/api/sobjects/Task/${task.Id}`, { Status: 'Completed' });
      const contact = await first('Contact');
      await h.rest('PATCH', `/api/sobjects/Contact/${contact.Id}`, { Title: 'Changed by test' });
      const lead = (await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.records[0];
      await h.rest('PATCH', `/api/sobjects/Lead/${lead.Id}`, { Rating: 'Cold' });
      await tool('convert_lead', { leadId: (await first('Lead', [{ field: 'IsConverted', op: 'eq', value: false }, { field: 'LastName', op: 'notNull' }])).Id, convertedStatus: 'Closed - Converted' });
      await h.rest('POST', '/api/sobjects/Account', { Name: 'Added by test' });
    }

    it('starts on the profile baseline: the seed in full and that profile\'s generated volume', () => {
      expect(sha256File(h.dbFile)).toBe(baselineSha);
      expect(counts()).toEqual(expected);
      expect(expected).toMatchObject({ Lead: 21628, User: 9, mutation_log: 0 });
      const generated = cachedBaseline(profile).generated;
      expect(expected).toMatchObject({
        Account: generated.Account, Contact: generated.Contact, Opportunity: generated.Opportunity,
        OpportunityContactRole: generated.OpportunityContactRole, Task: generated.Task,
      });
    });

    it('restores every table after edits to seed and generated records, byte for byte, in under 10 seconds', async () => {
      await editGeneratedAndSeed();
      expect(counts()).not.toEqual(expected);
      expect((await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.totalSize).toBeLessThan(7111);

      const reset = await h.rest('POST', '/api/admin/reset', {});
      expect(reset.body).toMatchObject({ snapshot: 'baseline', sha256: baselineSha, matches: true });
      expect(reset.body.durationMs).toBeLessThan(10_000);
      expect(sha256File(h.dbFile)).toBe(baselineSha);
      expect(counts()).toEqual(expected);
      expect((await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.totalSize).toBe(7111);
      expect((await h.rest('GET', '/api/mutations?limit=10')).body.mutations).toEqual([]);
      const verify = (await h.rest('GET', '/api/admin/snapshots/baseline/verify')).body;
      expect(verify).toMatchObject({ matches: true, contentMatches: true, sideFiles: [] });
      for (const table of ['Lead', 'User', 'Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task']) {
        expect(verify.tables.find((t: { name: string }) => t.name === table), table).toMatchObject({ matches: true });
      }
    });

    it('gives the same hash on every reset, with edits in between', async () => {
      const hashes: string[] = [];
      const durations: number[] = [];
      for (let round = 0; round < 4; round++) {
        await h.rest('POST', '/api/sobjects/Account', { Name: `Round ${round}` });
        const reset = round % 2 === 0 ? (await h.rest('POST', '/api/admin/reset', {})).body : (await tool('reset_environment')).data;
        hashes.push(reset.sha256, sha256File(h.dbFile));
        durations.push(reset.durationMs);
      }
      expect(new Set(hashes)).toEqual(new Set([baselineSha]));
      expect(Math.max(...durations)).toBeLessThan(10_000);
    });

    it('serves concurrent reads and writes during a reset without failing, then resets cleanly', async () => {
      const contact = await first('Contact');
      const requests = [
        ...Array.from({ length: 10 }, (_, i) => h.rest('POST', '/api/sobjects/Account', { Name: `Concurrent ${i}` })),
        ...Array.from({ length: 10 }, () => h.rest('POST', '/api/query', ALL_LEADS_HOT)),
        h.rest('POST', '/api/admin/reset', {}),
        ...Array.from({ length: 5 }, () => h.rest('PATCH', `/api/sobjects/Contact/${contact.Id}`, { Department: 'Concurrent' })),
        tool('query_records', { object: 'Task', limit: 5 }).then((r) => ({ status: r.isError ? 500 : 200, body: r.data })),
      ];
      const results = await Promise.all(requests);
      expect(results.map((r) => r.status).filter((s) => ![200, 201, 204].includes(s))).toEqual([]);
      // Writes that landed after the reset are real changes; a quiet reset removes them.
      const reset = await h.rest('POST', '/api/admin/reset', {});
      expect(reset.body).toMatchObject({ sha256: baselineSha, matches: true });
      expect(counts()).toEqual(expected);
    });

    it('stays fully usable after a reset: REST, MCP and the lifecycle work, and a further reset restores again', async () => {
      await h.rest('POST', '/api/admin/reset', {});
      const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'After Reset', Company: 'After Reset Co' });
      expect(lead.status).toBe(201);
      expect((await h.rest('POST', '/api/tasks/log-call', { whoId: lead.body.id })).status).toBe(201);
      const converted = await tool('convert_lead', { leadId: lead.body.id, convertedStatus: 'Closed - Converted' });
      expect(converted.isError).toBe(false);
      const won = await tool('update_opportunity_stage', { opportunityId: converted.data.opportunityId, stageName: 'Closed Won', amount: 5000 });
      expect(won.data).toMatchObject({ IsWon: true });
      expect((await h.rest('GET', '/api/mutations?limit=100')).body.mutations.length).toBeGreaterThan(4);
      expect((await h.rest('POST', '/api/admin/reset', {})).body).toMatchObject({ sha256: baselineSha, matches: true });
      expect((await h.rest('GET', `/api/sobjects/Lead/${lead.body.id}`)).status).toBe(404);
    });
  });
}
