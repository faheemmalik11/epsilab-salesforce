import type { FieldDescribe, ObjectName, RelatedRef } from '../api/types.js';

export interface LookupValue {
  id: string;
  name: string;
  object: ObjectName;
}

export type FormValue = string | boolean | LookupValue | null;

const NUMERIC = new Set(['int', 'double', 'currency', 'percent']);

/** The form value a field starts with when editing a record. */
export function initialValue(field: FieldDescribe, record: Record<string, unknown>): FormValue {
  const raw = record[field.name];
  if (raw === null || raw === undefined) return field.type === 'boolean' ? false : null;
  if (field.type === 'reference') {
    const related = record[field.name.replace(/Id$/, '')] as RelatedRef | null;
    return related ? { id: related.Id, name: related.Name ?? related.Id, object: related.attributes.type } : null;
  }
  if (field.type === 'boolean') return raw === true;
  return String(raw);
}

/** Converts a form value to the JSON the API expects. Validation itself happens in the API. */
export function toApiValue(field: FieldDescribe, value: FormValue): unknown {
  if (value === null || value === '') return null;
  if (typeof value === 'object') return value.id;
  if (typeof value === 'boolean') return value;
  if (NUMERIC.has(field.type)) {
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
  }
  return value;
}

/** The fields whose value differs from the record's, as an API payload. */
export function changedFields(fields: FieldDescribe[], record: Record<string, unknown>, values: Record<string, FormValue>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in values)) continue;
    const value = toApiValue(field, values[field.name] ?? null);
    if (value !== toApiValue(field, initialValue(field, record))) payload[field.name] = value;
  }
  return payload;
}
