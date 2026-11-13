import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createSchema } from './schema.js';

interface SeedManifest {
  fixture: string;
  counts: { leads: number; users: number };
}

/** Builds the database file from the seed. Runs at image build time, never at app startup. */
export function buildDatabase(dbFile: string, seedDir: string): void {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(seedDir, 'manifest.json'), 'utf8'),
  ) as SeedManifest;

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  fs.rmSync(dbFile, { force: true });

  const db = new Database(dbFile);
  try {
    db.pragma('journal_mode = DELETE');
    createSchema(db);
    const insert = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    db.transaction(() => {
      insert.run('fixture', manifest.fixture);
      insert.run('expected_leads', String(manifest.counts.leads));
      insert.run('expected_users', String(manifest.counts.users));
    })();
  } finally {
    db.close();
  }
}
