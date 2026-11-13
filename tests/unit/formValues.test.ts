import { describe, expect, it } from 'vitest';
import type { FieldDescribe } from '../../src/web/src/api/types.js';
import { changedFields, toApiValue } from '../../src/web/src/lib/formValues.js';

const field = (name: string, type: string): FieldDescribe => ({ name, label: name, type, required: false, createable: true, updateable: true });

describe('form values', () => {
  it('converts form values to API values', () => {
    expect(toApiValue(field('Amount', 'currency'), '1500')).toBe(1500);
    expect(toApiValue(field('Title', 'string'), '')).toBeNull();
    expect(toApiValue(field('OwnerId', 'reference'), { id: '005X', name: 'Jon', object: 'User' })).toBe('005X');
  });

  it('sends only the fields that changed', () => {
    const fields = [field('Title', 'string'), field('Status', 'picklist'), field('AnnualRevenue', 'currency')];
    const record = { Title: 'CEO', Status: 'Open - Not Contacted', AnnualRevenue: 1000 };
    expect(changedFields(fields, record, { Title: 'CEO', Status: 'Working - Contacted', AnnualRevenue: '1000' })).toEqual({ Status: 'Working - Contacted' });
    expect(changedFields(fields, record, { Title: '' })).toEqual({ Title: null });
  });
});
