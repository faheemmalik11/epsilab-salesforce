import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { startHarness, type Harness } from '../../apiHarness.js';

// REST and MCP run on the same server and service layer: the same input must give the same
// error, and a change through one surface must be visible through the other.

let h: Harness;
let client: Client;
beforeAll(async () => {
  h = await startHarness();
  client = await h.mcp();
});
afterAll(() => h.close());

const tool = (name: string, args: Record<string, unknown>) => h.tool(client, name, args);

describe('same errors from REST and MCP (AC5)', () => {
  it('missing required fields', async () => {
    const rest = await h.rest('POST', '/api/sobjects/Lead', { FirstName: 'Only' });
    const mcp = await tool('create_record', { object: 'Lead', fields: { FirstName: 'Only' } });
    expect(rest.status).toBe(400);
    expect(mcp.isError).toBe(true);
    expect(mcp.data).toEqual(rest.body);
    expect(rest.body[0].errorCode).toBe('REQUIRED_FIELD_MISSING');
  });

  it('moving past Qualification without an Amount', async () => {
    const opp = await h.rest('POST', '/api/sobjects/Opportunity', { Name: 'Parity', StageName: 'Qualification', CloseDate: '2028-12-31' });
    const rest = await h.rest('PATCH', `/api/sobjects/Opportunity/${opp.body.id}`, { StageName: 'Needs Analysis' });
    const viaUpdate = await tool('update_record', { object: 'Opportunity', id: opp.body.id, fields: { StageName: 'Needs Analysis' } });
    const viaStage = await tool('update_opportunity_stage', { opportunityId: opp.body.id, stageName: 'Needs Analysis' });
    expect(rest.status).toBe(400);
    expect(viaUpdate.data).toEqual(rest.body);
    expect(viaStage.data).toEqual(rest.body);
    expect(rest.body[0].errorCode).toBe('FIELD_CUSTOM_VALIDATION_EXCEPTION');
  });

  it('invalid reference and restricted picklist', async () => {
    const input = { LastName: 'X', Company: 'Y', Status: 'Not a status', OwnerId: '005SB0000000999AAA' };
    const rest = await h.rest('POST', '/api/sobjects/Lead', input);
    const mcp = await tool('create_record', { object: 'Lead', fields: input });
    expect(mcp.data).toEqual(rest.body);
    expect(rest.body.map((e: { errorCode: string }) => e.errorCode)).toEqual(['INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', 'MALFORMED_ID']);
  });
});

describe('changes are visible across surfaces', () => {
  it('a lead created over REST is read and updated over MCP, then read back over REST', async () => {
    const created = await h.rest('POST', '/api/sobjects/Lead', { LastName: 'Crossover', Company: 'Both Ways' });
    const fromMcp = await tool('get_record', { object: 'Lead', id: created.body.id });
    expect(fromMcp.data).toMatchObject({ Id: created.body.id, Company: 'Both Ways' });
    await tool('update_record', { object: 'Lead', id: created.body.id, fields: { Status: 'Working - Contacted' } });
    expect((await h.rest('GET', `/api/sobjects/Lead/${created.body.id}`)).body.Status).toBe('Working - Contacted');
  });

  it('a conversion over MCP is visible over REST, and the REST view of it matches MCP', async () => {
    const lead = await tool('create_record', { object: 'Lead', fields: { LastName: 'Visible', Company: 'Mirror Co' } });
    const converted = await tool('convert_lead', { leadId: lead.data.id, convertedStatus: 'Closed - Converted' });
    const restOpp = await h.rest('GET', `/api/sobjects/Opportunity/${converted.data.opportunityId}`);
    const mcpOpp = await tool('get_record', { object: 'Opportunity', id: converted.data.opportunityId });
    expect(restOpp.body).toEqual(mcpOpp.data);
    expect(restOpp.body.Name).toBe('Mirror Co');
  });

  it('queries return the same records through both surfaces', async () => {
    const query = { object: 'Account', orderBy: [{ field: 'Name' }], limit: 200 };
    const rest = await h.rest('POST', '/api/query', query);
    const mcp = await tool('query_records', query);
    expect(mcp.data).toEqual(rest.body);
  });
});
