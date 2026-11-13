import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEmptyDatabase } from '../src/server/db/build.js';
import { openDatabase, type Db } from '../src/server/db/connection.js';
import { createRuntime, type Runtime } from '../src/server/environment/runtime.js';
import { DbStore } from '../src/server/environment/store.js';

export const SEED_DIR = path.resolve('seed');

export interface TestDb {
  db: Db;
  file: string;
  cleanup: () => void;
}

export function createTestDb(): TestDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-test-'));
  const file = path.join(dir, 'app.db');
  createEmptyDatabase(file, SEED_DIR);
  const db = openDatabase(file);
  return {
    db,
    file,
    cleanup: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A runtime over an existing database file, with a fixed clock, for app-level tests. */
export function testRuntime(file: string): Runtime {
  return createRuntime({
    store: new DbStore(file),
    clock: { start: '2028-11-11T09:00:00Z', mode: 'fixed' },
    snapshots: { dir: path.join(path.dirname(file), 'snapshots'), profile: 'default' },
  });
}
