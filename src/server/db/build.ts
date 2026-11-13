import fs from 'node:fs';
import Database from 'better-sqlite3';
import path from 'node:path';
import { generateMinimal, type GenerateReport } from '../seed/generate.js';
import { importSeed, type ImportReport } from '../seed/importer.js';
import { readManifest } from '../seed/manifest.js';
import { createSchema } from './schema.js';

export interface BuildOptions {
  profile: string;
  clock: string;
}

export interface BuildReport {
  import: ImportReport;
  generated: GenerateReport;
}

function freshDatabase(dbFile: string): Database.Database {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  for (const suffix of ['', '-journal', '-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
  const db = new Database(dbFile);
  db.pragma('journal_mode = DELETE');
  return db;
}

function writeMeta(db: Database.Database, entries: Record<string, string>): void {
  const insert = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) insert.run(key, value);
  })();
}

/** Schema and seed metadata only, with no records. Used by tests that need an empty database. */
export function createEmptyDatabase(dbFile: string, seedDir: string): void {
  const manifest = readManifest(seedDir);
  const db = freshDatabase(dbFile);
  try {
    createSchema(db);
    writeMeta(db, {
      fixture: manifest.fixture,
      expected_leads: String(manifest.counts.leads),
      expected_users: String(manifest.counts.users),
    });
  } finally {
    db.close();
  }
}

/**
 * Builds the full database from scratch: schema, verified seed import, then the generated records.
 * Runs at image build time, never at app startup. Rebuilding from the same seed and options
 * always produces the same data.
 */
export function buildDatabase(dbFile: string, seedDir: string, options: BuildOptions): BuildReport {
  createEmptyDatabase(dbFile, seedDir);
  const db = new Database(dbFile, { fileMustExist: true });
  try {
    const imported = importSeed(db, seedDir);
    const generated = generateMinimal(db, options);
    writeMeta(db, { seed_profile: options.profile, clock: options.clock });
    return { import: imported, generated };
  } catch (error) {
    db.close();
    fs.rmSync(dbFile, { force: true });
    throw error;
  } finally {
    if (db.open) db.close();
  }
}
