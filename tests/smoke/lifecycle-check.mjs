// Runs inside the container (no network): both lifecycle paths over REST and over MCP.
const api = 'http://127.0.0.1:8080';

async function rest(method, url, body) {
  const res = await fetch(api + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

let rpcId = 0;
async function tool(name, args = {}) {
  const res = await fetch(`${api}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: args } }),
  });
  const line = (await res.text()).split('\n').find((l) => l.startsWith('data: '));
  const result = JSON.parse(line.slice(6)).result;
  return { isError: result.isError === true, data: result.isError ? result.structuredContent.errors : result.structuredContent };
}

function check(label, condition, detail) {
  if (!condition) throw new Error(`${label} failed: ${JSON.stringify(detail)}`);
  console.log(`ok ${label}`);
}

const hot = { object: 'Lead', where: [{ field: 'IsConverted', op: 'eq', value: false }, { field: 'Rating', op: 'eq', value: 'Hot' }], orderBy: [{ field: 'Company' }] };
const restHot = await rest('POST', '/api/query', hot);
const mcpHot = await tool('query_records', hot);
check('AC2 REST 7111', restHot.body.totalSize === 7111, restHot.body.totalSize);
check('AC2 MCP 7111', mcpHot.data.totalSize === 7111, mcpHot.data.totalSize);

// Lead to Closed Won over REST
const lead = await rest('POST', '/api/sobjects/Lead', { LastName: 'Rest', Company: 'Rest Co' });
await rest('POST', '/api/tasks/log-call', { whoId: lead.body.id });
await rest('PATCH', `/api/sobjects/Lead/${lead.body.id}`, { Status: 'Working - Contacted' });
const conv = await rest('POST', `/api/leads/${lead.body.id}/convert`, { convertedStatus: 'Closed - Converted' });
check('REST convert', conv.status === 200 && conv.body.opportunityId, conv);
const amount = await rest('PATCH', `/api/sobjects/Opportunity/${conv.body.opportunityId}`, { StageName: 'Needs Analysis' });
check('REST Amount rule', amount.body[0]?.errorCode === 'FIELD_CUSTOM_VALIDATION_EXCEPTION', amount);
await rest('PATCH', `/api/sobjects/Opportunity/${conv.body.opportunityId}`, { StageName: 'Needs Analysis', Amount: 1000, NextStep: 'Demo' });
await rest('PATCH', `/api/sobjects/Opportunity/${conv.body.opportunityId}`, { StageName: 'Closed Won' });
const won = await rest('GET', `/api/sobjects/Opportunity/${conv.body.opportunityId}`);
check('REST Closed Won', won.body.IsWon === true, won.body);

// Lead to Closed Lost over MCP
const mlead = await tool('create_record', { object: 'Lead', fields: { LastName: 'Mcp', Company: 'Mcp Co' } });
await tool('log_call', { whoId: mlead.data.id });
await tool('update_record', { object: 'Lead', id: mlead.data.id, fields: { Status: 'Working - Contacted' } });
const mconv = await tool('convert_lead', { leadId: mlead.data.id, convertedStatus: 'Closed - Converted' });
check('MCP convert', !mconv.isError, mconv);
const mreq = await tool('create_record', { object: 'Lead', fields: {} });
check('MCP required-field error', mreq.data[0]?.errorCode === 'REQUIRED_FIELD_MISSING', mreq);
await tool('update_opportunity_stage', { opportunityId: mconv.data.opportunityId, stageName: 'Negotiation/Review', amount: 5000 });
const lost = await tool('update_opportunity_stage', { opportunityId: mconv.data.opportunityId, stageName: 'Closed Lost' });
check('MCP Closed Lost', lost.data.IsClosed === true && lost.data.IsWon === false, lost);

// Direct path through both, and cross-visibility
const acct = await rest('POST', '/api/sobjects/Account', { Name: 'Direct' });
const contact = await tool('create_record', { object: 'Contact', fields: { LastName: 'Direct', AccountId: acct.body.id } });
const opp = await rest('POST', '/api/sobjects/Opportunity', { Name: 'Direct', AccountId: acct.body.id, StageName: 'Prospecting', CloseDate: '2028-12-31' });
const seen = await tool('get_record', { object: 'Opportunity', id: opp.body.id });
check('direct path across REST and MCP', contact.data.success && seen.data.AccountId === acct.body.id, { contact, seen });

console.log('LIFECYCLE CHECK PASSED');
