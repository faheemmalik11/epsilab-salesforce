import fs from 'node:fs';
import Database from 'better-sqlite3';

export type Db = Database.Database;

/** Opens an existing database without running any statement that writes. */
export function openDatabase(dbFile: string): Db {
  if (!fs.existsSync(dbFile)) {
    throw new Error(`Database not found at ${dbFile}. Run "pnpm build:db" first.`);
  }
  return new Database(dbFile, { fileMustExist: true });
}
