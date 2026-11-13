import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_LEADS_HOT, startHarness, type Harness } from '../../apiHarness.js';

// Phase 7: the expanded dataset must stay fast. Every call goes through the real REST route,
// including relationship names, as the GUI makes it.

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
  // One warm-up request, as a running server would have had.
  await h.rest('POST', '/api/query', { object: 'Account', limit: 1 });
});
afterAll(() => h.close());

const LIMIT_MS = 1000;
const timed = async (body: unknown) => {
  const started = performance.now();
  const response = await h.rest('POST', '/api/query', body);
  const ms = performance.now() - started;
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return { ms, body: response.body as { totalSize: number; records: Record<string, unknown>[] } };
};

/** The GUI's list view request: 50 rows sorted by the view's column, with the same filters. */
const LIST_VIEWS = [
  { object: 'Lead', sort: 'Company', where: [{ field: 'IsConverted', op: 'eq', value: false }] },
  { object: 'Account', sort: 'Name', where: [] },
  { object: 'Contact', sort: 'Name', where: [] },
  { object: 'Opportunity', sort: 'Name', where: [] },
  { object: 'Opportunity', sort: 'CloseDate', where: [] },
  { object: 'Opportunity', sort: 'Amount', where: [{ field: 'StageName', op: 'eq', value: 'Negotiation/Review' }] },
  { object: 'Task', sort: 'ActivityDate', where: [] },
  { object: 'Task', sort: 'Subject', where: [{ field: 'IsClosed', op: 'eq', value: false }] },
];

describe('query performance with the expanded data', () => {
  it('AC2 still returns exactly 7,111 Hot leads sorted by Company, well under a second', async () => {
    const { ms, body } = await timed(ALL_LEADS_HOT);
    expect(body.totalSize).toBe(7111);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  for (const view of LIST_VIEWS) {
    it(`lists ${view.object} sorted by ${view.sort}, first page and a deep page, under a second`, async () => {
      for (const direction of ['asc', 'desc'] as const) {
        const first = await timed({ object: view.object, where: view.where, orderBy: [{ field: view.sort, direction }], limit: 50 });
        expect(first.ms).toBeLessThan(LIMIT_MS);
        expect(first.body.records.length).toBeGreaterThan(0);
        const deepOffset = Math.max(0, first.body.totalSize - 60);
        const deep = await timed({ object: view.object, where: view.where, orderBy: [{ field: view.sort, direction }], limit: 50, offset: deepOffset });
        expect(deep.ms).toBeLessThan(LIMIT_MS);
        expect(deep.body.records.length).toBeGreaterThan(0);
      }
    });
  }

  it('answers the record page relationship queries under a second', async () => {
    const account = (await timed({ object: 'Account', orderBy: [{ field: 'Name' }], limit: 1, offset: 900 })).body.records[0]!;
    const opp = (await timed({ object: 'Opportunity', where: [{ field: 'AccountId', op: 'eq', value: account.Id }], limit: 50 })).body.records[0];
    const contact = (await timed({ object: 'Contact', where: [{ field: 'AccountId', op: 'eq', value: account.Id }], limit: 50 })).body.records[0];
    const lead = (await timed({ object: 'Task', where: [{ field: 'WhoId', op: 'notNull' }], orderBy: [{ field: 'ActivityDate', direction: 'desc' }], limit: 1 })).body.records[0]!;
    const queries = [
      { object: 'Task', where: [{ field: 'WhatId', op: 'eq', value: account.Id }], orderBy: [{ field: 'ActivityDate', direction: 'desc' }], limit: 100 },
      { object: 'Task', where: [{ field: 'WhoId', op: 'eq', value: lead.WhoId }], orderBy: [{ field: 'ActivityDate', direction: 'desc' }], limit: 100 },
      ...(opp ? [
        { object: 'OpportunityContactRole', where: [{ field: 'OpportunityId', op: 'eq', value: opp.Id }], limit: 50 },
        { object: 'Task', where: [{ field: 'WhatId', op: 'eq', value: opp.Id }], limit: 100 },
      ] : []),
      ...(contact ? [{ object: 'OpportunityContactRole', where: [{ field: 'ContactId', op: 'eq', value: contact.Id }], limit: 50 }] : []),
      { object: 'Task', where: [{ field: 'OwnerId', op: 'eq', value: account.OwnerId }, { field: 'IsClosed', op: 'eq', value: false }], orderBy: [{ field: 'ActivityDate' }], limit: 200 },
      { object: 'Account', where: [{ field: 'Name', op: 'contains', value: 'Roofing' }], orderBy: [{ field: 'Name' }], limit: 5 },
    ];
    for (const query of queries) expect((await timed(query)).ms, JSON.stringify(query)).toBeLessThan(LIMIT_MS);
  });
});
