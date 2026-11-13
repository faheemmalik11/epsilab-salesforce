import { describe, expect, it } from 'vitest';
import { currency, date, dateAsDatetime, datetime, integer, parseCsv, text, yesNo } from '../../src/server/seed/transform.js';

describe('seed value transforms', () => {
  it('treats "-" and empty as blank, and keeps other text verbatim', () => {
    expect(text('-')).toBeNull();
    expect(text('')).toBeNull();
    expect(text('Mr..')).toBe('Mr..');
    expect(text('  No Name ')).toBe('  No Name ');
  });

  it('maps the yes/no text and rejects anything else', () => {
    expect(yesNo('feature included')).toBe(true);
    expect(yesNo('feature not included')).toBe(false);
    expect(() => yesNo('yes')).toThrow(/feature included/);
    expect(() => yesNo('-')).toThrow();
  });

  it('parses dollar amounts with separators', () => {
    expect(currency('$457,000')).toBe(457000);
    expect(currency('$9')).toBe(9);
    expect(currency('$123,456,789')).toBe(123456789);
    expect(currency('$1,000.50')).toBe(1000.5);
    expect(currency('-')).toBeNull();
    for (const bad of ['457000', '$45,70', '$-5', 'USD 5']) expect(() => currency(bad), bad).toThrow();
  });

  it('parses whole numbers with thousands separators', () => {
    expect(integer('1,250')).toBe(1250);
    expect(integer('42')).toBe(42);
    expect(integer('-')).toBeNull();
    for (const bad of ['1.5', '12,34', 'ten', '-3']) expect(() => integer(bad), bad).toThrow();
  });

  it('parses MM/DD/YYYY dates and rejects impossible ones', () => {
    expect(date('11/09/2028')).toBe('2028-11-09');
    expect(dateAsDatetime('02/29/2028')).toBe('2028-02-29T00:00:00.000Z');
    expect(date('-')).toBeNull();
    for (const bad of ['2028-11-09', '13/01/2028', '02/30/2028', '1/9/2028']) expect(() => date(bad), bad).toThrow();
  });

  it('parses user timestamps with 12-hour clock edge cases', () => {
    expect(datetime('11/10/2028, 06:20 AM')).toBe('2028-11-10T06:20:00.000Z');
    expect(datetime('11/10/2028, 10:39 PM')).toBe('2028-11-10T22:39:00.000Z');
    expect(datetime('11/10/2028, 12:05 AM')).toBe('2028-11-10T00:05:00.000Z');
    expect(datetime('11/10/2028, 12:05 PM')).toBe('2028-11-10T12:05:00.000Z');
    expect(datetime('-')).toBeNull();
    for (const bad of ['11/10/2028 06:20', '11/10/2028, 13:00 PM', '11/10/2028, 00:10 AM']) {
      expect(() => datetime(bad), bad).toThrow();
    }
  });
});

describe('parseCsv', () => {
  it('reads quoted fields containing commas and newlines', () => {
    const rows = parseCsv('t.csv', Buffer.from('A,B\n"x, y","line1\nline2"\n'), ['A', 'B']);
    expect(rows).toEqual([{ A: 'x, y', B: 'line1\nline2' }]);
  });

  it('rejects malformed CSV and missing columns', () => {
    expect(() => parseCsv('t.csv', Buffer.from('A,B\n"unclosed,1\n'), ['A'])).toThrow(/not valid CSV/);
    expect(() => parseCsv('t.csv', Buffer.from('A\n1\n'), ['A', 'B'])).toThrow(/missing columns: B/);
  });
});
