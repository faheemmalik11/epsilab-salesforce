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

const statements = new WeakMap<Db, Map<string, Database.Statement>>();
/** Distinct query shapes are few, but query.ts builds them dynamically, so the cache is bounded. */
const MAX_CACHED = 1000;

/**
 * A prepared statement for this connection, compiled once and reused. Preparing is the costliest
 * step of a small query, and the service layer runs the same few statements for every record.
 * A reset opens a new connection, which starts a new cache.
 */
export function statement(db: Db, sql: string): Database.Statement {
  let cache = statements.get(db);
  if (!cache) statements.set(db, (cache = new Map()));
  let prepared = cache.get(sql);
  if (!prepared) {
    if (cache.size >= MAX_CACHED) cache.clear();
    prepared = db.prepare(sql);
    cache.set(sql, prepared);
  }
  return prepared;
}
