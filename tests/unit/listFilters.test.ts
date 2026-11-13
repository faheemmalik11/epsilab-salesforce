import { describe, expect, it } from 'vitest';
import type { FieldDescribe } from '../../src/web/src/api/types.js';
import { filterCondition, isFilterable, operatorsFor, parseFilter, serializeFilter } from '../../src/web/src/lib/listFilters.js';

const field = (name: string, type: string): FieldDescribe => ({ name, label: name, type, required: false, createable: true, updateable: true });

describe('list view filters', () => {
  it('reads and writes the URL form, keeping old Field:value links as equals', () => {
    expect(parseFilter('Rating:Hot')).toEqual({ field: 'Rating', op: 'eq', value: 'Hot' });
    expect(parseFilter('Company.contains:Roof: Co')).toEqual({ field: 'Company', op: 'contains', value: 'Roof: Co' });
    expect(parseFilter('Rating.ne:Cold')).toEqual({ field: 'Rating', op: 'ne', value: 'Cold' });
    expect(parseFilter('Rating.gt:1')).toBeNull();
    expect(parseFilter('nocolon')).toBeNull();
    for (const raw of ['Rating:Hot', 'Company.contains:Roof', 'Rating.ne:Cold']) expect(serializeFilter(parseFilter(raw)!)).toBe(raw);
  });

  it('offers contains only for text, and filters on typed values', () => {
    expect(operatorsFor(field('Company', 'string'))).toEqual(['eq', 'ne', 'contains']);
    expect(operatorsFor(field('Rating', 'picklist'))).toEqual(['eq', 'ne']);
    expect(isFilterable(field('OwnerId', 'reference'))).toBe(true);
    expect(isFilterable(field('AccountId', 'reference'))).toBe(false);
    expect(isFilterable(field('CreatedDate', 'datetime'))).toBe(false);
    expect(filterCondition({ field: 'AnnualRevenue', op: 'eq', value: '1500000' }, field('AnnualRevenue', 'currency'))).toEqual({ field: 'AnnualRevenue', op: 'eq', value: 1500000 });
    expect(filterCondition({ field: 'DoNotCall', op: 'eq', value: 'false' }, field('DoNotCall', 'boolean'))).toEqual({ field: 'DoNotCall', op: 'eq', value: false });
  });
});
