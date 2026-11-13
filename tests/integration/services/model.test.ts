import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatId, isValidId } from '../../../src/server/db/ids.js';
import { getObject, OBJECTS, type ObjectName } from '../../../src/server/metadata/index.js';
import { convertLead, createRecord, deleteRecord, getRecord, updateRecord, type SObject } from '../../../src/server/services/index.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

// Model-wide checks driven by the metadata, so every object and field is covered, not just samples.

let f: ServiceFixture;
beforeEach(() => (f = createServiceFixture()));
afterEach(() => f.cleanup());

const WRITABLE: ObjectName[] = ['Lead', 'Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task'];

/** The smallest valid input for each object, creating parents where needed. */
function minimalInput(object: ObjectName): Record<string, unknown> {
  switch (object) {
    case 'Lead':
      return { LastName: 'L', Company: 'C' };
    case 'Account':
      return { Name: 'A' };
    case 'Contact':
      return { LastName: 'C' };
    case 'Opportunity':
      return { Name: 'O', StageName: 'Prospecting', CloseDate: '2028-12-31' };
    case 'OpportunityContactRole':
      return {
        OpportunityId: createRecord(f.ctx, 'Opportunity', minimalInput('Opportunity')).Id,
        ContactId: createRecord(f.ctx, 'Contact', minimalInput('Contact')).Id,
      };
    default:
      return {};
  }
}

describe('every writable object', () => {
  it.each(WRITABLE)('%s: a minimal valid record saves with a valid 18-character ID and reads back', (object) => {
    const saved = createRecord(f.ctx, object, minimalInput(object));
    const id = String(saved.Id);
    expect(id).toHaveLength(18);
    expect(isValidId(id)).toBe(true);
    expect(id.startsWith(getObject(object).keyPrefix)).toBe(true);
    expect(getRecord(f.ctx, object, id)).toEqual(saved);
  });

  it.each(WRITABLE)('%s: an empty create reports exactly the required fields', (object) => {
    const required = getObject(object).fields.filter((fd) => fd.required).map((fd) => fd.name);
    if (required.length === 0) {
      expect(() => createRecord(f.ctx, object, {})).not.toThrow();
      return;
    }
    expect(errorsOf(() => createRecord(f.ctx, object, {}))).toEqual([
      { errorCode: 'REQUIRED_FIELD_MISSING', message: `Required fields are missing: [${required.join(', ')}]`, fields: required },
    ]);
  });

  it('User records cannot be created, edited or deleted, even with no fields', () => {
    const readOnly = (action: string) => [
      { errorCode: 'INSUFFICIENT_ACCESS_OR_READONLY', message: `You don't have permission to ${action} User records.` },
    ];
    const before = f.count('User');
    expect(errorsOf(() => createRecord(f.ctx, 'User', {}))).toEqual(readOnly('create'));
    expect(errorsOf(() => updateRecord(f.ctx, 'User', f.users.rep, {}))).toEqual(readOnly('edit'));
    expect(errorsOf(() => deleteRecord(f.ctx, 'User', f.users.rep))).toEqual(readOnly('delete'));
    expect(f.count('User')).toBe(before);
  });

  it('rejects an Id in the record data with the Salesforce message', () => {
    expect(errorsOf(() => createRecord(f.ctx, 'Account', { Id: '001SB0000000001YAA', Name: 'A' }))).toEqual([
      { errorCode: 'INVALID_FIELD', message: 'The Id field should not be specified in the sobject data.', fields: ['Id'] },
    ]);
  });
});

describe('every reference field', () => {
  const cases = OBJECTS.filter((o) => WRITABLE.includes(o.name)).flatMap((o) =>
    o.fields.filter((fd) => fd.type === 'reference' && fd.createable).map((fd) => [o.name, fd.name, fd.referenceTo![0]!] as const),
  );

  it.each(cases)('%s.%s rejects a well-formed ID that does not exist', (object, fieldName, target) => {
    const missingId = formatId(getObject(target).keyPrefix, 9999);
    const input = { ...minimalInput(object), [fieldName]: missingId };
    expect(errorsOf(() => createRecord(f.ctx, object, input))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: [fieldName] }),
    ]);
  });
});

describe('every restricted picklist field', () => {
  const cases = OBJECTS.filter((o) => WRITABLE.includes(o.name)).flatMap((o) =>
    o.fields
      .filter((fd) => fd.picklist?.restricted && fd.createable)
      .map((fd) => [o.name, fd.name, fd.picklist!.values.map((v) => v.value)] as const),
  );

  it.each(cases)('%s.%s rejects a value outside its list', (object, fieldName) => {
    const input = { ...minimalInput(object), [fieldName]: 'Not In The List' };
    expect(errorsOf(() => createRecord(f.ctx, object, input))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', fields: [fieldName] }),
    ]);
  });

  it.each(cases)('%s.%s accepts every value in its list that a normal write may set', (object, fieldName, values) => {
    for (const value of values) {
      if (object === 'Lead' && value === 'Closed - Converted') continue;
      const input: Record<string, unknown> = { ...minimalInput(object), [fieldName]: value };
      if (object === 'Opportunity' && fieldName === 'StageName') input.Amount = 1000;
      expect(createRecord(f.ctx, object, input)[fieldName], `${fieldName}=${value}`).toBe(value);
    }
  });
});

describe('structured errors', () => {
  it('always have errorCode and message, and fields only when non-empty', () => {
    const samples: unknown[] = [
      ...errorsOf(() => createRecord(f.ctx, 'Lead', { Bogus: 1, NumberOfEmployees: 'x', Status: 'nope' })),
      ...errorsOf(() => createRecord(f.ctx, 'Opportunity', { Name: 'X', StageName: 'Closed Won', CloseDate: '2028-12-31' })),
      ...errorsOf(() => getRecord(f.ctx, 'Lead', 'missing')),
    ];
    for (const error of samples as Record<string, unknown>[]) {
      expect(Object.keys(error).sort()).toEqual(error.fields ? ['errorCode', 'fields', 'message'] : ['errorCode', 'message']);
      expect(typeof error.errorCode).toBe('string');
      expect(typeof error.message).toBe('string');
      if (error.fields) expect((error.fields as string[]).length).toBeGreaterThan(0);
    }
  });
});

describe('lead conversion owner checks', () => {
  it('rejects an inactive owner and writes nothing', () => {
    const lead = createRecord(f.ctx, 'Lead', minimalInput('Lead')) as SObject;
    const before = ['Account', 'Contact', 'Opportunity'].map((t) => f.count(t));
    expect(
      errorsOf(() => convertLead(f.ctx, { leadId: String(lead.Id), convertedStatus: 'Closed - Converted', ownerId: f.users.inactive })),
    ).toEqual([expect.objectContaining({ errorCode: 'INACTIVE_OWNER_OR_USER' })]);
    expect(['Account', 'Contact', 'Opportunity'].map((t) => f.count(t))).toEqual(before);
    expect(getRecord(f.ctx, 'Lead', String(lead.Id)).IsConverted).toBe(false);
  });
});
