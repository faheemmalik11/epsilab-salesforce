import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { sha256File } from '../../../src/server/environment/snapshots.js';
import { ALL_LEADS_HOT, startHarness, type Harness } from '../../apiHarness.js';

// AC6: "After a series of edits, a reset restores a snapshot byte-identical to the original, in under 10 seconds."

let h: Harness;
let client: Client;
let baselineSha: string;

beforeAll(async () => {
  h = await startHarness();
  client = await h.mcp();
  baselineSha = sha256File(path.join(h.snapshotDir, 'baseline-default.db'));
});
afterAll(() => h.close());

const tool = (name: string, args: Record<string, unknown> = {}) => h.tool(client, name, args);

/** A series of edits across every writable object, through both REST and MCP. */
async function editEverything() {
  const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Reset', Company: 'Reset Co', Rating: 'Hot' });
  await h.rest('POST', '/api/tasks/log-call', { whoId: lead.body.id });
  await h.rest('PATCH', `/api/sobjects/Lead/${lead.body.id}`, { Status: 'Working - Contacted' });
  const converted = await tool('convert_lead', { leadId: lead.body.id, convertedStatus: 'Closed - Converted' });
  await tool('update_opportunity_stage', { opportunityId: converted.data.opportunityId, stageName: 'Needs Analysis', amount: 1000 });
  const contact = await tool('create_record', { object: 'Contact', fields: { LastName: 'Second', AccountId: converted.data.accountId } });
  await tool('add_contact_role', { opportunityId: converted.data.opportunityId, contactId: contact.data.id, isPrimary: true });
  await h.rest('POST', '/api/sobjects/Task', { Subject: 'Follow up', WhatId: converted.data.opportunityId });
  const seedLead = (await h.rest('POST', '/api/query', { ...ALL_LEADS_HOT, limit: 1 })).body.records[0];
  await h.rest('PATCH', `/api/sobjects/Lead/${seedLead.Id}`, { Rating: 'Cold' });
  const account = await h.rest('POST', '/api/sobjects/Account', { Name: 'Doomed' });
  await tool('delete_record', { object: 'Account', id: account.body.id });
  // Generated records change too: a deal moves stage and a logged task is deleted.
  const deal = (await h.rest('POST', '/api/query', { object: 'Opportunity', where: [{ field: 'StageName', op: 'eq', value: 'Value Proposition' }], limit: 1 })).body.records[0];
  await tool('update_opportunity_stage', { opportunityId: deal.Id, stageName: 'Closed Won' });
  const task = (await h.rest('POST', '/api/query', { object: 'Task', where: [{ field: 'Status', op: 'eq', value: 'Completed' }], limit: 1 })).body.records[0];
  await h.rest('DELETE', `/api/sobjects/Task/${task.Id}`);
  return { seedLeadId: seedLead.Id as string, leadId: lead.body.id as string };
}

describe('reset after edits (AC6)', () => {
  it('REST: restores the baseline byte for byte in under 10 seconds and clears the mutation log', async () => {
    const { seedLeadId, leadId } = await editEverything();
    expect(sha256File(h.dbFile)).not.toBe(baselineSha);
    expect((await h.rest('GET', '/api/mutations?limit=1000')).body.mutations.length).toBeGreaterThan(10);
    expect((await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.totalSize).toBe(7110);

    const reset = await h.rest('POST', '/api/admin/reset', {});
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ snapshot: 'baseline', sha256: baselineSha, matches: true });
    expect(reset.body.durationMs).toBeLessThan(10_000);

    expect(sha256File(h.dbFile)).toBe(baselineSha);
    const verify = await h.rest('GET', '/api/admin/snapshots/baseline/verify');
    expect(verify.body).toMatchObject({ matches: true, actualSha256: baselineSha, sideFiles: [], contentMatches: true });
    expect(verify.body.tables.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(['Lead', 'Account', 'mutation_log']));

    expect((await h.rest('GET', '/api/mutations?limit=1000')).body.mutations).toEqual([]);
    expect((await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.totalSize).toBe(7111);
    expect(h.count('Lead')).toBe(21628);
    expect(h.count('User')).toBe(9);
    expect((await h.rest('GET', `/api/sobjects/Lead/${seedLeadId}`)).body.Rating).toBe('Hot');
    expect((await h.rest('GET', `/api/sobjects/Lead/${leadId}`)).status).toBe(404);
    expect(sha256File(h.dbFile)).toBe(baselineSha);
  });

  it('MCP: reset_environment does the same after another series of edits', async () => {
    await editEverything();
    const reset = await tool('reset_environment');
    expect(reset.isError).toBe(false);
    expect(reset.data).toMatchObject({ snapshot: 'baseline', sha256: baselineSha, matches: true });
    expect(reset.data.durationMs).toBeLessThan(10_000);
    expect((await tool('get_mutation_log', { limit: 1000 })).data.mutations).toEqual([]);
    expect([h.count('Lead'), h.count('User')]).toEqual([21628, 9]);
    const verify = await tool('verify_snapshot');
    expect(verify.data).toMatchObject({ matches: true, contentMatches: true, sideFiles: [] });
  });

  it('is repeatable: the same edits after a reset produce the same IDs, and reset again restores the baseline', async () => {
    const first = (await h.rest('POST', '/api/sobjects/Account', { Name: 'Same' })).body.id;
    await h.rest('POST', '/api/admin/reset', {});
    const second = (await h.rest('POST', '/api/sobjects/Account', { Name: 'Same' })).body.id;
    expect(second).toBe(first);
    expect((await h.rest('POST', '/api/admin/reset', {})).body.sha256).toBe(baselineSha);
  });

  it('keeps serving requests during a reset: concurrent reads all succeed and the result is still byte-identical', async () => {
    await h.rest('POST', '/api/sobjects/Account', { Name: 'Before concurrent reset' });
    const reads = Array.from({ length: 30 }, () => h.rest('POST', '/api/query', ALL_LEADS_HOT));
    const reset = h.rest('POST', '/api/admin/reset', {});
    const more = Array.from({ length: 30 }, () => h.rest('GET', '/api/users'));
    const results = await Promise.all([...reads, reset, ...more]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(sha256File(h.dbFile)).toBe(baselineSha);
  });
});

describe('named snapshots', () => {
  it('saves a checkpoint, restores it exactly, then returns to the baseline', async () => {
    await h.rest('POST', '/api/admin/reset', {});
    const kept = await h.rest('POST', '/api/sobjects/Account', { Name: 'Kept In Checkpoint' });
    const created = await h.rest('POST', '/api/admin/snapshots', { name: 'checkpoint' });
    expect(created.status).toBe(201);
    expect(created.body.sha256).toBe(sha256File(h.dbFile));

    const lost = await h.rest('POST', '/api/sobjects/Account', { Name: 'After Checkpoint' });
    const restored = await h.rest('POST', '/api/admin/reset', { snapshot: 'checkpoint' });
    expect(restored.body).toMatchObject({ snapshot: 'checkpoint', sha256: created.body.sha256, matches: true });
    expect((await h.rest('GET', `/api/sobjects/Account/${kept.body.id}`)).status).toBe(200);
    expect((await h.rest('GET', `/api/sobjects/Account/${lost.body.id}`)).status).toBe(404);
    expect((await h.rest('GET', '/api/admin/snapshots/checkpoint/verify')).body).toMatchObject({ matches: true, contentMatches: true });

    const listed = (await tool('list_snapshots')).data.snapshots.map((s: { name: string }) => s.name);
    expect(listed).toEqual(['baseline', 'seed-only', 'checkpoint']);
    expect((await h.rest('POST', '/api/admin/reset', {})).body.sha256).toBe(baselineSha);
  });

  it('reports a mismatch through verify after a write', async () => {
    await h.rest('POST', '/api/admin/reset', {});
    await h.rest('POST', '/api/sobjects/Account', { Name: 'Unsaved' });
    const verify = (await h.rest('GET', '/api/admin/snapshots/baseline/verify')).body;
    expect(verify.matches).toBe(false);
    expect(verify.contentMatches).toBe(false);
    expect(verify.tables.find((t: { name: string }) => t.name === 'Account').matches).toBe(false);
    expect(verify.tables.find((t: { name: string }) => t.name === 'Lead').matches).toBe(true);
    await h.rest('POST', '/api/admin/reset', {});
  });
});

describe('failure cases', () => {
  it('removes a stale journal and WAL left beside the database before restoring', async () => {
    await h.rest('POST', '/api/sobjects/Account', { Name: 'Stale' });
    fs.writeFileSync(`${h.dbFile}-journal`, Buffer.alloc(4096, 7));
    fs.writeFileSync(`${h.dbFile}-wal`, Buffer.alloc(4096, 9));
    const reset = await h.rest('POST', '/api/admin/reset', {});
    expect(reset.body).toMatchObject({ matches: true, sha256: baselineSha });
    expect(reset.body.removedSideFiles).toEqual(['app.db-journal', 'app.db-wal']);
    expect(fs.existsSync(`${h.dbFile}-journal`)).toBe(false);
    expect((await h.rest('GET', '/api/admin/snapshots/baseline/verify')).body).toMatchObject({ matches: true, sideFiles: [] });
    expect((await h.rest('POST', '/api/query', ALL_LEADS_HOT)).body.totalSize).toBe(7111);
  });

  it('refuses a corrupted snapshot and leaves the working database untouched', async () => {
    await h.rest('POST', '/api/admin/snapshots', { name: 'damaged' });
    const file = path.join(h.snapshotDir, 'damaged.db');
    const bytes = fs.readFileSync(file);
    bytes[bytes.length - 100] ^= 0xff;
    fs.writeFileSync(file, bytes);

    const account = await h.rest('POST', '/api/sobjects/Account', { Name: 'Survives' });
    const before = sha256File(h.dbFile);
    const reset = await h.rest('POST', '/api/admin/reset', { snapshot: 'damaged' });
    expect(reset.status).toBe(400);
    expect(reset.body[0]).toMatchObject({ errorCode: 'INVALID_SNAPSHOT' });
    expect(sha256File(h.dbFile)).toBe(before);
    expect((await h.rest('GET', `/api/sobjects/Account/${account.body.id}`)).status).toBe(200);
    await h.rest('POST', '/api/admin/reset', {});
  });

  it('rejects unknown, invalid and reserved snapshot names', async () => {
    expect((await h.rest('POST', '/api/admin/reset', { snapshot: 'nope' })).status).toBe(404);
    expect((await h.rest('POST', '/api/admin/reset', { snapshot: '../../etc' })).body[0].errorCode).toBe('INVALID_SNAPSHOT');
    expect((await h.rest('POST', '/api/admin/snapshots', { name: 'Bad Name' })).body[0].errorCode).toBe('INVALID_SNAPSHOT');
    expect((await h.rest('POST', '/api/admin/snapshots', { name: 'baseline' })).body[0].errorCode).toBe('INVALID_SNAPSHOT');
    expect((await h.rest('POST', '/api/admin/snapshots', {})).body[0].errorCode).toBe('REQUIRED_FIELD_MISSING');
    expect((await tool('reset_environment', { snapshot: 'nope' })).data[0].errorCode).toBe('NOT_FOUND');
  });
});

describe('clock', () => {
  it('reads and sets the app clock, which drives conversion dates; reset leaves the clock alone', async () => {
    expect((await h.rest('GET', '/api/admin/clock')).body).toMatchObject({ now: '2028-11-11T09:00:00.000Z', mode: 'fixed' });
    const set = await h.rest('POST', '/api/admin/clock', { start: '2029-02-10T12:00:00Z', mode: 'fixed' });
    expect(set.body).toMatchObject({ today: '2029-02-10', mode: 'fixed' });
    expect((await tool('get_clock')).data.today).toBe('2029-02-10');

    const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Clock', Company: 'Clock Co' });
    const converted = await h.rest('POST', `/api/leads/${lead.body.id}/convert`, { convertedStatus: 'Closed - Converted' });
    expect((await h.rest('GET', `/api/sobjects/Opportunity/${converted.body.opportunityId}`)).body.CloseDate).toBe('2029-03-31');

    await h.rest('POST', '/api/admin/reset', {});
    expect((await h.rest('GET', '/api/admin/clock')).body.today).toBe('2029-02-10');
    expect((await tool('set_clock', { start: '2028-11-11T09:00:00Z', mode: 'fixed' })).data.today).toBe('2028-11-11');
  });

  it('rejects an invalid clock without changing it', async () => {
    expect((await h.rest('POST', '/api/admin/clock', { start: 'yesterday' })).body[0]).toMatchObject({ errorCode: 'INVALID_FIELD', fields: ['start'] });
    expect((await h.rest('POST', '/api/admin/clock', { mode: 'sometimes' })).body[0]).toMatchObject({ errorCode: 'INVALID_FIELD', fields: ['mode'] });
    expect((await h.rest('GET', '/api/admin/clock')).body.today).toBe('2028-11-11');
  });
});
