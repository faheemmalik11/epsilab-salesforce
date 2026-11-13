import { parse } from 'csv-parse/sync';
import { SeedError } from './errors.js';

// Value rules from seed/README.md. Each throws a plain Error; the caller adds file, row and column.

export type CsvRow = Record<string, string>;

export const BLANK = '-';

export function parseCsv(file: string, data: Buffer, requiredColumns: readonly string[]): CsvRow[] {
  let rows: CsvRow[];
  try {
    rows = parse(data, { columns: true, bom: true, skip_empty_lines: true }) as CsvRow[];
  } catch (error) {
    throw new SeedError(`${file} is not valid CSV: ${(error as Error).message}`);
  }
  const header = rows.length > 0 ? Object.keys(rows[0]!) : [];
  const missing = requiredColumns.filter((c) => !header.includes(c));
  if (missing.length > 0) throw new SeedError(`${file} is missing columns: ${missing.join(', ')}`);
  return rows;
}

export function text(value: string): string | null {
  return value === BLANK || value === '' ? null : value;
}

export function yesNo(value: string): boolean {
  if (value === 'feature included') return true;
  if (value === 'feature not included') return false;
  throw new Error(`expected "feature included" or "feature not included", got "${value}"`);
}

/** "$457,000" → 457000. */
export function currency(value: string): number | null {
  if (text(value) === null) return null;
  if (!/^\$\d{1,3}(,\d{3})*(\.\d+)?$/.test(value)) throw new Error(`expected a dollar amount like $457,000, got "${value}"`);
  return Number(value.slice(1).replaceAll(',', ''));
}

/** "1,250" → 1250. */
export function integer(value: string): number | null {
  if (text(value) === null) return null;
  if (!/^\d{1,3}(,\d{3})*$/.test(value)) throw new Error(`expected a whole number, got "${value}"`);
  return Number(value.replaceAll(',', ''));
}

function isoDate(month: number, day: number, year: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('is not a real calendar date');
  }
  return date.toISOString().slice(0, 10);
}

/** "11/09/2028" → "2028-11-09". */
export function date(value: string): string | null {
  if (text(value) === null) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error(`expected MM/DD/YYYY, got "${value}"`);
  try {
    return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  } catch {
    throw new Error(`"${value}" is not a real calendar date`);
  }
}

/** A date-only seed value becomes midnight UTC, since the seed carries no time. */
export function dateAsDatetime(value: string): string | null {
  const d = date(value);
  return d === null ? null : `${d}T00:00:00.000Z`;
}

/** "11/10/2028, 06:20 AM" → "2028-11-10T06:20:00.000Z" (read as UTC). */
export function datetime(value: string): string | null {
  if (text(value) === null) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) throw new Error(`expected "MM/DD/YYYY, hh:mm AM", got "${value}"`);
  const day = date(`${match[1]}/${match[2]}/${match[3]}`)!;
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour < 1 || hour > 12 || minute > 59) throw new Error(`"${value}" has an invalid time`);
  if (match[6] === 'AM' && hour === 12) hour = 0;
  if (match[6] === 'PM' && hour !== 12) hour += 12;
  return `${day}T${String(hour).padStart(2, '0')}:${match[5]}:00.000Z`;
}
