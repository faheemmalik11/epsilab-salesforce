import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecord, getRecord, updateRecord } from '../../../src/server/services/index.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
let oppId: string;
beforeEach(() => {
  f = createServiceFixture();
  const account = createRecord(f.ctx, 'Account', { Name: 'Acme' });
  oppId = String(
    createRecord(f.ctx, 'Opportunity', { Name: 'Deal', AccountId: account.Id, StageName: 'Prospecting', CloseDate: '2028-12-31' }).Id,
  );
});
afterEach(() => f.cleanup());

const AMOUNT_ERROR = {
  errorCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION',
  message: 'Amount is required for stages after Qualification.',
  fields: ['Amount'],
};

describe('opportunity stages', () => {
  it('sets stage defaults on create', () => {
    expect(getRecord(f.ctx, 'Opportunity', oppId)).toMatchObject({
      Probability: 10,
      ForecastCategoryName: 'Pipeline',
      IsClosed: false,
      IsWon: false,
    });
  });

  it('allows Qualification without an Amount', () => {
    expect(updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Qualification' }).StageName).toBe('Qualification');
  });

  it('rejects moving past Qualification without an Amount, and leaves the record unchanged', () => {
    expect(errorsOf(() => updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Needs Analysis' }))).toEqual([AMOUNT_ERROR]);
    expect(getRecord(f.ctx, 'Opportunity', oppId).StageName).toBe('Prospecting');
  });

  it('applies the rule to closed stages and on create', () => {
    expect(errorsOf(() => updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Closed Won' }))).toEqual([AMOUNT_ERROR]);
    expect(
      errorsOf(() => createRecord(f.ctx, 'Opportunity', { Name: 'X', StageName: 'Needs Analysis', CloseDate: '2028-12-31' })),
    ).toEqual([AMOUNT_ERROR]);
  });

  it('rejects clearing the Amount on an opportunity past Qualification', () => {
    updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Needs Analysis', Amount: 5000 });
    expect(errorsOf(() => updateRecord(f.ctx, 'Opportunity', oppId, { Amount: null }))).toEqual([AMOUNT_ERROR]);
  });

  it('reports missing required fields before the Amount rule', () => {
    expect(errorsOf(() => updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Needs Analysis', Name: null }))).toEqual([
      expect.objectContaining({ errorCode: 'REQUIRED_FIELD_MISSING', fields: ['Name'] }),
    ]);
  });

  it('moves through the stages, updating probability and forecast category, and keeps Next Step', () => {
    updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Needs Analysis', Amount: 25000, NextStep: 'Send proposal' });
    const proposal = updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Proposal/Price Quote' });
    expect(proposal).toMatchObject({ Probability: 75, ForecastCategoryName: 'Best Case', NextStep: 'Send proposal', Amount: 25000 });
    const negotiation = updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Negotiation/Review', NextStep: 'Legal review' });
    expect(negotiation).toMatchObject({ Probability: 90, ForecastCategoryName: 'Commit', NextStep: 'Legal review' });
  });

  it('keeps an explicit probability sent with the stage change, and keeps it on later edits', () => {
    updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Needs Analysis', Amount: 1000, Probability: 35 });
    expect(updateRecord(f.ctx, 'Opportunity', oppId, { NextStep: 'Call' }).Probability).toBe(35);
  });

  it('marks Closed Won and Closed Lost correctly', () => {
    const won = updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Closed Won', Amount: 1000 });
    expect(won).toMatchObject({ IsClosed: true, IsWon: true, Probability: 100, ForecastCategoryName: 'Closed' });
    const lost = updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Closed Lost' });
    expect(lost).toMatchObject({ IsClosed: true, IsWon: false, Probability: 0, ForecastCategoryName: 'Omitted' });
  });

  it('rejects an unknown stage', () => {
    expect(errorsOf(() => updateRecord(f.ctx, 'Opportunity', oppId, { StageName: 'Maybe' }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST', fields: ['StageName'] }),
    ]);
  });
});
