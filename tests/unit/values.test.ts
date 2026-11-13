import { describe, expect, it } from 'vitest';
import { field } from '../../src/server/metadata/fields.js';
import { coerceValue, personName } from '../../src/server/services/records/values.js';

describe('coerceValue', () => {
  it('turns empty strings and null into null, except for booleans', () => {
    expect(coerceValue(field('Title', 'Title', 'string'), '')).toEqual({ ok: true, value: null });
    expect(coerceValue(field('Flag', 'Flag', 'boolean'), null).ok).toBe(false);
  });

  it('accepts only the right JSON type per field type', () => {
    expect(coerceValue(field('N', 'N', 'int'), 3).ok).toBe(true);
    expect(coerceValue(field('N', 'N', 'int'), 3.5).ok).toBe(false);
    expect(coerceValue(field('N', 'N', 'int'), '3').ok).toBe(false);
    expect(coerceValue(field('A', 'A', 'currency'), 12.5).ok).toBe(true);
    expect(coerceValue(field('A', 'A', 'currency'), Number.NaN).ok).toBe(false);
    expect(coerceValue(field('B', 'B', 'boolean'), 'true').ok).toBe(false);
  });

  it('accepts only real calendar dates', () => {
    const date = field('D', 'Close Date', 'date');
    expect(coerceValue(date, '2028-12-31')).toEqual({ ok: true, value: '2028-12-31' });
    expect(coerceValue(date, '2028-02-30').ok).toBe(false);
    expect(coerceValue(date, '12/31/2028').ok).toBe(false);
  });

  it('normalises datetimes to UTC ISO', () => {
    expect(coerceValue(field('T', 'T', 'datetime'), '2028-11-11T10:00:00+01:00')).toEqual({
      ok: true,
      value: '2028-11-11T09:00:00.000Z',
    });
  });

  it('rejects text over the field length with STRING_TOO_LONG', () => {
    const result = coerceValue(field('LastName', 'Last Name', 'string', { length: 3 }), 'abcd');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ errorCode: 'STRING_TOO_LONG', fields: ['LastName'] });
  });
});

describe('personName', () => {
  it('joins the non-empty parts', () => {
    expect(personName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(personName(null, 'Lovelace')).toBe('Lovelace');
    expect(personName('  ', null)).toBeNull();
  });
});
