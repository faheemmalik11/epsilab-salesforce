import { getObject, type FieldDef, type ObjectDef, type ObjectName } from '../../metadata/index.js';
import type { ServiceContext } from '../context.js';
import { apiError, ServiceError, type ApiError } from '../errors.js';
import { coerceValue, fromRow, toColumnValue, type SObject } from './values.js';

export type Operator = 'eq' | 'ne' | 'in' | 'isNull' | 'notNull' | 'contains';

export interface Condition {
  field: string;
  op: Operator;
  value?: unknown;
}

export interface SortSpec {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface QueryOptions {
  object: ObjectName;
  where?: Condition[];
  orderBy?: SortSpec[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  totalSize: number;
  done: boolean;
  records: SObject[];
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 2000;

const TEXT_TYPES = new Set(['string', 'textarea', 'email', 'phone', 'url', 'picklist']);

function invalidField(object: ObjectDef, name: string): ApiError {
  return apiError('INVALID_FIELD', `No such column '${name}' on entity '${object.name}'`, [name]);
}

function storedValue(field: FieldDef, raw: unknown, errors: ApiError[]): string | number | null {
  const coerced = coerceValue(field, raw);
  if (!coerced.ok) {
    errors.push(coerced.error);
    return null;
  }
  return toColumnValue(field, coerced.value);
}

function conditionSql(field: FieldDef, condition: Condition, params: unknown[], errors: ApiError[]): string {
  const column = `"${field.name}"`;
  switch (condition.op) {
    case 'isNull':
      return `${column} IS NULL`;
    case 'notNull':
      return `${column} IS NOT NULL`;
    case 'eq':
      params.push(storedValue(field, condition.value, errors));
      return `${column} = ?`;
    case 'ne':
      params.push(storedValue(field, condition.value, errors));
      return `(${column} IS NULL OR ${column} <> ?)`;
    case 'in': {
      const list = Array.isArray(condition.value) ? condition.value : [];
      if (list.length === 0) return '0';
      list.forEach((v) => params.push(storedValue(field, v, errors)));
      return `${column} IN (${list.map(() => '?').join(', ')})`;
    }
    case 'contains': {
      const text = String(condition.value ?? '').replace(/[\\%_]/g, (c) => `\\${c}`);
      params.push(`%${text}%`);
      return `${column} LIKE ? ESCAPE '\\'`;
    }
    default:
      errors.push(
        apiError('INVALID_QUERY_FILTER_OPERATOR', `Unsupported operator '${String(condition.op)}'`, [field.name]),
      );
      return '1';
  }
}

/** Filters, sorts and pages one object. Text sorts are case-insensitive, with Id as the tiebreaker. */
export function queryRecords(ctx: ServiceContext, options: QueryOptions): QueryResult {
  const object = getObject(options.object);
  const errors: ApiError[] = [];
  const params: unknown[] = [];
  const fieldOf = (name: string) => object.fields.find((f) => f.name === name);

  const clauses = (options.where ?? []).map((condition) => {
    const field = fieldOf(condition.field);
    if (!field) {
      errors.push(invalidField(object, condition.field));
      return '1';
    }
    return conditionSql(field, condition, params, errors);
  });

  const sorts = (options.orderBy ?? []).map((sort) => {
    const field = fieldOf(sort.field);
    if (!field) {
      errors.push(invalidField(object, sort.field));
      return '';
    }
    const collate = TEXT_TYPES.has(field.type) ? ' COLLATE NOCASE' : '';
    return `"${field.name}"${collate} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
  });

  const limit = options.limit ?? DEFAULT_LIMIT;
  const offset = options.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push(apiError('MALFORMED_QUERY', `limit must be an integer from 1 to ${MAX_LIMIT}`));
  }
  if (!Number.isInteger(offset) || offset < 0) {
    errors.push(apiError('MALFORMED_QUERY', 'offset must be a non-negative integer'));
  }
  if (errors.length > 0) throw new ServiceError(errors);

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const lastDirection = options.orderBy?.at(-1)?.direction === 'desc' ? 'DESC' : 'ASC';
  const orderBy = `ORDER BY ${[...sorts, `"Id" ${lastDirection}`].join(', ')}`;

  const { total } = ctx.db.prepare(`SELECT COUNT(*) AS total FROM "${object.name}" ${where}`).get(...params) as {
    total: number;
  };
  const rows = ctx.db
    .prepare(`SELECT * FROM "${object.name}" ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[];

  return {
    totalSize: total,
    done: offset + rows.length >= total,
    records: rows.map((row) => fromRow(object, row)),
  };
}
