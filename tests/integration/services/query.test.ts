import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecord, queryRecords } from '../../../src/server/services/index.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
beforeEach(() => {
  f = createServiceFixture();
  const leads: [string, string, string | null][] = [
    ['b-corp', 'One', 'Hot'],
    ['Alpha', 'Two', 'Hot'],
    ['alpha', 'Three', 'Cold'],
    ['Charlie', 'Four', null],
    ['Bravo', 'Five', 'Warm'],
  ];
  for (const [Company, LastName, Rating] of leads) createRecord(f.ctx, 'Lead', { Company, LastName, Rating });
});
afterEach(() => f.cleanup());

const companies = (r: { records: Record<string, unknown>[] }) => r.records.map((x) => x.Company);

describe('queryRecords', () => {
  it('sorts text case-insensitively with a stable Id tiebreak', () => {
    const result = queryRecords(f.ctx, { object: 'Lead', orderBy: [{ field: 'Company' }] });
    expect(companies(result)).toEqual(['Alpha', 'alpha', 'b-corp', 'Bravo', 'Charlie']);
    expect(result.totalSize).toBe(5);
  });

  it('filters with eq, ne, in, isNull and contains', () => {
    const q = (where: Parameters<typeof queryRecords>[1]['where']) =>
      queryRecords(f.ctx, { object: 'Lead', where, orderBy: [{ field: 'Company' }] });
    expect(companies(q([{ field: 'Rating', op: 'eq', value: 'Hot' }]))).toEqual(['Alpha', 'b-corp']);
    expect(q([{ field: 'Rating', op: 'ne', value: 'Hot' }]).totalSize).toBe(3);
    expect(q([{ field: 'Rating', op: 'in', value: ['Cold', 'Warm'] }]).totalSize).toBe(2);
    expect(companies(q([{ field: 'Rating', op: 'isNull' }]))).toEqual(['Charlie']);
    expect(q([{ field: 'Company', op: 'contains', value: 'ALPH' }]).totalSize).toBe(2);
    expect(q([{ field: 'Company', op: 'contains', value: '%' }]).totalSize).toBe(0);
  });

  it('filters booleans given as JSON booleans', () => {
    expect(queryRecords(f.ctx, { object: 'Lead', where: [{ field: 'IsConverted', op: 'eq', value: false }] }).totalSize).toBe(5);
  });

  it('pages with limit and offset and reports the full total', () => {
    const page = queryRecords(f.ctx, { object: 'Lead', orderBy: [{ field: 'Company', direction: 'desc' }], limit: 2, offset: 2 });
    expect(page.totalSize).toBe(5);
    expect(page.done).toBe(false);
    expect(companies(page)).toEqual(['b-corp', 'alpha']);
  });

  it('rejects unknown fields and bad paging', () => {
    expect(errorsOf(() => queryRecords(f.ctx, { object: 'Lead', where: [{ field: 'Nope', op: 'eq', value: 1 }] }))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_FIELD', fields: ['Nope'] }),
    ]);
    expect(errorsOf(() => queryRecords(f.ctx, { object: 'Lead', limit: 0 }))).toEqual([expect.objectContaining({ errorCode: 'MALFORMED_QUERY' })]);
    expect(errorsOf(() => queryRecords(f.ctx, { object: 'Lead', limit: 5000 }))).toEqual([expect.objectContaining({ errorCode: 'MALFORMED_QUERY' })]);
    expect(errorsOf(() => queryRecords(f.ctx, { object: 'Lead', offset: -1 }))).toEqual([expect.objectContaining({ errorCode: 'MALFORMED_QUERY' })]);
    expect(
      errorsOf(() => queryRecords(f.ctx, { object: 'Lead', where: [{ field: 'Rating', op: 'like' as never, value: 'x' }] })),
    ).toEqual([expect.objectContaining({ errorCode: 'INVALID_QUERY_FILTER_OPERATOR', fields: ['Rating'] })]);
  });
});
