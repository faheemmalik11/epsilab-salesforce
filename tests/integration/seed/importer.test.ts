import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from '../../../src/server/db/connection.js';
import { createEmptyDatabase } from '../../../src/server/db/build.js';
import { importSeed } from '../../../src/server/seed/importer.js';
import { createTestDb, type TestDb } from '../../helpers.js';
import { realSample, writeSeedDir, type FixtureOptions, type Row } from '../../seedFixture.js';

const sample = realSample(40);
let t: TestDb;
const dirs: string[] = [];

beforeEach(() => (t = createTestDb()));
afterEach(() => {
  t.cleanup();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function seedDir(options: Partial<FixtureOptions> = {}): string {
  const dir = writeSeedDir({ users: sample.users, leads: sample.leads, ...options });
  dirs.push(dir);
  return dir;
}

function withLead(index: number, changes: Row): Row[] {
  return sample.leads.map((lead, i) => (i === index ? { ...lead, ...changes } : lead));
}

const count = (db: Db, table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n;

describe('importSeed with valid input', () => {
  it('imports every row, keeps the original IDs and resolves owners by full name', () => {
    const report = importSeed(t.db, seedDir());
    expect(report).toMatchObject({ users: 9, leads: 40 });
    const first = sample.leads[0]!;
    const lead = t.db.prepare('SELECT * FROM "Lead" WHERE "Id" = ?').get(first['Lead ID']) as Record<string, unknown>;
    const owner = t.db.prepare('SELECT "Name" FROM "User" WHERE "Id" = ?').get(lead.OwnerId) as { Name: string };
    expect(owner.Name).toBe(first['Lead Owner']);
    expect(lead).toMatchObject({ Company: first['Company / Account'], Status: first['Lead Status'], IsConverted: 0 });
  });

  it('keeps the seed Full Name even where it differs from First and Last Name', () => {
    importSeed(t.db, seedDir());
    const user = t.db.prepare(`SELECT "FirstName", "LastName", "Name" FROM "User" WHERE "Name" = 'Sabrina Stafford'`).get();
    expect(user).toEqual({ FirstName: null, LastName: 'Hoover', Name: 'Sabrina Stafford' });
  });

  it('stores user audit references to people outside the user list as null and reports them', () => {
    const report = importSeed(t.db, seedDir());
    expect(report.unresolvedUserReferences).toHaveLength(2);
    expect(report.unresolvedUserReferences.every((r) => r.endsWith('Tracy Hart'))).toBe(true);
  });

  it('refuses to import into a database that already has seed data, so nothing is duplicated', () => {
    const dir = seedDir();
    importSeed(t.db, dir);
    expect(() => importSeed(t.db, dir)).toThrow(/already contains seed data/);
    expect(count(t.db, 'Lead')).toBe(40);
    expect(count(t.db, 'User')).toBe(9);
  });
});

describe('importSeed rejects bad input and writes nothing', () => {
  const rejects = (dir: string, message: RegExp) => {
    expect(() => importSeed(t.db, dir)).toThrow(message);
    expect(count(t.db, 'Lead')).toBe(0);
    expect(count(t.db, 'User')).toBe(0);
  };

  it('a file whose hash does not match the manifest', () => {
    const dir = seedDir();
    const file = path.join(dir, 'leads.csv');
    const bytes = fs.readFileSync(file);
    bytes[bytes.length - 2] = bytes[bytes.length - 2] === 0x41 ? 0x42 : 0x41;
    fs.writeFileSync(file, bytes);
    rejects(dir, /leads\.csv does not match manifest\.json/);
  });

  it('a missing seed file or manifest', () => {
    const noLeads = seedDir();
    fs.rmSync(path.join(noLeads, 'leads.csv'));
    rejects(noLeads, /Seed file not found: .*leads\.csv/);
    const noManifest = seedDir();
    fs.rmSync(path.join(noManifest, 'manifest.json'));
    rejects(noManifest, /Seed file not found: .*manifest\.json/);
  });

  it('an unreadable manifest or one without an entry for a file', () => {
    const broken = seedDir();
    fs.writeFileSync(path.join(broken, 'manifest.json'), '{not json');
    rejects(broken, /not valid JSON/);
    rejects(seedDir({ editManifest: (m) => (m.files = m.files.filter((f: { path: string }) => f.path !== 'users-core.csv')) }), /no entry for users-core\.csv/);
  });

  it('malformed CSV', () => {
    const header = Object.keys(sample.leads[0]!).join(',');
    rejects(seedDir({ rawLeadsCsv: `${header}\n"unclosed quote,${'x,'.repeat(51)}x\n` }), /leads\.csv is not valid CSV/);
  });

  it('a missing column', () => {
    const leads = sample.leads.map(({ Rating: _drop, ...rest }) => rest);
    rejects(seedDir({ leads }), /leads\.csv is missing columns: Rating/);
  });

  it('values that break the documented formats, naming the row and column', () => {
    rejects(seedDir({ leads: withLead(2, { Converted: 'maybe' }) }), /leads\.csv row 4, column "Converted"/);
    rejects(seedDir({ leads: withLead(0, { 'Annual Revenue': '457000' }) }), /row 2, column "Annual Revenue"/);
    rejects(seedDir({ leads: withLead(0, { 'Create Date': '2028-11-09' }) }), /row 2, column "Create Date"/);
  });

  it('an owner name that is not a seed user', () => {
    rejects(seedDir({ leads: withLead(5, { 'Lead Owner': 'Nobody Here' }) }), /row 7, column "Lead Owner": "Nobody Here" is not a user/);
  });

  it('invalid, wrong-object or duplicate IDs', () => {
    const id = sample.leads[0]!['Lead ID']!;
    const badChecksum = id.slice(0, 17) + (id[17] === 'A' ? 'B' : 'A');
    rejects(seedDir({ leads: withLead(0, { 'Lead ID': badChecksum }) }), /not an 18-character Lead ID/);
    rejects(seedDir({ leads: withLead(0, { 'Lead ID': sample.users[0]!['User ID']! }) }), /not an 18-character Lead ID/);
    rejects(seedDir({ leads: withLead(1, { 'Lead ID': id }) }), /duplicate ID/);
  });

  it('counts that do not match the manifest, rolling back the inserted rows', () => {
    rejects(seedDir({ editManifest: (m) => (m.counts.rating_hot += 1) }), /Rating = Hot: expected/);
    rejects(seedDir({ editManifest: (m) => (m.counts.status.Prospecting += 1) }), /Lead Status "Prospecting"/);
  });
});

describe('createEmptyDatabase', () => {
  it('fails clearly without a manifest', () => {
    const dir = seedDir();
    fs.rmSync(path.join(dir, 'manifest.json'));
    expect(() => createEmptyDatabase(path.join(dir, 'x.db'), dir)).toThrow(/Seed file not found/);
  });

  it('gives a database that opens with no records', () => {
    expect(count(openDatabase(t.file), 'Lead')).toBe(0);
  });
});
