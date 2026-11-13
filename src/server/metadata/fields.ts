import type { FieldDef, FieldType, ObjectName, Picklist } from './types.js';
import { defaultValueOf } from './picklists.js';

type FieldOptions = Partial<Omit<FieldDef, 'name' | 'label' | 'type'>>;

export function field(name: string, label: string, type: FieldType, options: FieldOptions = {}): FieldDef {
  return { name, label, type, required: false, createable: true, updateable: true, ...options };
}

/** System-maintained value: readable, never written by callers. */
export function derived(name: string, label: string, type: FieldType, options: FieldOptions = {}): FieldDef {
  return field(name, label, type, { createable: false, updateable: false, ...options });
}

export function picklist(name: string, label: string, list: Picklist, options: FieldOptions = {}): FieldDef {
  const defaultValue = defaultValueOf(list);
  return field(name, label, 'picklist', {
    picklist: list,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...options,
  });
}

export function reference(name: string, label: string, referenceTo: ObjectName[], options: FieldOptions = {}): FieldDef {
  return field(name, label, 'reference', { referenceTo, ...options });
}

export function checkbox(name: string, label: string, options: FieldOptions = {}): FieldDef {
  return field(name, label, 'boolean', { defaultValue: false, ...options });
}

export function idField(): FieldDef {
  return derived('Id', 'Record ID', 'id');
}

/** OwnerId is defaulted to the acting user when a create omits it. */
export function ownerField(label: string): FieldDef {
  return reference('OwnerId', label, ['User']);
}

export function auditFields(): FieldDef[] {
  return [
    derived('CreatedById', 'Created By', 'reference', { referenceTo: ['User'] }),
    derived('CreatedDate', 'Created Date', 'datetime'),
    derived('LastModifiedById', 'Last Modified By', 'reference', { referenceTo: ['User'] }),
    derived('LastModifiedDate', 'Last Modified Date', 'datetime'),
  ];
}

export function addressFields(prefix: string, labelPrefix: string): FieldDef[] {
  const label = (part: string) => (labelPrefix ? `${labelPrefix} ${part}` : part);
  return [
    field(`${prefix}Street`, label('Street'), 'textarea', { length: 255 }),
    field(`${prefix}City`, label('City'), 'string', { length: 40 }),
    field(`${prefix}State`, label('State/Province'), 'string', { length: 80 }),
    field(`${prefix}PostalCode`, label('Zip/Postal Code'), 'string', { length: 20 }),
    field(`${prefix}Country`, label('Country'), 'string', { length: 80 }),
  ];
}
