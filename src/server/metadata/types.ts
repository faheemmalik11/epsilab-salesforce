export type ObjectName =
  | 'User'
  | 'Lead'
  | 'Account'
  | 'Contact'
  | 'Opportunity'
  | 'OpportunityContactRole'
  | 'Task';

export type FieldType =
  | 'id'
  | 'string'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'picklist'
  | 'boolean'
  | 'int'
  | 'double'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'reference';

export interface PicklistValue {
  value: string;
  isDefault?: boolean;
}

export interface Picklist<V extends PicklistValue = PicklistValue> {
  values: readonly V[];
  /** Restricted picklists reject values outside the list on create and update. */
  restricted: boolean;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  /** Must be supplied on create (not nillable and not defaulted). */
  required: boolean;
  createable: boolean;
  updateable: boolean;
  defaultValue?: string | number | boolean;
  picklist?: Picklist;
  referenceTo?: readonly ObjectName[];
  /** Maximum length for text types. */
  length?: number;
}

export interface ObjectDef {
  name: ObjectName;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  fields: readonly FieldDef[];
}
