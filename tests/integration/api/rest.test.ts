import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_LEADS_HOT, startHarness, type Harness } from '../../apiHarness.js';
import { readSeed } from '../../seed.js';

let h: Harness;
let jon: string;
let christy: string;
beforeAll(async () => {
  h = await startHarness();
  const users = (await h.rest('GET', '/api/users')).body as { Id: string; Name: string }[];
  jon = users.find((u) => u.Name === 'Jon Santiago')!.Id;
  christy = users.find((u) => u.Name === 'Christy Sanchez')!.Id;
});
afterAll(() => h.close());

const AMOUNT_ERROR = [
  { errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Amount is required for stages after Qualification.', fields: ['Amount'] },
];

describe('All Leads, Hot, sorted by Company (AC2 over REST)', () => {
  it('returns exactly 7,111 leads sorted by Company, in under a second', async () => {
    const started = performance.now();
    const res = await h.rest('POST', '/api/query', ALL_LEADS_HOT);
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(res.body.totalSize).toBe(7111);
    expect(res.body.records).toHaveLength(50);
    const companies = res.body.records.map((r: { Company: string }) => r.Company.toLowerCase());
    expect(companies).toEqual([...companies].sort());
    expect(res.body.records.every((r: { Rating: string; IsConverted: boolean }) => r.Rating === 'Hot' && !r.IsConverted)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it('pages through the same sorted result', async () => {
    const page2 = await h.rest('POST', '/api/query', { ...ALL_LEADS_HOT, offset: 50 });
    const first100 = await h.rest('POST', '/api/query', { ...ALL_LEADS_HOT, limit: 100 });
    expect(page2.body.records.map((r: { Id: string }) => r.Id)).toEqual(first100.body.records.slice(50).map((r: { Id: string }) => r.Id));
  });

  it('counts every lead in All Leads', async () => {
    const res = await h.rest('POST', '/api/query', { object: 'Lead', where: [{ field: 'IsConverted', op: 'eq', value: false }], limit: 1 });
    expect(res.body.totalSize).toBe(21628);
  });
});

describe('records and metadata', () => {
  it('returns a seed lead by its original ID with Salesforce attributes', async () => {
    const seedLead = readSeed('leads.csv')[0]!;
    const res = await h.rest('GET', `/api/sobjects/Lead/${seedLead['Lead ID']}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      attributes: { type: 'Lead', url: `/api/sobjects/Lead/${seedLead['Lead ID']}` },
      Id: seedLead['Lead ID'],
      Company: seedLead['Company / Account'],
      OwnerId: jon,
    });
  });

  it('lists objects and describes fields with picklists', async () => {
    const objects = await h.rest('GET', '/api/sobjects');
    expect(objects.body.sobjects.map((o: { name: string }) => o.name)).toContain('OpportunityContactRole');
    const lead = await h.rest('GET', '/api/sobjects/Lead/describe');
    const status = lead.body.fields.find((f: { name: string }) => f.name === 'Status');
    expect(status.picklistValues.map((v: { value: string }) => v.value)).toContain('Working - Contacted');
    expect(lead.body.fields.find((f: { name: string }) => f.name === 'LastName').required).toBe(true);
  });

  it('lists the nine users', async () => {
    expect(((await h.rest('GET', '/api/users')).body as unknown[]).length).toBe(9);
  });
});

describe('lead lifecycle over REST (L1 to L5)', () => {
  it('creates, works, converts, progresses and closes a deal', async () => {
    const created = await h.rest('POST', '/api/sobjects/Lead', {
      FirstName: 'Grace',
      LastName: 'Hopper',
      Company: 'Cobol Systems',
      Rating: 'Warm',
      LeadSource: 'Web',
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.stringMatching(/^00Q/), success: true, errors: [] });
    const leadId = created.body.id;

    const call = await h.rest('POST', '/api/tasks/log-call', { whoId: leadId, description: 'Intro call' });
    expect(call.status).toBe(201);
    const task = await h.rest('GET', `/api/sobjects/Task/${call.body.id}`);
    expect(task.body).toMatchObject({ Status: 'Completed', TaskSubtype: 'Call', WhoId: leadId, IsClosed: true });

    expect((await h.rest('PATCH', `/api/sobjects/Lead/${leadId}`, { Status: 'Working - Contacted' })).status).toBe(204);
    expect((await h.rest('GET', `/api/sobjects/Lead/${leadId}`)).body.Status).toBe('Working - Contacted');

    const converted = await h.rest('POST', `/api/leads/${leadId}/convert`, { convertedStatus: 'Closed - Converted' });
    expect(converted.status).toBe(200);
    const { accountId, contactId, opportunityId } = converted.body;
    expect((await h.rest('GET', `/api/sobjects/Lead/${leadId}`)).body).toMatchObject({ IsConverted: true, Status: 'Closed - Converted' });

    const locked = await h.rest('PATCH', `/api/sobjects/Lead/${leadId}`, { Title: 'CTO' });
    expect(locked).toEqual({ status: 400, body: [{ errorCode: 'CANNOT_UPDATE_CONVERTED_LEAD', message: 'A converted lead cannot be updated.' }] });

    expect(await h.rest('PATCH', `/api/sobjects/Opportunity/${opportunityId}`, { StageName: 'Needs Analysis' })).toEqual({
      status: 400,
      body: AMOUNT_ERROR,
    });
    expect((await h.rest('PATCH', `/api/sobjects/Opportunity/${opportunityId}`, { StageName: 'Needs Analysis', Amount: 120000 })).status).toBe(204);

    const second = await h.rest('POST', '/api/sobjects/Contact', { LastName: 'Backus', AccountId: accountId });
    const role = await h.rest('POST', '/api/sobjects/OpportunityContactRole', {
      OpportunityId: opportunityId,
      ContactId: second.body.id,
      Role: 'Economic Buyer',
      IsPrimary: true,
    });
    expect(role.status).toBe(201);
    const roles = await h.rest('POST', '/api/query', {
      object: 'OpportunityContactRole',
      where: [{ field: 'OpportunityId', op: 'eq', value: opportunityId }],
    });
    expect(roles.body.records.map((r: { ContactId: string }) => r.ContactId).sort()).toEqual([contactId, second.body.id].sort());

    expect((await h.rest('POST', '/api/sobjects/Task', { Subject: 'Send proposal', WhatId: opportunityId, ActivityDate: '2028-11-20' })).status).toBe(201);
    expect((await h.rest('PATCH', `/api/sobjects/Opportunity/${opportunityId}`, { StageName: 'Proposal/Price Quote', NextStep: 'Legal review' })).status).toBe(204);
    expect((await h.rest('PATCH', `/api/sobjects/Opportunity/${opportunityId}`, { StageName: 'Closed Won' })).status).toBe(204);

    expect((await h.rest('GET', `/api/sobjects/Opportunity/${opportunityId}`)).body).toMatchObject({
      StageName: 'Closed Won',
      IsClosed: true,
      IsWon: true,
      Probability: 100,
      ForecastCategoryName: 'Closed',
      NextStep: 'Legal review',
      Amount: 120000,
    });
  });

  it('converts into an existing generated account', async () => {
    const accounts = await h.rest('POST', '/api/query', { object: 'Account', orderBy: [{ field: 'Name' }], limit: 1 });
    const account = accounts.body.records[0];
    const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Existing', Company: 'Ignored For Existing' });
    const converted = await h.rest('POST', `/api/leads/${lead.body.id}/convert`, {
      convertedStatus: 'Closed - Converted',
      accountId: account.Id,
      doNotCreateOpportunity: true,
    });
    expect(converted.body).toMatchObject({ accountId: account.Id, opportunityId: null });
    expect((await h.rest('GET', `/api/sobjects/Account/${account.Id}`)).body.Name).toBe(account.Name);
  });
});

describe('direct path over REST (L6)', () => {
  it('creates an account, contact and opportunity with no lead', async () => {
    const account = await h.rest('POST', '/api/sobjects/Account', { Name: 'Direct Path Inc' });
    const contact = await h.rest('POST', '/api/sobjects/Contact', { LastName: 'Direct', AccountId: account.body.id });
    const opp = await h.rest('POST', '/api/sobjects/Opportunity', {
      Name: 'Direct Path Inc - New',
      AccountId: account.body.id,
      StageName: 'Prospecting',
      CloseDate: '2028-12-31',
    });
    expect([account.status, contact.status, opp.status]).toEqual([201, 201, 201]);
    expect((await h.rest('GET', `/api/sobjects/Opportunity/${opp.body.id}`)).body).toMatchObject({ AccountId: account.body.id, Probability: 10 });
  });
});

describe('errors over REST', () => {
  it('reports missing required fields with the exact service error', async () => {
    expect(await h.rest('POST', '/api/sobjects/Lead', { FirstName: 'NoLast' })).toEqual({
      status: 400,
      body: [{ errorCode: 'REQUIRED_FIELD_MISSING', message: 'Required fields are missing: [LastName, Company]', fields: ['LastName', 'Company'] }],
    });
  });

  it('rejects invalid references', async () => {
    const res = await h.rest('POST', '/api/sobjects/Contact', { LastName: 'X', AccountId: '001SB0000000999AAA' });
    expect(res.status).toBe(400);
    expect(res.body[0].errorCode).toBe('MALFORMED_ID');
    const lead = readSeed('leads.csv')[0]!['Lead ID'];
    const wrong = await h.rest('POST', '/api/sobjects/Contact', { LastName: 'X', AccountId: lead });
    expect(wrong.body).toEqual([expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['AccountId'] })]);
  });

  it('returns 404 for unknown objects and records', async () => {
    const notFound = [{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }];
    expect(await h.rest('GET', '/api/sobjects/Widget/00QSB0000000001AAA')).toEqual({ status: 404, body: notFound });
    expect(await h.rest('GET', '/api/sobjects/Lead/00QSB000000ZZZZAAA')).toEqual({ status: 404, body: notFound });
    expect((await h.rest('POST', '/api/query', { object: 'Widget' })).status).toBe(404);
  });

  it('rejects malformed JSON, non-object bodies and Id in the body', async () => {
    const bad = await h.rest('POST', '/api/sobjects/Lead', '{"LastName":');
    expect(bad.status).toBe(400);
    expect(bad.body[0].errorCode).toBe('JSON_PARSER_ERROR');
    expect((await h.rest('POST', '/api/sobjects/Lead', '[1,2]')).body[0].errorCode).toBe('JSON_PARSER_ERROR');
    expect((await h.rest('POST', '/api/sobjects/Account', { Id: '001SB0000000001YAA', Name: 'X' })).body).toEqual([
      { errorCode: 'INVALID_FIELD', message: 'The Id field should not be specified in the sobject data.', fields: ['Id'] },
    ]);
  });

  it('refuses writes to users', async () => {
    expect((await h.rest('DELETE', `/api/sobjects/User/${jon}`)).body[0].errorCode).toBe('INSUFFICIENT_ACCESS_OR_READONLY');
    expect(h.count('User')).toBe(9);
  });

  // Conversion writes the Account, then the Contact, then the Opportunity and its contact role, in one
  // transaction. Both failure points below are reachable through ordinary input, with no test hooks.
  const conversionState = () => ({
    rows: ['Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Lead', 'mutation_log'].map((t) => h.count(t)),
    counters: h.db.prepare('SELECT * FROM id_sequence ORDER BY key_prefix').all(),
  });

  it('rolls back completely when conversion fails at the Opportunity step, after the Account and Contact were written', async () => {
    // 150 characters is valid for a lead's Company and an Account Name (255) but not for the Opportunity
    // Name it defaults to (120), so the failure comes after the account and contact inserts.
    const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Long', Company: 'C'.repeat(150) });
    const before = conversionState();
    const res = await h.rest('POST', `/api/leads/${lead.body.id}/convert`, { convertedStatus: 'Closed - Converted' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual([{ errorCode: 'STRING_TOO_LONG', message: expect.stringContaining('Opportunity Name'), fields: ['Name'] }]);
    expect(conversionState()).toEqual(before);
    expect((await h.rest('GET', `/api/sobjects/Lead/${lead.body.id}`)).body).toMatchObject({ IsConverted: false, Status: 'Open - Not Contacted', ConvertedAccountId: null });

    // The same Company with an opportunity name that fits converts, and creates all four records.
    const ok = await h.rest('POST', `/api/leads/${lead.body.id}/convert`, { convertedStatus: 'Closed - Converted', opportunityName: 'Short name' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ accountId: expect.stringMatching(/^001/), contactId: expect.stringMatching(/^003/), opportunityId: expect.stringMatching(/^006/) });
  });

  it('rolls back completely when conversion fails at the Contact step, after the Account was written', async () => {
    // A seed lead with no last name: the Account is created from its Company, then the Contact fails.
    const noName = (await h.rest('POST', '/api/query', { object: 'Lead', where: [{ field: 'LastName', op: 'isNull' }], limit: 1 })).body.records[0];
    const before = conversionState();
    const res = await h.rest('POST', `/api/leads/${noName.Id}/convert`, { convertedStatus: 'Closed - Converted' });
    expect(res.status).toBe(400);
    expect(res.body[0]).toMatchObject({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['LastName'] });
    expect(conversionState()).toEqual(before);
    expect((await h.rest('GET', `/api/sobjects/Lead/${noName.Id}`)).body.IsConverted).toBe(false);
  });

  it('compares text and picklist values case-insensitively, as SOQL does, and IDs exactly', async () => {
    const total = async (where: unknown[], object = 'Lead') => (await h.rest('POST', '/api/query', { object, where, limit: 1 })).body.totalSize as number;
    const unconverted = { field: 'IsConverted', op: 'eq', value: false };
    for (const value of ['Hot', 'hot', 'HOT']) expect(await total([unconverted, { field: 'Rating', op: 'eq', value }]), value).toBe(7111);
    expect(await total([unconverted, { field: 'Rating', op: 'in', value: ['hot', 'WARM'] }])).toBe(
      (await total([unconverted, { field: 'Rating', op: 'eq', value: 'Hot' }])) + (await total([unconverted, { field: 'Rating', op: 'eq', value: 'Warm' }])),
    );
    expect(await total([{ field: 'Status', op: 'eq', value: 'prospecting' }])).toBe(await total([{ field: 'Status', op: 'eq', value: 'Prospecting' }]));
    const all = await total([]);
    expect(await total([{ field: 'Rating', op: 'ne', value: 'hot' }])).toBe(all - (await total([{ field: 'Rating', op: 'eq', value: 'Hot' }])));
    const account = (await h.rest('POST', '/api/query', { object: 'Account', limit: 1 })).body.records[0];
    expect(await total([{ field: 'Name', op: 'eq', value: account.Name.toLowerCase() }], 'Account')).toBeGreaterThanOrEqual(1);
    // MCP returns the same.
    const client = await h.mcp();
    const viaMcp = await h.tool(client, 'query_records', { object: 'Lead', where: [unconverted, { field: 'Rating', op: 'eq', value: 'hot' }], limit: 1 });
    expect(viaMcp.data.totalSize).toBe(7111);
    // IDs stay exact: a reference filter is not folded.
    expect(await total([{ field: 'OwnerId', op: 'eq', value: account.OwnerId }], 'Account')).toBeGreaterThan(0);
    // The AC2 query still uses its index with the case-insensitive comparison.
    const plan = h.db
      .prepare(`EXPLAIN QUERY PLAN SELECT "Id" FROM "Lead" WHERE "IsConverted" = 0 AND "Rating" = 'hot' COLLATE NOCASE ORDER BY "Company" COLLATE NOCASE, "Id" LIMIT 50`)
      .all() as { detail: string }[];
    expect(plan.map((p) => p.detail).join(' ')).toContain('lead_rating_company');
  });

  it('accepts a body-less DELETE even with Content-Type: application/json, as most clients send it', async () => {
    const created = await h.rest('POST', '/api/sobjects/Account', { Name: 'Delete With Header' });
    const res = await fetch(`${h.baseUrl}/api/sobjects/Account/${created.body.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(204);
    expect((await h.rest('GET', `/api/sobjects/Account/${created.body.id}`)).status).toBe(404);
    const missing = await fetch(`${h.baseUrl}/api/sobjects/Account/${created.body.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' } });
    expect(missing.status).toBe(404);
    // A write that needs a body still says so, and bad JSON is still a parser error.
    const empty = await fetch(`${h.baseUrl}/api/sobjects/Account`, { method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(empty.status).toBe(400);
    expect((await empty.json())[0].errorCode).toBe('JSON_PARSER_ERROR');
    const bad = await fetch(`${h.baseUrl}/api/sobjects/Account`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    expect((await bad.json())[0].errorCode).toBe('JSON_PARSER_ERROR');
  });

  it('stores the standard Task Type field (Call, Email, Meeting, Other) alongside TaskSubtype', async () => {
    const describe = (await h.rest('GET', '/api/sobjects/Task/describe')).body;
    expect(describe.fields.find((f: { name: string }) => f.name === 'Type').picklistValues.map((v: { value: string }) => v.value)).toEqual(['Call', 'Email', 'Meeting', 'Other']);
    const created = await h.rest('POST', '/api/sobjects/Task', { Subject: 'Typed', Type: 'Call', WhatId: (await h.rest('POST', '/api/query', { object: 'Account', limit: 1 })).body.records[0].Id });
    expect(created.status).toBe(201);
    expect((await h.rest('GET', `/api/sobjects/Task/${created.body.id}`)).body).toMatchObject({ Type: 'Call', TaskSubtype: 'Task' });
    const call = await h.rest('POST', '/api/tasks/log-call', { whoId: (await h.rest('POST', '/api/query', { object: 'Contact', limit: 1 })).body.records[0].Id });
    expect((await h.rest('GET', `/api/sobjects/Task/${call.body.id}`)).body).toMatchObject({ Type: 'Call', TaskSubtype: 'Call', Status: 'Completed' });
    expect((await h.rest('PATCH', `/api/sobjects/Task/${created.body.id}`, { Type: 'Email' })).status).toBe(204);
  });

  it('rejects a bad query limit', async () => {
    expect((await h.rest('POST', '/api/query', { ...ALL_LEADS_HOT, limit: 0 })).body[0].errorCode).toBe('MALFORMED_QUERY');
    expect((await h.rest('GET', '/api/mutations?limit=abc')).body[0].errorCode).toBe('MALFORMED_QUERY');
  });
});

describe('acting user over REST (P6)', () => {
  it('uses the X-User-Id header for created-by and default owner', async () => {
    const created = await h.rest('POST', '/api/sobjects/Account', { Name: 'Acting As Jon' }, { 'x-user-id': jon });
    expect((await h.rest('GET', `/api/sobjects/Account/${created.body.id}`)).body).toMatchObject({ CreatedById: jon, OwnerId: jon });
  });

  it('rejects an inactive or unknown acting user', async () => {
    expect((await h.rest('POST', '/api/sobjects/Account', { Name: 'X' }, { 'x-user-id': christy })).body[0].errorCode).toBe('INACTIVE_OWNER_OR_USER');
    expect((await h.rest('POST', '/api/sobjects/Account', { Name: 'X' }, { 'x-user-id': 'nope' })).body[0].errorCode).toBe('MALFORMED_ID');
  });

  it('records writes in the mutation log with the acting user', async () => {
    const created = await h.rest('POST', '/api/sobjects/Account', { Name: 'Logged' }, { 'x-user-id': jon });
    const log = await h.rest('GET', '/api/mutations?limit=1000');
    const entry = log.body.mutations.find((m: { recordId: string }) => m.recordId === created.body.id);
    expect(entry).toMatchObject({ operation: 'create', object: 'Account', actorId: jon });
  });
});

describe('relationships and current user', () => {
  it('nests the owner and account names, as a Salesforce relationship query does', async () => {
    const account = await h.rest('POST', '/api/sobjects/Account', { Name: 'Related Co' }, { 'x-user-id': jon });
    const contact = await h.rest('POST', '/api/sobjects/Contact', { LastName: 'Nested', AccountId: account.body.id }, { 'x-user-id': jon });
    const got = await h.rest('GET', `/api/sobjects/Contact/${contact.body.id}`);
    expect(got.body.Account).toEqual({ attributes: { type: 'Account', url: `/api/sobjects/Account/${account.body.id}` }, Id: account.body.id, Name: 'Related Co' });
    expect(got.body.Owner).toMatchObject({ Id: jon, Name: 'Jon Santiago' });
    const listed = await h.rest('POST', '/api/query', { object: 'Contact', where: [{ field: 'Id', op: 'eq', value: contact.body.id }] });
    expect(listed.body.records[0].Account.Name).toBe('Related Co');
  });

  it('gives null relationships for empty references', async () => {
    const lead = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Plain', Company: 'Plain Co' });
    expect((await h.rest('GET', `/api/sobjects/Lead/${lead.body.id}`)).body.ConvertedAccount).toBeNull();
  });

  it('reports who the request acts as', async () => {
    expect((await h.rest('GET', '/api/users/current', undefined, { 'x-user-id': jon })).body).toMatchObject({ Id: jon, Name: 'Jon Santiago' });
    expect((await h.rest('GET', '/api/users/current')).body.Name).toBe('Amy Sanford');
  });
});
