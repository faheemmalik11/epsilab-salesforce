import type { Db } from './db/connection.js';
import { getObject, objectForId, OBJECTS, type ObjectDef, type ObjectName } from './metadata/index.js';
import type { SObject } from './services/index.js';

// Response shapes shared by REST and MCP, following the Salesforce REST API.

export type PresentedRecord = { attributes: { type: ObjectName; url: string } } & Record<string, unknown>;

export function withAttributes(object: ObjectName, record: SObject): PresentedRecord {
  return { attributes: { type: object, url: `/api/sobjects/${object}/${String(record.Id)}` }, ...record };
}

export interface RelatedRecord {
  attributes: { type: ObjectName; url: string };
  Id: string;
  Name: string | null;
}

/** The display column for each object: Task has a Subject instead of a Name. */
const NAME_COLUMN: Partial<Record<ObjectName, string>> = { Task: 'Subject' };

function relationshipName(fieldName: string): string {
  return fieldName.endsWith('Id') ? fieldName.slice(0, -2) : fieldName;
}

/** Looks up display names for every referenced ID, one query per target object. */
function lookupNames(db: Db, ids: Set<string>): Map<string, RelatedRecord> {
  const byObject = new Map<ObjectName, string[]>();
  for (const id of ids) {
    const target = objectForId(id);
    if (!target || target.name === 'OpportunityContactRole') continue;
    byObject.set(target.name, [...(byObject.get(target.name) ?? []), id]);
  }
  const found = new Map<string, RelatedRecord>();
  for (const [object, list] of byObject) {
    const column = NAME_COLUMN[object] ?? 'Name';
    const rows = db
      .prepare(`SELECT "Id", "${column}" AS name FROM "${object}" WHERE "Id" IN (${list.map(() => '?').join(', ')})`)
      .all(...list) as { Id: string; name: string | null }[];
    for (const row of rows) {
      found.set(row.Id, { attributes: { type: object, url: `/api/sobjects/${object}/${row.Id}` }, Id: row.Id, Name: row.name });
    }
  }
  return found;
}

/**
 * Records in the REST/MCP shape: Salesforce `attributes`, plus a nested relationship object for
 * every reference field (OwnerId → Owner: { Id, Name }), as a Salesforce relationship query returns.
 */
export function presentRecords(db: Db, object: ObjectName, records: SObject[]): PresentedRecord[] {
  const references = getObject(object).fields.filter((f) => f.type === 'reference');
  const ids = new Set<string>();
  for (const record of records) {
    for (const field of references) if (typeof record[field.name] === 'string') ids.add(String(record[field.name]));
  }
  const names = lookupNames(db, ids);
  return records.map((record) => {
    const presented: PresentedRecord = withAttributes(object, record);
    for (const field of references) {
      const id = record[field.name];
      presented[relationshipName(field.name)] = typeof id === 'string' ? (names.get(id) ?? null) : null;
    }
    return presented;
  });
}

export function presentRecord(db: Db, object: ObjectName, record: SObject): PresentedRecord {
  return presentRecords(db, object, [record])[0]!;
}

export function createdResult(record: SObject) {
  return { id: String(record.Id), success: true, errors: [] as never[] };
}

export function objectSummary(object: ObjectDef) {
  return {
    name: object.name,
    label: object.label,
    labelPlural: object.labelPlural,
    keyPrefix: object.keyPrefix,
    createable: !object.readOnly,
    updateable: !object.readOnly,
    deletable: !object.readOnly,
  };
}

export function listObjects() {
  return OBJECTS.map(objectSummary);
}

/** Field metadata for forms and agents: types, required flags, references and picklist values. */
export function describeObject(name: ObjectName) {
  const object = getObject(name);
  return {
    ...objectSummary(object),
    fields: object.fields.map((field) => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required,
      createable: field.createable && !object.readOnly,
      updateable: field.updateable && !object.readOnly,
      ...(field.length !== undefined ? { length: field.length } : {}),
      ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
      ...(field.referenceTo ? { referenceTo: field.referenceTo } : {}),
      ...(field.picklist
        ? { restrictedPicklist: field.picklist.restricted, picklistValues: field.picklist.values }
        : {}),
    })),
  };
}
