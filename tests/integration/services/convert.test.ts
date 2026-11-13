import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  convertLead,
  createRecord,
  deleteRecord,
  getRecord,
  listMutations,
  queryRecords,
  updateRecord,
} from '../../../src/server/services/index.js';
import { fixedClock } from '../../../src/server/clock.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
let leadId: string;

const LEAD = {
  Salutation: 'Dr.',
  FirstName: 'Ada',
  LastName: 'Lovelace',
  Title: 'Founder',
  Company: 'Analytical Engines',
  Email: 'ada@example.invalid',
  Phone: '+1 202-555-0100',
  MobilePhone: '+1 202-555-0101',
  Street: '1 Engine Way',
  City: 'London',
  State: 'Greater London',
  PostalCode: '00000',
  Country: 'United Kingdom',
  Website: 'https://engines.invalid',
  Rating: 'Hot',
  LeadSource: 'Partner',
  AnnualRevenue: 457000,
  NumberOfEmployees: 12,
  Description: 'Met at the Royal Society',
  DoNotCall: true,
};

beforeEach(() => {
  f = createServiceFixture();
  leadId = String(createRecord(f.ctx, 'Lead', LEAD).Id);
});
afterEach(() => f.cleanup());

const TABLES = ['Lead', 'Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task'];
const counts = () => Object.fromEntries(TABLES.map((t) => [t, f.count(t)]));

describe('convertLead', () => {
  it('creates an account, contact, opportunity and contact role, then marks the lead converted', () => {
    const result = convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted' });
    expect(result.success).toBe(true);

    expect(getRecord(f.ctx, 'Account', result.accountId)).toMatchObject({
      Name: 'Analytical Engines',
      BillingStreet: '1 Engine Way',
      BillingCity: 'London',
      BillingCountry: 'United Kingdom',
      Phone: '+1 202-555-0100',
      Website: 'https://engines.invalid',
      Rating: 'Hot',
      AccountSource: 'Partner',
      AnnualRevenue: 457000,
      NumberOfEmployees: 12,
      Description: null,
      OwnerId: f.users.rep,
    });

    expect(getRecord(f.ctx, 'Contact', result.contactId)).toMatchObject({
      AccountId: result.accountId,
      FirstName: 'Ada',
      LastName: 'Lovelace',
      Salutation: null,
      Title: 'Founder',
      Email: 'ada@example.invalid',
      MobilePhone: '+1 202-555-0101',
      MailingCity: 'London',
      LeadSource: 'Partner',
      Description: 'Met at the Royal Society',
      DoNotCall: true,
    });

    expect(getRecord(f.ctx, 'Opportunity', result.opportunityId!)).toMatchObject({
      Name: 'Analytical Engines',
      AccountId: result.accountId,
      StageName: 'Prospecting',
      CloseDate: '2028-12-31',
      LeadSource: 'Partner',
      Description: null,
    });

    const roles = queryRecords(f.ctx, { object: 'OpportunityContactRole' }).records;
    expect(roles).toEqual([
      expect.objectContaining({ OpportunityId: result.opportunityId, ContactId: result.contactId, IsPrimary: false, Role: null }),
    ]);

    expect(getRecord(f.ctx, 'Lead', leadId)).toMatchObject({
      IsConverted: true,
      Status: 'Closed - Converted',
      ConvertedDate: '2028-11-11',
      ConvertedAccountId: result.accountId,
      ConvertedContactId: result.contactId,
      ConvertedOpportunityId: result.opportunityId,
    });
  });

  it('attaches to an existing account, filling only its empty fields', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Engines Ltd', Phone: '+1 202-555-0199' });
    const result = convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted', accountId: String(account.Id) });
    expect(result.accountId).toBe(account.Id);
    expect(f.count('Account')).toBe(1);
    expect(getRecord(f.ctx, 'Account', String(account.Id))).toMatchObject({
      Name: 'Engines Ltd',
      Phone: '+1 202-555-0199',
      Website: 'https://engines.invalid',
      Rating: 'Hot',
    });
  });

  it('dates the opportunity at the end of the quarter of the configured clock', () => {
    const ctx = { ...f.ctx, clock: fixedClock('2029-02-10T12:00:00Z') };
    const result = convertLead(ctx, { leadId, convertedStatus: 'Closed - Converted' });
    expect(getRecord(ctx, 'Opportunity', result.opportunityId!).CloseDate).toBe('2029-03-31');
    expect(getRecord(ctx, 'Lead', leadId).ConvertedDate).toBe('2029-02-10');
  });

  it('can skip the opportunity', () => {
    const result = convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted', doNotCreateOpportunity: true });
    expect(result.opportunityId).toBeNull();
    expect(f.count('Opportunity')).toBe(0);
    expect(f.count('OpportunityContactRole')).toBe(0);
    expect(getRecord(f.ctx, 'Lead', leadId).ConvertedOpportunityId).toBeNull();
  });

  it('uses the given opportunity name and owner', () => {
    const result = convertLead(f.ctx, {
      leadId,
      convertedStatus: 'Closed - Converted',
      opportunityName: 'Engines - Pilot',
      ownerId: f.users.manager,
    });
    expect(getRecord(f.ctx, 'Opportunity', result.opportunityId!)).toMatchObject({ Name: 'Engines - Pilot', OwnerId: f.users.manager });
    expect(getRecord(f.ctx, 'Contact', result.contactId).OwnerId).toBe(f.users.manager);
  });

  it('makes the lead read-only: no update, delete or second conversion', () => {
    convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted' });
    const readOnly = expect.objectContaining({ errorCode: 'CANNOT_UPDATE_CONVERTED_LEAD' });
    expect(errorsOf(() => updateRecord(f.ctx, 'Lead', leadId, { Title: 'CEO' }))).toEqual([readOnly]);
    expect(errorsOf(() => deleteRecord(f.ctx, 'Lead', leadId))).toEqual([readOnly]);
    expect(errorsOf(() => convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted' }))).toEqual([readOnly]);
  });

  it('validates its arguments', () => {
    expect(errorsOf(() => convertLead(f.ctx, { leadId }))).toEqual([
      expect.objectContaining({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['convertedStatus'] }),
    ]);
    expect(errorsOf(() => convertLead(f.ctx, { leadId, convertedStatus: 'Working - Contacted' }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_STATUS' }),
    ]);
    expect(
      errorsOf(() => convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted', doNotCreateOpportunity: true, opportunityName: 'X' })),
    ).toEqual([expect.objectContaining({ errorCode: 'FIELD_INTEGRITY_EXCEPTION' })]);
    expect(errorsOf(() => convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted', accountId: 'bad' }))).toEqual([
      expect.objectContaining({ errorCode: 'MALFORMED_ID' }),
    ]);
    expect(errorsOf(() => convertLead(f.ctx, { leadId, convertedStatus: 'Closed - Converted', accountId: leadId }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY' }),
    ]);
    expect(errorsOf(() => convertLead(f.ctx, { leadId: 'nope', convertedStatus: 'Closed - Converted' }))).toEqual([
      expect.objectContaining({ errorCode: 'NOT_FOUND' }),
    ]);
  });

  it('is atomic: a failure after the account and contact are written leaves nothing behind', () => {
    // A 150-character company is valid for Lead and Account but too long for the opportunity name it defaults to.
    const longLead = String(createRecord(f.ctx, 'Lead', { LastName: 'Long', Company: 'C'.repeat(150) }).Id);
    const before = counts();
    const logBefore = listMutations(f.ctx, { limit: 1000 }).length;
    const sequences = f.db.prepare('SELECT * FROM id_sequence ORDER BY key_prefix').all();

    expect(errorsOf(() => convertLead(f.ctx, { leadId: longLead, convertedStatus: 'Closed - Converted' }))).toEqual([
      expect.objectContaining({ errorCode: 'STRING_TOO_LONG', fields: ['Name'] }),
    ]);

    expect(counts()).toEqual(before);
    expect(listMutations(f.ctx, { limit: 1000 })).toHaveLength(logBefore);
    expect(f.db.prepare('SELECT * FROM id_sequence ORDER BY key_prefix').all()).toEqual(sequences);
    expect(getRecord(f.ctx, 'Lead', longLead)).toMatchObject({ IsConverted: false, Status: 'Open - Not Contacted' });
  });
});
