export type ObjectName = 'User' | 'Lead' | 'Account' | 'Contact' | 'Opportunity' | 'OpportunityContactRole' | 'Task';

export type FieldValue = string | number | boolean | null;

export interface RelatedRef {
  attributes: { type: ObjectName; url: string };
  Id: string;
  Name: string | null;
}

/** A record as the REST API returns it: fields, attributes and nested relationships (Owner, Account…). */
export type SRecord = Record<string, unknown> & { Id: string; attributes: { type: ObjectName; url: string } };

export interface PicklistValue {
  value: string;
  isDefault?: boolean;
  converted?: boolean;
  closed?: boolean;
  won?: boolean;
  probability?: number;
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: string;
  required: boolean;
  createable: boolean;
  updateable: boolean;
  length?: number;
  defaultValue?: string | number | boolean;
  referenceTo?: ObjectName[];
  restrictedPicklist?: boolean;
  picklistValues?: PicklistValue[];
}

export interface ObjectDescribe {
  name: ObjectName;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  fields: FieldDescribe[];
}

export interface ApiErrorItem {
  errorCode: string;
  message: string;
  fields?: string[];
}

export interface QueryCondition {
  field: string;
  op: 'eq' | 'ne' | 'in' | 'isNull' | 'notNull' | 'contains';
  value?: unknown;
}

export interface QueryInput {
  object: ObjectName;
  where?: QueryCondition[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  totalSize: number;
  done: boolean;
  records: SRecord[];
}

export interface User {
  Id: string;
  Name: string;
  Alias: string | null;
  Email: string | null;
  IsActive: boolean;
}

export interface ConvertResult {
  leadId: string;
  accountId: string;
  contactId: string;
  opportunityId: string | null;
}

/** The response of POST /api/admin/reset. */
export interface ResetResult {
  snapshot: string;
  sha256: string;
  matches: boolean;
  durationMs: number;
  removedSideFiles: string[];
}

/** The app clock; every date the GUI treats as "today" comes from here, not the browser. */
export interface ClockInfo {
  now: string;
  today: string;
}
