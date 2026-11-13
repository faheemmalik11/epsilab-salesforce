import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixedClock } from '../../../src/server/clock.js';
import { buildDatabase, type BuildReport } from '../../../src/server/db/build.js';
import { openDatabase, type Db } from '../../../src/server/db/connection.js';
import { getObject, type ObjectName } from '../../../src/server/metadata/index.js';
import { createRecord, queryRecords, resolveActingUser } from '../../../src/server/services/index.js';
import { SEED_DIR } from '../../helpers.js';
import { readSeed, seedManifest } from '../../seed.js';

const OPTIONS = { profile: 'default', clock: '2028-11-11T09:00:00Z' };
const GENERATED: ObjectName[] = ['Account', 'Contact', 'Opportunity', 'OpportunityContactRole', 'Task'];

const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const seedHashes = () => seedManifest.files.map((f: { path: string }) => sha256(path.join(SEED_DIR, f.path)));

let dir: string;
let dbFile: string;
let db: Db;
let report: BuildReport;
let seedHashesBefore: string[];
let builtHash: string;

beforeAll(() => {
  seedHashesBefore = seedHashes();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-full-'));
  dbFile = path.join(dir, 'app.db');
  report = buildDatabase(dbFile, SEED_DIR, OPTIONS);
  builtHash = sha256(dbFile);
  db = openDatabase(dbFile);
});
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const scalar = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;
const count = (table: string) => scalar(`SELECT COUNT(*) AS n FROM "${table}"`);

describe('full seed import (AC1)', () => {
  it('has exactly the manifest counts, checked by query', () => {
    expect(count('Lead')).toBe(21628);
    expect(count('User')).toBe(9);
    expect(count('Lead')).toBe(seedManifest.counts.leads);
    expect(scalar(`SELECT COUNT(*) AS n FROM "Lead" WHERE "Rating" = 'Hot'`)).toBe(7111);
    const statuses = db.prepare('SELECT "Status" AS s, COUNT(*) AS n FROM "Lead" GROUP BY "Status"').all() as { s: string; n: number }[];
    expect(Object.fromEntries(statuses.map((r) => [r.s, r.n]))).toEqual(seedManifest.counts.status);
    expect(scalar('SELECT COUNT(DISTINCT "LeadSource") AS n FROM "Lead"')).toBe(22);
    expect(scalar('SELECT COUNT(*) AS n FROM "Lead" WHERE "LeadSource" IS NULL')).toBe(98);
  });

  it('keeps the full Rating distribution from the seed README', () => {
    const rows = db.prepare(`SELECT COALESCE("Rating", '') AS r, COUNT(*) AS n FROM "Lead" GROUP BY 1`).all() as { r: string; n: number }[];
    expect(Object.fromEntries(rows.map((x) => [x.r, x.n]))).toEqual({ Hot: 7111, Cold: 4794, Warm: 1759, '': 7964 });
  });

  it('preserves every seed Lead and User ID exactly', () => {
    const leadIds = new Set((db.prepare('SELECT "Id" FROM "Lead"').all() as { Id: string }[]).map((r) => r.Id));
    expect(leadIds).toEqual(new Set(readSeed('leads.csv').map((r) => r['Lead ID'])));
    const userIds = new Set((db.prepare('SELECT "Id" FROM "User"').all() as { Id: string }[]).map((r) => r.Id));
    expect(userIds).toEqual(new Set(readSeed('users-core.csv').map((r) => r['User ID'])));
  });

  it('keeps ownership, status, rating and company identical to the CSV on every lead', () => {
    const rows = db
      .prepare('SELECT l."Id", l."Status", l."Rating", l."Company", u."Name" AS owner FROM "Lead" l JOIN "User" u ON u."Id" = l."OwnerId"')
      .all() as { Id: string; Status: string; Rating: string | null; Company: string; owner: string }[];
    const byId = new Map(rows.map((r) => [r.Id, r]));
    const mismatches = readSeed('leads.csv').filter((csv) => {
      const r = byId.get(csv['Lead ID']!)!;
      return (
        r.Status !== csv['Lead Status'] ||
        r.Rating !== (csv.Rating === '-' ? null : csv.Rating) ||
        r.Company !== csv['Company / Account'] ||
        r.owner !== csv['Lead Owner']
      );
    });
    expect(mismatches).toEqual([]);
  });

  it('keeps the real mess: placeholder names, salutation variants and two blank last names', () => {
    expect(scalar(`SELECT COUNT(*) AS n FROM "Lead" WHERE lower("LastName") = 'no name'`)).toBe(6648);
    const salutations = (db.prepare('SELECT DISTINCT "Salutation" AS s FROM "Lead" WHERE "Salutation" IS NOT NULL').all() as { s: string }[]).map((r) => r.s);
    expect(salutations.sort()).toEqual(['Mr', 'Mr.', 'Mr..', 'Mrs.', 'Ms', 'Ms.']);
    expect(report.import.leadsMissingRequiredFields).toEqual(['00Q556D6PL5TeTlE0K', '00QnkpO92bbmkOqECI']);
    expect(scalar('SELECT COUNT(*) AS n FROM "Lead" WHERE "LastName" IS NULL')).toBe(2);
  });

  it('has two inactive users and no converted leads', () => {
    expect((db.prepare('SELECT "Name" FROM "User" WHERE "IsActive" = 0 ORDER BY "Name"').all() as { Name: string }[]).map((r) => r.Name)).toEqual([
      'Andrew Larsen',
      'Christy Sanchez',
    ]);
    expect(scalar('SELECT COUNT(*) AS n FROM "Lead" WHERE "IsConverted" = 1')).toBe(0);
  });

  it('drops exactly the documented columns', () => {
    expect(report.import.droppedLeadColumns).toHaveLength(22);
    expect(report.import.droppedLeadColumns).toEqual(expect.arrayContaining(['Lead Record Type', 'Data.com Key', 'Created Month', 'Clean Status']));
  });
});

describe('generated records', () => {
  it('exist for every generated object, and no lead was created or converted', () => {
    for (const object of GENERATED) expect(count(object), object).toBeGreaterThan(0);
    expect(report.generated).toEqual(Object.fromEntries(GENERATED.map((o) => [o, count(o)])));
    expect(scalar(`SELECT COUNT(*) AS n FROM "Lead" WHERE "Id" LIKE '00QSB0%'`)).toBe(0);
    expect(scalar(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhoId" LIKE '00Q%'`)).toBe(0);
  });

  it('have no dangling references', () => {
    expect(scalar('SELECT COUNT(*) AS n FROM "Contact" WHERE "AccountId" NOT IN (SELECT "Id" FROM "Account")')).toBe(0);
    expect(scalar('SELECT COUNT(*) AS n FROM "Opportunity" WHERE "AccountId" NOT IN (SELECT "Id" FROM "Account")')).toBe(0);
    expect(
      scalar(`SELECT COUNT(*) AS n FROM "OpportunityContactRole"
        WHERE "OpportunityId" NOT IN (SELECT "Id" FROM "Opportunity") OR "ContactId" NOT IN (SELECT "Id" FROM "Contact")`),
    ).toBe(0);
    for (const table of ['Account', 'Contact', 'Opportunity', 'Task']) {
      expect(scalar(`SELECT COUNT(*) AS n FROM "${table}" WHERE "OwnerId" NOT IN (SELECT "Id" FROM "User" WHERE "IsActive" = 1)`), table).toBe(0);
    }
  });

  it('cover open and closed stages, including Closed Won and Closed Lost', () => {
    const stages = (db.prepare('SELECT "StageName" AS s FROM "Opportunity"').all() as { s: string }[]).map((r) => r.s);
    expect(stages).toEqual(expect.arrayContaining(['Closed Won', 'Closed Lost', 'Prospecting']));
  });

  it('satisfy the service-layer validation rules when saved again through the service', () => {
    // On a copy: any committed write changes SQLite header bytes, and other tests compare file hashes.
    const copyFile = path.join(dir, 'revalidate.db');
    fs.copyFileSync(dbFile, copyFile);
    const copy = openDatabase(copyFile);
    try {
      const ctx = { db: copy, clock: fixedClock(OPTIONS.clock), actingUserId: resolveActingUser(copy) };
      let saved = 0;
      for (const object of GENERATED) {
        const writable = getObject(object).fields.filter((f) => f.createable).map((f) => f.name);
        for (const record of queryRecords(ctx, { object, limit: 2000 }).records) {
          createRecord(ctx, object, Object.fromEntries(writable.map((name) => [name, record[name]])));
          saved++;
        }
      }
      expect(saved).toBe(GENERATED.reduce((n, o) => n + count(o), 0));
    } finally {
      copy.close();
    }
  });

  it('leave the mutation log empty in the baseline', () => {
    expect(count('mutation_log')).toBe(0);
  });
});

describe('All Leads groundwork (AC2)', () => {
  it('answers the All Leads, sorted by Company, Hot query with 7,111 in well under a second', () => {
    const ctx = { db, clock: fixedClock(OPTIONS.clock), actingUserId: resolveActingUser(db) };
    const started = performance.now();
    const result = queryRecords(ctx, {
      object: 'Lead',
      where: [
        { field: 'IsConverted', op: 'eq', value: false },
        { field: 'Rating', op: 'eq', value: 'Hot' },
      ],
      orderBy: [{ field: 'Company' }],
      limit: 50,
    });
    const elapsed = performance.now() - started;
    expect(result.totalSize).toBe(7111);
    expect(result.records).toHaveLength(50);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('repeatable builds', () => {
  it('rebuilding from the same seed and options gives a byte-identical database without duplicates', () => {
    const again = path.join(dir, 'again.db');
    buildDatabase(again, SEED_DIR, OPTIONS);
    expect(sha256(again)).toBe(builtHash);
    buildDatabase(again, SEED_DIR, OPTIONS);
    expect(sha256(again)).toBe(builtHash);
    const rebuilt = openDatabase(again);
    try {
      expect((rebuilt.prepare('SELECT COUNT(*) AS n FROM "Lead"').get() as { n: number }).n).toBe(21628);
      expect((rebuilt.prepare('SELECT COUNT(*) AS n FROM "Account"').get() as { n: number }).n).toBe(count('Account'));
    } finally {
      rebuilt.close();
    }
  });

  it('leaves the seed files byte-identical', () => {
    expect(seedHashes()).toEqual(seedHashesBefore);
    expect(seedHashesBefore).toEqual(seedManifest.files.map((f: { sha256: string }) => f.sha256));
  });
});
