import type { FieldDef, ObjectDef } from '../../metadata/index.js';
import { apiError, type ApiError } from '../errors.js';

export type FieldValue = string | number | boolean | null;
export type SObject = Record<string, FieldValue>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function typeError(field: FieldDef, value: unknown): ApiError {
  return apiError(
    'INVALID_TYPE_ON_FIELD_IN_RECORD',
    `${field.label}: value not of required type: ${String(value)}`,
    [field.name],
  );
}

export type Coerced = { ok: true; value: FieldValue } | { ok: false; error: ApiError };

/**
 * Checks one incoming value against its field type and returns the stored form.
 * Empty strings become null, as in Salesforce.
 */
export function coerceValue(field: FieldDef, raw: unknown): Coerced {
  if (raw === null || raw === undefined || raw === '') {
    return field.type === 'boolean' ? { ok: false, error: typeError(field, raw) } : { ok: true, value: null };
  }

  switch (field.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, error: typeError(field, raw) };
    case 'int':
      return typeof raw === 'number' && Number.isInteger(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: typeError(field, raw) };
    case 'double':
    case 'currency':
    case 'percent':
      return typeof raw === 'number' && Number.isFinite(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: typeError(field, raw) };
    case 'date':
      return typeof raw === 'string' && isRealDate(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: typeError(field, raw) };
    case 'datetime':
      return typeof raw === 'string' && !Number.isNaN(Date.parse(raw))
        ? { ok: true, value: new Date(raw).toISOString() }
        : { ok: false, error: typeError(field, raw) };
    default: {
      if (typeof raw !== 'string') return { ok: false, error: typeError(field, raw) };
      if (field.length !== undefined && raw.length > field.length) {
        return {
          ok: false,
          error: apiError(
            'STRING_TOO_LONG',
            `${field.label}: data value too large: ${raw.slice(0, 40)} (max length=${field.length})`,
            [field.name],
          ),
        };
      }
      return { ok: true, value: raw };
    }
  }
}

/** Converts a stored row to the API shape (SQLite stores booleans as 0 and 1). */
export function fromRow(object: ObjectDef, row: Record<string, unknown>): SObject {
  const record: SObject = {};
  for (const field of object.fields) {
    const value = row[field.name];
    if (value === undefined) continue;
    record[field.name] = field.type === 'boolean' ? value === 1 : (value as FieldValue);
  }
  return record;
}

export function toColumnValue(field: FieldDef, value: FieldValue): string | number | null {
  if (field.type === 'boolean') return value ? 1 : 0;
  return value as string | number | null;
}

export function personName(first: FieldValue, last: FieldValue): string | null {
  const name = [first, last].filter((part) => typeof part === 'string' && part.trim() !== '').join(' ');
  return name === '' ? null : name;
}
