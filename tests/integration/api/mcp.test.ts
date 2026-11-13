import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { ALL_LEADS_HOT, startHarness, type Harness } from '../../apiHarness.js';

let h: Harness;
let client: Client;
let jon: string;
let christy: string;
beforeAll(async () => {
  h = await startHarness();
  client = await h.mcp();
  const users = (await h.tool(client, 'list_users')).data.users as { Id: string; Name: string }[];
  jon = users.find((u) => u.Name === 'Jon Santiago')!.Id;
  christy = users.find((u) => u.Name === 'Christy Sanchez')!.Id;
});
afterAll(() => h.close());

const call = (name: string, args: Record<string, unknown> = {}) => h.tool(client, name, args);

describe('MCP tools', () => {
  it('lists every tool', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'add_contact_role',
        'convert_lead',
        'create_record',
        'create_task',
        'delete_record',
        'describe_object',
        'get_mutation_log',
        'get_record',
        'health',
        'list_objects',
        'list_users',
        'log_call',
        'query_records',
        'update_opportunity_stage',
        'update_record',
      ].sort(),
    );
    expect(tools.every((t) => (t.description ?? '').length > 10)).toBe(true);
  });

  it('returns 7,111 Hot leads in All Leads, sorted by Company (AC2 over MCP)', async () => {
    const result = await call('query_records', ALL_LEADS_HOT);
    expect(result.isError).toBe(false);
    expect(result.data.totalSize).toBe(7111);
    const companies = result.data.records.map((r: { Company: string }) => r.Company.toLowerCase());
    expect(companies).toEqual([...companies].sort());
  });

  it('describes objects for agents', async () => {
    const result = await call('describe_object', { object: 'Opportunity' });
    expect(result.data.fields.find((f: { name: string }) => f.name === 'StageName').picklistValues).toHaveLength(10);
  });
});

describe('lead lifecycle over MCP (L1 to L5)', () => {
  it('creates, works, converts, progresses and closes a deal', async () => {
    const lead = await call('create_record', { object: 'Lead', fields: { FirstName: 'Ada', LastName: 'Lovelace', Company: 'Engines Ltd' } });
    expect(lead).toEqual({ isError: false, data: { id: expect.stringMatching(/^00Q/), success: true, errors: [] } });
    const leadId = lead.data.id;

    const task = await call('log_call', { whoId: leadId, subject: 'Discovery call' });
    expect((await call('get_record', { object: 'Task', id: task.data.id })).data).toMatchObject({ Status: 'Completed', TaskSubtype: 'Call' });

    const worked = await call('update_record', { object: 'Lead', id: leadId, fields: { Status: 'Working - Contacted' } });
    expect(worked.data.Status).toBe('Working - Contacted');

    const converted = await call('convert_lead', { leadId, convertedStatus: 'Closed - Converted', opportunityName: 'Engines - Pilot' });
    expect(converted.isError).toBe(false);
    const { accountId, contactId, opportunityId } = converted.data;

    expect(await call('update_record', { object: 'Lead', id: leadId, fields: { Title: 'CEO' } })).toEqual({
      isError: true,
      data: [{ errorCode: 'CANNOT_UPDATE_CONVERTED_LEAD', message: 'A converted lead cannot be updated.' }],
    });

    expect(await call('update_opportunity_stage', { opportunityId, stageName: 'Value Proposition' })).toEqual({
      isError: true,
      data: [{ errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Amount is required for stages after Qualification.', fields: ['Amount'] }],
    });
    const valueProp = await call('update_opportunity_stage', { opportunityId, stageName: 'Value Proposition', amount: 80000, nextStep: 'Demo' });
    expect(valueProp.data).toMatchObject({ StageName: 'Value Proposition', Probability: 50, NextStep: 'Demo' });

    const contact2 = await call('create_record', { object: 'Contact', fields: { LastName: 'Babbage', AccountId: accountId } });
    const role = await call('add_contact_role', { opportunityId, contactId: contact2.data.id, role: 'Decision Maker', isPrimary: true });
    expect(role.isError).toBe(false);
    const roles = await call('query_records', {
      object: 'OpportunityContactRole',
      where: [{ field: 'OpportunityId', op: 'eq', value: opportunityId }],
    });
    expect(roles.data.records.map((r: { ContactId: string }) => r.ContactId).sort()).toEqual([contactId, contact2.data.id].sort());

    expect((await call('create_task', { subject: 'Send contract', whatId: opportunityId, activityDate: '2028-11-25' })).isError).toBe(false);
    await call('update_record', { object: 'Opportunity', id: opportunityId, fields: { NextStep: 'Await signature' } });

    const lost = await call('update_opportunity_stage', { opportunityId, stageName: 'Closed Lost' });
    expect(lost.data).toMatchObject({ IsClosed: true, IsWon: false, Probability: 0, ForecastCategoryName: 'Omitted', NextStep: 'Await signature' });
  });
});

describe('direct path over MCP (L6)', () => {
  it('creates an account, contact and opportunity with no lead', async () => {
    const account = await call('create_record', { object: 'Account', fields: { Name: 'MCP Direct Co' } });
    const contact = await call('create_record', { object: 'Contact', fields: { LastName: 'Agent', AccountId: account.data.id } });
    const opp = await call('create_record', {
      object: 'Opportunity',
      fields: { Name: 'MCP Direct', AccountId: account.data.id, StageName: 'Qualification', CloseDate: '2029-01-31' },
    });
    expect([account.isError, contact.isError, opp.isError]).toEqual([false, false, false]);
    expect((await call('get_record', { object: 'Opportunity', id: opp.data.id })).data.AccountId).toBe(account.data.id);
  });
});

describe('MCP errors, acting user and rollback', () => {
  it('rejects invalid references and missing records', async () => {
    expect((await call('create_record', { object: 'Opportunity', fields: { Name: 'X', StageName: 'Prospecting', CloseDate: '2028-12-31', AccountId: jon } })).data).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['AccountId'] }),
    ]);
    expect((await call('get_record', { object: 'Lead', id: '00QSB000000ZZZZAAA' })).data).toEqual([
      { errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' },
    ]);
  });

  it('acts as the user named in actingUserId, and rejects inactive users', async () => {
    const created = await call('create_record', { object: 'Account', fields: { Name: 'As Jon' }, actingUserId: jon });
    expect((await call('get_record', { object: 'Account', id: created.data.id })).data).toMatchObject({ CreatedById: jon, OwnerId: jon });
    expect((await call('create_record', { object: 'Account', fields: { Name: 'X' }, actingUserId: christy })).data[0].errorCode).toBe(
      'INACTIVE_OWNER_OR_USER',
    );
  });

  it('rolls back a failed conversion completely', async () => {
    const lead = await call('create_record', { object: 'Lead', fields: { LastName: 'Long', Company: 'M'.repeat(150) } });
    const before = ['Account', 'Contact', 'Opportunity', 'mutation_log'].map((t) => h.count(t));
    const result = await call('convert_lead', { leadId: lead.data.id, convertedStatus: 'Closed - Converted' });
    expect(result.isError).toBe(true);
    expect(['Account', 'Contact', 'Opportunity', 'mutation_log'].map((t) => h.count(t))).toEqual(before);
  });

  it('exposes the mutation log', async () => {
    const log = await call('get_mutation_log', { limit: 1000 });
    expect(log.data.mutations.length).toBeGreaterThan(0);
    expect(log.data.mutations[0]).toHaveProperty('operation');
  });
});
