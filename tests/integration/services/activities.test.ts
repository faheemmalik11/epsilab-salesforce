import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecord, getRecord, logCall, updateRecord } from '../../../src/server/services/index.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
beforeEach(() => (f = createServiceFixture()));
afterEach(() => f.cleanup());

describe('tasks', () => {
  it('logs a call on a lead as a completed Call task dated today', () => {
    const lead = createRecord(f.ctx, 'Lead', { LastName: 'X', Company: 'Y' });
    const task = logCall(f.ctx, { whoId: String(lead.Id), description: 'Left a voicemail' });
    expect(task).toMatchObject({
      Subject: 'Call',
      TaskSubtype: 'Call',
      Status: 'Completed',
      IsClosed: true,
      ActivityDate: '2028-11-11',
      WhoId: lead.Id,
      OwnerId: f.users.rep,
      Description: 'Left a voicemail',
    });
  });

  it('defaults a new task to Not Started, Normal priority and open', () => {
    const task = createRecord(f.ctx, 'Task', { Subject: 'Follow up' });
    expect(task).toMatchObject({ Status: 'Not Started', Priority: 'Normal', TaskSubtype: 'Task', IsClosed: false });
    expect(updateRecord(f.ctx, 'Task', String(task.Id), { Status: 'Completed' }).IsClosed).toBe(true);
  });

  it('only links WhoId to leads or contacts, and WhatId to accounts or opportunities', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
    const lead = createRecord(f.ctx, 'Lead', { LastName: 'X', Company: 'Y' });
    expect(errorsOf(() => createRecord(f.ctx, 'Task', { WhoId: account.Id }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['WhoId'] }),
    ]);
    expect(errorsOf(() => createRecord(f.ctx, 'Task', { WhatId: lead.Id }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY', fields: ['WhatId'] }),
    ]);
  });

  it('does not allow the subtype to change after creation', () => {
    const task = logCall(f.ctx, {});
    expect(errorsOf(() => updateRecord(f.ctx, 'Task', String(task.Id), { TaskSubtype: 'Task' }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_FIELD_FOR_INSERT_UPDATE', fields: ['TaskSubtype'] }),
    ]);
  });
});

describe('contact roles', () => {
  it('adds roles and keeps at most one primary per opportunity', () => {
    const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
    const opp = createRecord(f.ctx, 'Opportunity', { Name: 'Deal', AccountId: account.Id, StageName: 'Prospecting', CloseDate: '2028-12-31' });
    const c1 = createRecord(f.ctx, 'Contact', { LastName: 'One', AccountId: account.Id });
    const c2 = createRecord(f.ctx, 'Contact', { LastName: 'Two', AccountId: account.Id });

    const r1 = createRecord(f.ctx, 'OpportunityContactRole', { OpportunityId: opp.Id, ContactId: c1.Id, Role: 'Decision Maker', IsPrimary: true });
    const r2 = createRecord(f.ctx, 'OpportunityContactRole', { OpportunityId: opp.Id, ContactId: c2.Id, Role: 'Influencer', IsPrimary: true });

    expect(getRecord(f.ctx, 'OpportunityContactRole', String(r1.Id)).IsPrimary).toBe(false);
    expect(getRecord(f.ctx, 'OpportunityContactRole', String(r2.Id)).IsPrimary).toBe(true);
  });

  it('requires an opportunity and a contact and a valid role', () => {
    expect(errorsOf(() => createRecord(f.ctx, 'OpportunityContactRole', { Role: 'Boss' }))).toEqual([
      expect.objectContaining({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['OpportunityId', 'ContactId'] }),
      expect.objectContaining({ errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', fields: ['Role'] }),
    ]);
  });
});
