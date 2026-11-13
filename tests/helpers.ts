import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDatabase } from '../src/server/db/build.js';
import { openDatabase, type Db } from '../src/server/db/connection.js';

export const SEED_DIR = path.resolve('seed');

export interface TestDb {
  db: Db;
  file: string;
  cleanup: () => void;
}

export function createTestDb(): TestDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-test-'));
  const file = path.join(dir, 'app.db');
  buildDatabase(file, SEED_DIR);
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
