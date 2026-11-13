import type { Db } from '../db/connection.js';
import { isValidId } from '../db/ids.js';
import { getObject, type ObjectDef } from '../metadata/index.js';
import { personName, toColumnValue, type FieldValue, type SObject } from '../services/records/values.js';
import { rowError, SeedError } from './errors.js';
import { readManifest, readVerifiedFiles, SEED_FILES, type SeedManifest } from './manifest.js';
import * as t from './transform.js';

// Column mapping: docs/reference/lead-seed-mapping.md.

type Transform = (value: string) => FieldValue;
type Mapping = readonly (readonly [column: string, field: string, transform: Transform])[];

const LEAD_COLUMNS: Mapping = [
  ['Salutation', 'Salutation', t.text],
  ['First Name', 'FirstName', t.text],
  ['Last Name', 'LastName', t.text],
  ['Title', 'Title', t.text],
  ['Company / Account', 'Company', t.text],
  ['Email', 'Email', t.text],
  ['Phone', 'Phone', t.text],
  ['Mobile', 'MobilePhone', t.text],
  ['Fax', 'Fax', t.text],
  ['Website', 'Website', t.text],
  ['Street', 'Street', t.text],
  ['City', 'City', t.text],
  ['State/Province', 'State', t.text],
  ['Zip/Postal Code', 'PostalCode', t.text],
  ['Country', 'Country', t.text],
  ['Lead Status', 'Status', t.text],
  ['Rating', 'Rating', t.text],
  ['Lead Source', 'LeadSource', t.text],
  ['Industry', 'Industry', t.text],
  ['Annual Revenue', 'AnnualRevenue', t.currency],
  ['No. of Employees', 'NumberOfEmployees', t.integer],
  ['Description', 'Description', t.text],
  ['Converted', 'IsConverted', t.yesNo],
  ['Unread By Owner', 'IsUnreadByOwner', t.yesNo],
  ['Create Date', 'CreatedDate', t.dateAsDatetime],
  ['Last Modified', 'LastModifiedDate', t.dateAsDatetime],
  ['Last Activity', 'LastActivityDate', t.date],
];

/** Lead columns holding a user's full name, resolved to that user's ID. */
const LEAD_USER_COLUMNS = [
  ['Lead Owner', 'OwnerId'],
  ['Created By', 'CreatedById'],
  ['Last Modified By', 'LastModifiedById'],
] as const;

const USER_COLUMNS: Mapping = [
  ['Username', 'Username', t.text],
  ['First Name', 'FirstName', t.text],
  ['Last Name', 'LastName', t.text],
  ['Full Name', 'Name', t.text],
  ['Alias', 'Alias', t.text],
  ['Email', 'Email', t.text],
  ['Title', 'Title', t.text],
  ['Active', 'IsActive', t.yesNo],
  ['Profile', 'ProfileName', t.text],
  ['Time Zone', 'TimeZoneSidKey', t.text],
  ['Locale', 'LocaleSidKey', t.text],
  ['Language', 'LanguageLocaleKey', t.text],
  ['Last Login', 'LastLoginDate', t.datetime],
  ['Created Date', 'CreatedDate', t.datetime],
  ['Last Modified Date', 'LastModifiedDate', t.datetime],
];

const USER_AUDIT_COLUMNS = [
  ['Created By', 'CreatedById'],
  ['Last Modified By', 'LastModifiedById'],
] as const;

const LEAD_SOURCE_COLUMNS = ['Lead ID', ...LEAD_COLUMNS.map(([c]) => c), ...LEAD_USER_COLUMNS.map(([c]) => c)];
const USER_SOURCE_COLUMNS = ['User ID', ...USER_COLUMNS.map(([c]) => c), ...USER_AUDIT_COLUMNS.map(([c]) => c)];

export interface ImportReport {
  users: number;
  leads: number;
  droppedLeadColumns: string[];
  droppedUserColumns: string[];
  /** User audit references naming someone who is not in users-core.csv; stored as null. */
  unresolvedUserReferences: string[];
  /** Seed leads kept as-is although a field required on save is blank, such as Last Name. */
  leadsMissingRequiredFields: string[];
}

function mapColumns(file: string, rowNumber: number, row: t.CsvRow, mapping: Mapping, record: SObject): void {
  for (const [column, field, transform] of mapping) {
    try {
      record[field] = transform(row[column]!);
    } catch (error) {
      throw rowError(file, rowNumber, column, (error as Error).message);
    }
  }
}

function seedId(file: string, rowNumber: number, column: string, value: string, object: ObjectDef): string {
  if (value.length !== 18 || !isValidId(value) || !value.startsWith(object.keyPrefix)) {
    throw rowError(file, rowNumber, column, `"${value}" is not an 18-character ${object.name} ID`);
  }
  return value;
}

function insertAll(db: Db, object: ObjectDef, records: SObject[]): void {
  const fields = object.fields.filter((f) => records.some((r) => f.name in r));
  const sql = `INSERT INTO "${object.name}" (${fields.map((f) => `"${f.name}"`).join(', ')}) VALUES (${fields
    .map(() => '?')
    .join(', ')})`;
  const insert = db.prepare(sql);
  for (const record of records) insert.run(...fields.map((f) => toColumnValue(f, record[f.name] ?? null)));
}

function droppedColumns(header: string[], used: Iterable<string>): string[] {
  const keep = new Set(used);
  return header.filter((c) => !keep.has(c));
}

function mapUsers(rows: t.CsvRow[]): { users: SObject[]; idByName: Map<string, string>; unresolved: string[] } {
  const userObject = getObject('User');
  const file = SEED_FILES.users;
  const users: SObject[] = [];
  const idByName = new Map<string, string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const record: SObject = { Id: seedId(file, rowNumber, 'User ID', row['User ID']!, userObject) };
    mapColumns(file, rowNumber, row, USER_COLUMNS, record);
    const name = String(record.Name ?? '');
    if (!name) throw rowError(file, rowNumber, 'Full Name', 'is blank');
    if (idByName.has(name)) throw rowError(file, rowNumber, 'Full Name', `"${name}" appears more than once`);
    idByName.set(name, String(record.Id));
    users.push(record);
  });

  const unresolved: string[] = [];
  rows.forEach((row, index) => {
    for (const [column, field] of USER_AUDIT_COLUMNS) {
      const name = t.text(row[column]!);
      const id = name === null ? null : (idByName.get(name) ?? null);
      if (name !== null && id === null) unresolved.push(`${file} row ${index + 2} ${column}: ${name}`);
      users[index]![field] = id;
    }
  });
  return { users, idByName, unresolved };
}

function mapLeads(rows: t.CsvRow[], idByName: Map<string, string>): SObject[] {
  const leadObject = getObject('Lead');
  const file = SEED_FILES.leads;
  const seen = new Set<string>();

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const id = seedId(file, rowNumber, 'Lead ID', row['Lead ID']!, leadObject);
    if (seen.has(id)) throw rowError(file, rowNumber, 'Lead ID', `duplicate ID ${id}`);
    seen.add(id);

    const record: SObject = { Id: id };
    mapColumns(file, rowNumber, row, LEAD_COLUMNS, record);
    for (const [column, field] of LEAD_USER_COLUMNS) {
      const userId = idByName.get(row[column]!);
      if (!userId) throw rowError(file, rowNumber, column, `"${row[column]}" is not a user in ${SEED_FILES.users}`);
      record[field] = userId;
    }
    record.Name = personName(record.FirstName ?? null, record.LastName ?? null);
    return record;
  });
}

/** Compares the imported database, by query, against the counts in manifest.json. */
export function verifyAgainstManifest(db: Db, manifest: SeedManifest): void {
  const scalar = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;
  const problems: string[] = [];
  const expect = (label: string, actual: number, expected: number) => {
    if (actual !== expected) problems.push(`${label}: expected ${expected}, got ${actual}`);
  };

  expect('leads', scalar('SELECT COUNT(*) AS n FROM "Lead"'), manifest.counts.leads);
  expect('users', scalar('SELECT COUNT(*) AS n FROM "User"'), manifest.counts.users);
  expect('Rating = Hot', scalar(`SELECT COUNT(*) AS n FROM "Lead" WHERE "Rating" = 'Hot'`), manifest.counts.rating_hot);
  expect(
    'distinct Lead Source values',
    scalar('SELECT COUNT(DISTINCT "LeadSource") AS n FROM "Lead" WHERE "LeadSource" IS NOT NULL'),
    manifest.counts.lead_source_values,
  );
  const statuses = db.prepare('SELECT "Status" AS status, COUNT(*) AS n FROM "Lead" GROUP BY "Status"').all() as {
    status: string;
    n: number;
  }[];
  const actualStatus = Object.fromEntries(statuses.map((s) => [s.status, s.n]));
  for (const key of new Set([...Object.keys(actualStatus), ...Object.keys(manifest.counts.status)])) {
    expect(`Lead Status "${key}"`, actualStatus[key] ?? 0, manifest.counts.status[key] ?? 0);
  }
  if (problems.length > 0) throw new SeedError(`Imported data does not match manifest.json:\n  ${problems.join('\n  ')}`);
}

/**
 * Imports users and leads into an empty database in one transaction, then checks the
 * result against the manifest. Any failure leaves the database without seed rows.
 */
export function importSeed(db: Db, seedDir: string): ImportReport {
  const manifest = readManifest(seedDir);
  const files = readVerifiedFiles(seedDir, manifest);

  const userRows = t.parseCsv(SEED_FILES.users, files[SEED_FILES.users]!, USER_SOURCE_COLUMNS);
  const leadRows = t.parseCsv(SEED_FILES.leads, files[SEED_FILES.leads]!, LEAD_SOURCE_COLUMNS);

  const { users, idByName, unresolved } = mapUsers(userRows);
  const leads = mapLeads(leadRows, idByName);

  const existing = (db.prepare('SELECT (SELECT COUNT(*) FROM "Lead") + (SELECT COUNT(*) FROM "User") AS n').get() as {
    n: number;
  }).n;
  if (existing > 0) throw new SeedError('The database already contains seed data. Build a fresh database instead.');

  db.transaction(() => {
    insertAll(db, getObject('User'), users);
    insertAll(db, getObject('Lead'), leads);
    verifyAgainstManifest(db, manifest);
  })();

  return {
    users: users.length,
    leads: leads.length,
    droppedLeadColumns: droppedColumns(Object.keys(leadRows[0] ?? {}), LEAD_SOURCE_COLUMNS),
    droppedUserColumns: droppedColumns(Object.keys(userRows[0] ?? {}), USER_SOURCE_COLUMNS),
    unresolvedUserReferences: unresolved,
    leadsMissingRequiredFields: leads
      .filter((lead) => getObject('Lead').fields.some((f) => f.required && lead[f.name] === null))
      .map((lead) => String(lead.Id)),
  };
}
