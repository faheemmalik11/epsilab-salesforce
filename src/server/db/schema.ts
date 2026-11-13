import { OBJECTS, type FieldDef, type ObjectDef } from '../metadata/index.js';
import type { Db } from './connection.js';

function sqlType(field: FieldDef): string {
  switch (field.type) {
    case 'boolean':
    case 'int':
      return 'INTEGER';
    case 'double':
    case 'currency':
    case 'percent':
      return 'REAL';
    default:
      return 'TEXT';
  }
}

function columnDef(field: FieldDef): string {
  if (field.name === 'Id') return '"Id" TEXT PRIMARY KEY';
  const parts = [`"${field.name}"`, sqlType(field)];
  if (field.type === 'boolean') parts.push(`NOT NULL DEFAULT 0 CHECK ("${field.name}" IN (0, 1))`);
  return parts.join(' ');
}

export function createTableSql(object: ObjectDef): string {
  const columns = object.fields.map(columnDef).join(',\n  ');
  return `CREATE TABLE "${object.name}" (\n  ${columns}\n) STRICT`;
}

/**
 * Text sorts use NOCASE, as Salesforce list views sort case-insensitively.
 * The Lead indexes serve the All Leads view: unconverted, sorted by Company, filtered by Rating.
 */
const INDEXES: readonly string[] = [
  'CREATE INDEX lead_company ON "Lead" ("IsConverted", "Company" COLLATE NOCASE, "Id")',
  'CREATE INDEX lead_rating_company ON "Lead" ("IsConverted", "Rating", "Company" COLLATE NOCASE, "Id")',
  'CREATE INDEX lead_owner ON "Lead" ("OwnerId")',
  'CREATE INDEX lead_last_modified ON "Lead" ("LastModifiedDate")',
  'CREATE INDEX account_name ON "Account" ("Name" COLLATE NOCASE, "Id")',
  'CREATE INDEX account_owner ON "Account" ("OwnerId")',
  'CREATE INDEX contact_account ON "Contact" ("AccountId")',
  'CREATE INDEX contact_name ON "Contact" ("LastName" COLLATE NOCASE, "Id")',
  'CREATE INDEX opportunity_account ON "Opportunity" ("AccountId")',
  'CREATE INDEX opportunity_name ON "Opportunity" ("Name" COLLATE NOCASE, "Id")',
  'CREATE INDEX ocr_opportunity ON "OpportunityContactRole" ("OpportunityId")',
  'CREATE INDEX ocr_contact ON "OpportunityContactRole" ("ContactId")',
  'CREATE INDEX task_who ON "Task" ("WhoId")',
  'CREATE INDEX task_what ON "Task" ("WhatId")',
  'CREATE INDEX task_owner_date ON "Task" ("OwnerId", "ActivityDate")',
];

const SUPPORT_TABLES: readonly string[] = [
  'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  'CREATE TABLE id_sequence (key_prefix TEXT PRIMARY KEY, last_value INTEGER NOT NULL) STRICT',
  `CREATE TABLE mutation_log (
    seq INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    actor_id TEXT,
    operation TEXT NOT NULL,
    object TEXT NOT NULL,
    record_id TEXT NOT NULL,
    before TEXT,
    after TEXT
  ) STRICT`,
];

export function schemaStatements(): string[] {
  return [...SUPPORT_TABLES, ...OBJECTS.map(createTableSql), ...INDEXES];
}

export function createSchema(db: Db): void {
  db.transaction(() => {
    for (const sql of schemaStatements()) db.exec(sql);
  })();
}
