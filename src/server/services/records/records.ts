import { nextId, isValidId, toId18 } from '../../db/ids.js';
import { statement } from '../../db/connection.js';
import { getObject, objectForId, type FieldDef, type ObjectDef, type ObjectName } from '../../metadata/index.js';
import type { ServiceContext } from '../context.js';
import { apiError, fail, notFound, requiredFieldsMissing, ServiceError, type ApiError } from '../errors.js';
import { logMutation } from '../mutationLog.js';
import { OBJECT_RULES } from './objectRules.js';
import type { RuleOps, WriteEvent } from './rules.js';
import { coerceValue, fromRow, toColumnValue, type FieldValue, type SObject } from './values.js';

export interface WriteOptions {
  /** System writes may set fields callers can't, such as lead conversion fields. */
  system?: boolean;
}

const AUDIT_FIELDS = new Set(['Id', 'CreatedById', 'CreatedDate', 'LastModifiedById', 'LastModifiedDate']);

function assertWritable(object: ObjectDef, action: 'create' | 'edit' | 'delete'): void {
  if (object.readOnly) {
    fail('INSUFFICIENT_ACCESS_OR_READONLY', `You don't have permission to ${action} ${object.label} records.`);
  }
}

function hasField(object: ObjectDef, name: string): boolean {
  return object.fields.some((f) => f.name === name);
}

function ruleOps(ctx: ServiceContext): RuleOps {
  return {
    updateSystem: (object, id, values) => {
      updateRecord(ctx, object, id, values, { system: true });
    },
  };
}

export function getRecord(ctx: ServiceContext, objectName: ObjectName, id: string): SObject {
  const object = getObject(objectName);
  const recordId = parseRecordId(object, id);
  const row = statement(ctx.db, `SELECT * FROM "${object.name}" WHERE "Id" = ?`).get(recordId);
  if (!row) notFound();
  return fromRow(object, row as Record<string, unknown>);
}

function findRecord(ctx: ServiceContext, object: ObjectDef, id: string): SObject | null {
  const row = statement(ctx.db, `SELECT * FROM "${object.name}" WHERE "Id" = ?`).get(id);
  return row ? fromRow(object, row as Record<string, unknown>) : null;
}

/** Validates a record ID from a caller and returns its 18-character form. Wrong object counts as not found. */
function parseRecordId(object: ObjectDef, id: string): string {
  if (typeof id !== 'string' || !isValidId(id) || !id.startsWith(object.keyPrefix)) notFound();
  return toId18(id);
}

/** Checks caller-supplied field names and values, collecting every error. */
function coerceInput(
  object: ObjectDef,
  input: Record<string, unknown>,
  kind: 'create' | 'update',
  system: boolean,
  errors: ApiError[],
): SObject {
  const values: SObject = {};
  for (const [name, raw] of Object.entries(input)) {
    if (name === 'Id') {
      errors.push(apiError('INVALID_FIELD', 'The Id field should not be specified in the sobject data.', ['Id']));
      continue;
    }
    const field = object.fields.find((f) => f.name === name);
    if (!field) {
      errors.push(apiError('INVALID_FIELD', `No such column '${name}' on sobject of type ${object.name}`, [name]));
      continue;
    }
    const writable = kind === 'create' ? field.createable : field.updateable;
    if (!writable && !system) {
      errors.push(
        apiError('INVALID_FIELD_FOR_INSERT_UPDATE', `Unable to ${kind} fields: ${name}. The field is read-only.`, [name]),
      );
      continue;
    }
    const coerced = coerceValue(field, raw);
    if (coerced.ok) values[name] = coerced.value;
    else errors.push(coerced.error);
  }
  return values;
}

function checkPicklists(object: ObjectDef, values: SObject, errors: ApiError[]): void {
  for (const [name, value] of Object.entries(values)) {
    const field = object.fields.find((f) => f.name === name)!;
    if (field.type !== 'picklist' || !field.picklist?.restricted || value === null) continue;
    if (!field.picklist.values.some((v) => v.value === value)) {
      errors.push(
        apiError(
          'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST',
          `${field.label}: bad value for restricted picklist field: ${String(value)}`,
          [name],
        ),
      );
    }
  }
}

function checkReference(
  ctx: ServiceContext,
  field: FieldDef,
  value: FieldValue,
  errors: ApiError[],
): FieldValue {
  if (value === null) return null;
  const id = String(value);
  if (!isValidId(id)) {
    errors.push(apiError('MALFORMED_ID', `${field.label}: id value of incorrect type: ${id}`, [field.name]));
    return value;
  }
  const id18 = toId18(id);
  const target = objectForId(id18);
  const exists =
    target !== undefined &&
    field.referenceTo!.includes(target.name) &&
    statement(ctx.db, `SELECT 1 FROM "${target.name}" WHERE "Id" = ?`).get(id18) !== undefined;
  if (!exists) {
    errors.push(apiError('INVALID_CROSS_REFERENCE_KEY', `${field.label}: invalid cross reference id`, [field.name]));
  }
  return id18;
}

function checkReferences(ctx: ServiceContext, object: ObjectDef, values: SObject, errors: ApiError[]): void {
  for (const field of object.fields) {
    if (field.type !== 'reference' || !(field.name in values)) continue;
    values[field.name] = checkReference(ctx, field, values[field.name] ?? null, errors);
  }
}

function checkOwnerActive(ctx: ServiceContext, object: ObjectDef, ownerId: FieldValue, errors: ApiError[]): void {
  if (typeof ownerId !== 'string') return;
  const user = statement(ctx.db, 'SELECT "IsActive" FROM "User" WHERE "Id" = ?').get(ownerId) as
    | { IsActive: number }
    | undefined;
  if (user && user.IsActive !== 1) {
    errors.push(
      apiError('INACTIVE_OWNER_OR_USER', `Operation performed with inactive user ${ownerId} as owner of ${object.label}.`, [
        'OwnerId',
      ]),
    );
  }
}

/** Required fields with no value, skipping fields that already have a value error. */
function missingRequired(object: ObjectDef, record: SObject, errors: ApiError[]): string[] {
  const alreadyReported = new Set(errors.flatMap((e) => e.fields ?? []));
  return object.fields
    .filter((f) => f.required && !alreadyReported.has(f.name))
    .filter((f) => record[f.name] === null || record[f.name] === undefined)
    .map((f) => f.name);
}

function throwIfAny(errors: ApiError[]): void {
  if (errors.length > 0) throw new ServiceError(errors);
}

function insertRow(ctx: ServiceContext, object: ObjectDef, record: SObject): void {
  const fields = object.fields.filter((f) => f.name in record);
  const columns = fields.map((f) => `"${f.name}"`).join(', ');
  const placeholders = fields.map(() => '?').join(', ');
  statement(ctx.db, `INSERT INTO "${object.name}" (${columns}) VALUES (${placeholders})`)
    .run(...fields.map((f) => toColumnValue(f, record[f.name] ?? null)));
}

function updateRow(ctx: ServiceContext, object: ObjectDef, id: string, changes: SObject): void {
  const fields = object.fields.filter((f) => f.name in changes);
  if (fields.length === 0) return;
  const assignments = fields.map((f) => `"${f.name}" = ?`).join(', ');
  statement(ctx.db, `UPDATE "${object.name}" SET ${assignments} WHERE "Id" = ?`)
    .run(...fields.map((f) => toColumnValue(f, changes[f.name] ?? null)), id);
}

export function createRecord(
  ctx: ServiceContext,
  objectName: ObjectName,
  input: Record<string, unknown>,
  options: WriteOptions = {},
): SObject {
  const object = getObject(objectName);
  assertWritable(object, 'create');
  const system = options.system ?? false;
  const errors: ApiError[] = [];
  const values = coerceInput(object, input, 'create', system, errors);

  const next: SObject = {};
  for (const field of object.fields) {
    if (AUDIT_FIELDS.has(field.name)) continue;
    if (field.name in values) next[field.name] = values[field.name]!;
    else if (field.defaultValue !== undefined) next[field.name] = field.defaultValue;
    else next[field.name] = null;
  }
  if (hasField(object, 'OwnerId') && next.OwnerId === null) next.OwnerId = ctx.actingUserId;

  const missing = missingRequired(object, next, errors);
  if (missing.length > 0) errors.push(requiredFieldsMissing(missing));
  checkPicklists(object, values, errors);
  checkReferences(ctx, object, next, errors);
  if (hasField(object, 'OwnerId')) checkOwnerActive(ctx, object, next.OwnerId ?? null, errors);
  throwIfAny(errors);

  return ctx.db.transaction(() => {
    const event: WriteEvent = { ctx, kind: 'create', next, previous: null, supplied: new Set(Object.keys(values)), system };
    OBJECT_RULES[objectName]?.beforeWrite?.(event);

    const now = ctx.clock.now();
    const record: SObject = {
      Id: nextId(ctx.db, object.keyPrefix),
      ...next,
      CreatedById: ctx.actingUserId,
      CreatedDate: now,
      LastModifiedById: ctx.actingUserId,
      LastModifiedDate: now,
    };
    insertRow(ctx, object, record);
    const saved = findRecord(ctx, object, String(record.Id))!;
    logMutation(ctx, 'create', objectName, String(saved.Id), null, saved);
    OBJECT_RULES[objectName]?.afterWrite?.({ ...event, saved }, ruleOps(ctx));
    return saved;
  })();
}

export function updateRecord(
  ctx: ServiceContext,
  objectName: ObjectName,
  id: string,
  input: Record<string, unknown>,
  options: WriteOptions = {},
): SObject {
  const object = getObject(objectName);
  assertWritable(object, 'edit');
  const system = options.system ?? false;
  const recordId = parseRecordId(object, id);
  const previous = findRecord(ctx, object, recordId);
  if (!previous) notFound();
  OBJECT_RULES[objectName]?.guard?.(ctx, previous, system);

  const errors: ApiError[] = [];
  const values = coerceInput(object, input, 'update', system, errors);
  const next: SObject = { ...previous, ...values };

  const missing = missingRequired(object, next, errors);
  if (missing.length > 0) errors.push(requiredFieldsMissing(missing));
  checkPicklists(object, values, errors);
  checkReferences(ctx, object, values, errors);
  Object.assign(next, values);
  if ('OwnerId' in values && values.OwnerId !== previous.OwnerId) {
    checkOwnerActive(ctx, object, values.OwnerId ?? null, errors);
  }

  throwIfAny(errors);

  return ctx.db.transaction(() => {
    const event: WriteEvent = { ctx, kind: 'update', next, previous, supplied: new Set(Object.keys(values)), system };
    OBJECT_RULES[objectName]?.beforeWrite?.(event);

    const changes: SObject = {};
    for (const field of object.fields) {
      if (AUDIT_FIELDS.has(field.name)) continue;
      if (next[field.name] !== previous[field.name]) changes[field.name] = next[field.name] ?? null;
    }
    changes.LastModifiedById = ctx.actingUserId;
    changes.LastModifiedDate = ctx.clock.now();
    updateRow(ctx, object, recordId, changes);

    const saved = findRecord(ctx, object, recordId)!;
    logMutation(ctx, 'update', objectName, recordId, previous, saved);
    OBJECT_RULES[objectName]?.afterWrite?.({ ...event, saved }, ruleOps(ctx));
    return saved;
  })();
}

export function deleteRecord(ctx: ServiceContext, objectName: ObjectName, id: string): void {
  const object = getObject(objectName);
  assertWritable(object, 'delete');
  const recordId = parseRecordId(object, id);
  ctx.db.transaction(() => deleteCascade(ctx, object, recordId))();
}

function deleteCascade(ctx: ServiceContext, object: ObjectDef, id: string): void {
  const record = findRecord(ctx, object, id);
  if (!record) notFound();
  const rules = OBJECT_RULES[object.name];
  rules?.beforeDelete?.(ctx, record);
  for (const dependent of rules?.dependents?.(ctx, record) ?? []) {
    const child = getObject(dependent.object);
    for (const childId of dependent.ids) {
      if (findRecord(ctx, child, childId)) deleteCascade(ctx, child, childId);
    }
  }
  statement(ctx.db, `DELETE FROM "${object.name}" WHERE "Id" = ?`).run(id);
  logMutation(ctx, 'delete', object.name, id, record, null);
}
