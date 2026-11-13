import { getObject, OBJECTS, type ObjectDef, type ObjectName } from './metadata/index.js';
import type { SObject } from './services/index.js';

// Response shapes shared by REST and MCP, following the Salesforce REST API.

export type PresentedRecord = { attributes: { type: ObjectName; url: string } } & Record<string, unknown>;

export function withAttributes(object: ObjectName, record: SObject): PresentedRecord {
  return { attributes: { type: object, url: `/api/sobjects/${object}/${String(record.Id)}` }, ...record };
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
