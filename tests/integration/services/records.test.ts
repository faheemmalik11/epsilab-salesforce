import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatId, isValidId } from '../../../src/server/db/ids.js';
import { createRecord, deleteRecord, getRecord, listMutations, updateRecord } from '../../../src/server/services/index.js';
import { CLOCK, createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
beforeEach(() => (f = createServiceFixture()));
afterEach(() => f.cleanup());

const newLead = (extra: Record<string, unknown> = {}) =>
  createRecord(f.ctx, 'Lead', { FirstName: 'Ada', LastName: 'Lovelace', Company: 'Analytical Engines', ...extra });

describe('createRecord', () => {
  it('applies defaults, the acting user as owner, the derived name and audit fields', () => {
    const lead = newLead();
    expect(isValidId(String(lead.Id))).toBe(true);
    expect(String(lead.Id).startsWith('00Q')).toBe(true);
    expect(lead).toMatchObject({
      Name: 'Ada Lovelace',
      Status: 'Open - Not Contacted',
      OwnerId: f.users.rep,
      IsConverted: false,
      CreatedById: f.users.rep,
      LastModifiedById: f.users.rep,
      CreatedDate: CLOCK,
      LastModifiedDate: CLOCK,
    });
  });

  it('reports all missing required fields in one REQUIRED_FIELD_MISSING error', () => {
    expect(errorsOf(() => createRecord(f.ctx, 'Lead', { FirstName: 'Ada' }))).toEqual([
      {
        errorCode: 'REQUIRED_FIELD_MISSING',
        message: 'Required fields are missing: [LastName, Company]',
        fields: ['LastName', 'Company'],
      },
    ]);
    expect(f.count('Lead')).toBe(0);
  });

  it('reports a bad value on a required field once, not also as missing', () => {
    expect(errorsOf(() => createRecord(f.ctx, 'Account', { Name: 'x'.repeat(300) }))).toEqual([
      expect.objectContaining({ errorCode: 'STRING_TOO_LONG', fields: ['Name'] }),
    ]);
  });

  it('treats an empty string as missing', () => {
    const errors = errorsOf(() => createRecord(f.ctx, 'Account', { Name: '' }));
    expect(errors).toEqual([expect.objectContaining({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['Name'] })]);
  });

  it('collects field errors of different kinds together', () => {
    const errors = errorsOf(() =>
      createRecord(f.ctx, 'Lead', {
        LastName: 'X',
        Company: 'Y',
        Bogus: 1,
        IsConverted: true,
        NumberOfEmployees: 'many',
        Status: 'Not a status',
      }),
    ) as { errorCode: string; fields: string[] }[];
    expect(errors.map((e) => [e.errorCode, e.fields])).toEqual([
      ['INVALID_FIELD', ['Bogus']],
      ['INVALID_FIELD_FOR_INSERT_UPDATE', ['IsConverted']],
      ['INVALID_TYPE_ON_FIELD_IN_RECORD', ['NumberOfEmployees']],
      ['INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', ['Status']],
    ]);
  });

  it('accepts values outside an unrestricted picklist, as Salesforce does', () => {
    expect(newLead({ Rating: 'Lukewarm' }).Rating).toBe('Lukewarm');
  });

  it('validates references: malformed, missing and wrong object', () => {
    const lead = newLead();
    expect(errorsOf(() => createRecord(f.ctx, 'Contact', { LastName: 'X', AccountId: 'nope' }))).toEqual([
      expect.objectContaining({ errorCode: 'MALFORMED_ID', fields: ['AccountId'] }),
    ]);
    expect(errorsOf(() => createRecord(f.ctx, 'Contact', { LastName: 'X', AccountId: formatId('001', 999) }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['AccountId'] }),
    ]);
    expect(errorsOf(() => createRecord(f.ctx, 'Contact', { LastName: 'X', AccountId: lead.Id }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['AccountId'] }),
    ]);
  });

  it('accepts 15-character reference IDs and stores the 18-character form', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
    const contact = createRecord(f.ctx, 'Contact', { LastName: 'X', AccountId: String(account.Id).slice(0, 15) });
    expect(contact.AccountId).toBe(account.Id);
  });

  it('rejects an inactive owner', () => {
    expect(errorsOf(() => newLead({ OwnerId: f.users.inactive }))).toEqual([
      expect.objectContaining({ errorCode: 'INACTIVE_OWNER_OR_USER', fields: ['OwnerId'] }),
    ]);
  });

  it('records the acting user, not the owner, as creator', () => {
    const lead = createRecord(f.as(f.users.manager), 'Lead', { LastName: 'X', Company: 'Y', OwnerId: f.users.rep });
    expect(lead).toMatchObject({ OwnerId: f.users.rep, CreatedById: f.users.manager });
  });
});

describe('updateRecord', () => {
  it('applies changes, re-derives the name and stamps the modifier', () => {
    const lead = newLead();
    const updated = updateRecord(f.as(f.users.manager), 'Lead', String(lead.Id), { FirstName: 'Augusta' });
    expect(updated).toMatchObject({ Name: 'Augusta Lovelace', LastModifiedById: f.users.manager, CreatedById: f.users.rep });
  });

  it('rejects clearing a required field', () => {
    const lead = newLead();
    expect(errorsOf(() => updateRecord(f.ctx, 'Lead', String(lead.Id), { Company: null }))).toEqual([
      expect.objectContaining({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['Company'] }),
    ]);
    expect(getRecord(f.ctx, 'Lead', String(lead.Id)).Company).toBe('Analytical Engines');
  });

  it('returns NOT_FOUND for unknown, malformed or wrong-object IDs', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
    for (const id of [formatId('00Q', 999), 'garbage', String(account.Id)]) {
      expect(errorsOf(() => updateRecord(f.ctx, 'Lead', id, { Title: 'x' }))).toEqual([
        { errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' },
      ]);
    }
  });

  it('keeps an existing inactive owner when other fields change', () => {
    const lead = newLead();
    f.db.prepare('UPDATE "Lead" SET "OwnerId" = ? WHERE "Id" = ?').run(f.users.inactive, lead.Id);
    expect(updateRecord(f.ctx, 'Lead', String(lead.Id), { Title: 'CTO' }).OwnerId).toBe(f.users.inactive);
  });

  it('refuses to set a converted status directly', () => {
    const lead = newLead();
    expect(errorsOf(() => updateRecord(f.ctx, 'Lead', String(lead.Id), { Status: 'Closed - Converted' }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_STATUS', fields: ['Status'] }),
    ]);
  });

  it('moves a lead to Working - Contacted', () => {
    const lead = newLead();
    expect(updateRecord(f.ctx, 'Lead', String(lead.Id), { Status: 'Working - Contacted' }).Status).toBe('Working - Contacted');
  });
});

describe('deleteRecord', () => {
  it('cascades from an account to its contacts, opportunities, contact roles and tasks', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
    const contact = createRecord(f.ctx, 'Contact', { LastName: 'X', AccountId: account.Id });
    const opp = createRecord(f.ctx, 'Opportunity', { Name: 'Deal', AccountId: account.Id, StageName: 'Prospecting', CloseDate: '2028-12-31' });
    createRecord(f.ctx, 'OpportunityContactRole', { OpportunityId: opp.Id, ContactId: contact.Id });
    createRecord(f.ctx, 'Task', { Subject: 'Call', WhatId: opp.Id, WhoId: contact.Id });
    createRecord(f.ctx, 'Task', { Subject: 'Note', WhatId: account.Id });

    deleteRecord(f.ctx, 'Account', String(account.Id));
    for (const table of ['Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task']) {
      expect(f.count(table), table).toBe(0);
    }
    const deletes = listMutations(f.ctx).filter((m) => m.operation === 'delete');
    expect(deletes.map((m) => m.object).sort()).toEqual(
      ['Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task', 'Task'].sort(),
    );
  });

  it('returns NOT_FOUND for a missing record', () => {
    expect(errorsOf(() => deleteRecord(f.ctx, 'Account', formatId('001', 999)))).toEqual([
      expect.objectContaining({ errorCode: 'NOT_FOUND' }),
    ]);
  });
});

describe('mutation log', () => {
  it('records create, update and delete with actor, clock time and before/after images', () => {
    const lead = newLead();
    updateRecord(f.ctx, 'Lead', String(lead.Id), { Title: 'CTO' });
    deleteRecord(f.ctx, 'Lead', String(lead.Id));
    const log = listMutations(f.ctx);
    expect(log.map((m) => m.operation)).toEqual(['create', 'update', 'delete']);
    expect(log[0]).toMatchObject({ actorId: f.users.rep, at: CLOCK, object: 'Lead', recordId: lead.Id, before: null });
    expect(log[1]!.before?.Title).toBeNull();
    expect(log[1]!.after?.Title).toBe('CTO');
    expect(log[2]!.after).toBeNull();
  });

  it('records nothing when a write is rejected', () => {
    errorsOf(() => createRecord(f.ctx, 'Lead', {}));
    expect(listMutations(f.ctx)).toEqual([]);
  });
});
