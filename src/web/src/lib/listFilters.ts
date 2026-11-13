import type { FieldDescribe, QueryCondition } from '../api/types.js';

export type FilterOperator = 'eq' | 'ne' | 'contains';

export interface ListFilter {
  field: string;
  op: FilterOperator;
  value: string;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = { eq: 'equals', ne: 'not equal to', contains: 'contains' };

const TEXT_TYPES = new Set(['string', 'email', 'phone', 'url', 'textarea']);
const NUMBER_TYPES = new Set(['int', 'double', 'currency', 'percent']);
const OPERATORS = new Set<string>(['eq', 'ne', 'contains']);

/** Fields a list view can filter on: values a user can type or pick. Owner is picked from the users. */
export function isFilterable(field: FieldDescribe): boolean {
  if (field.name === 'OwnerId') return true;
  return TEXT_TYPES.has(field.type) || NUMBER_TYPES.has(field.type) || ['picklist', 'date', 'boolean'].includes(field.type);
}

/** The operators that make sense for a field: "contains" only for free text. */
export function operatorsFor(field: FieldDescribe): FilterOperator[] {
  return TEXT_TYPES.has(field.type) ? ['eq', 'ne', 'contains'] : ['eq', 'ne'];
}

/**
 * Filters live in the URL so a list view can be reloaded or shared: `Field:value` means equals, and
 * `Field.op:value` names another operator (field names never contain a dot).
 */
export function parseFilter(raw: string): ListFilter | null {
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const [field, op = 'eq'] = raw.slice(0, at).split('.');
  if (!field || !OPERATORS.has(op)) return null;
  return { field, op: op as FilterOperator, value: raw.slice(at + 1) };
}

export function serializeFilter(filter: ListFilter): string {
  return `${filter.field}${filter.op === 'eq' ? '' : `.${filter.op}`}:${filter.value}`;
}

/** The query condition for a filter, with the value typed as the field expects. */
export function filterCondition(filter: ListFilter, field: FieldDescribe | undefined): QueryCondition {
  let value: unknown = filter.value;
  if (field?.type === 'boolean') value = filter.value === 'true';
  else if (field && NUMBER_TYPES.has(field.type) && filter.value !== '' && !Number.isNaN(Number(filter.value))) value = Number(filter.value);
  return { field: filter.field, op: filter.op, value };
}
