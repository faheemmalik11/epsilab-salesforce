import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fail } from '../services/errors.js';
import type { Runtime, SnapshotConfig } from './runtime.js';

// The database runs in rollback-journal mode, so outside a write transaction it is exactly one file.
// A snapshot is a copy of that file plus its sha256; "byte-identical" means the hashes match.

export const BASELINE = 'baseline';
/** The seed alone: 21,628 leads and 9 users, with no generated records. */
export const SEED_ONLY = 'seed-only';
const RESERVED = /^(baseline|seed-only)(-|$)/;
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SIDE_FILES = ['-journal', '-wal', '-shm'];

export interface SnapshotInfo {
  name: string;
  sha256: string;
  bytes: number;
}

export interface ResetResult {
  snapshot: string;
  sha256: string;
  matches: boolean;
  durationMs: number;
  removedSideFiles: string[];
}

export interface VerifyResult {
  snapshot: string;
  expectedSha256: string;
  actualSha256: string;
  matches: boolean;
  sideFiles: string[];
  tables: { name: string; rows: number; matches: boolean }[];
  contentMatches: boolean;
}

export function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function baselineFile(dir: string, profile: string): string {
  return path.join(dir, `baseline-${profile}.db`);
}

export function seedOnlyFile(dir: string, profile: string): string {
  return path.join(dir, `seed-only-${profile}.db`);
}

function snapshotFile(config: SnapshotConfig, name: string): string {
  if (name === BASELINE) return baselineFile(config.dir, config.profile);
  if (name === SEED_ONLY) return seedOnlyFile(config.dir, config.profile);
  if (!NAME.test(name) || RESERVED.test(name)) {
    fail('INVALID_SNAPSHOT', `Snapshot names use lowercase letters, digits and dashes (max 40): "${name}"`);
  }
  return path.join(config.dir, `${name}.db`);
}

function expectedHash(file: string, name: string): string {
  if (!fs.existsSync(file) || !fs.existsSync(`${file}.sha256`)) fail('NOT_FOUND', `Snapshot "${name}" does not exist`);
  return fs.readFileSync(`${file}.sha256`, 'utf8').trim();
}

/** Copies via a temporary file and a rename, so a crash never leaves a half-written target. */
function copyAtomically(source: string, target: string): void {
  const temp = `${target}.tmp-${process.pid}`;
  fs.copyFileSync(source, temp);
  fs.renameSync(temp, target);
}

function removeSideFiles(dbFile: string): string[] {
  const removed: string[] = [];
  for (const suffix of SIDE_FILES) {
    if (fs.existsSync(dbFile + suffix)) {
      fs.rmSync(dbFile + suffix);
      removed.push(path.basename(dbFile + suffix));
    }
  }
  return removed;
}

/** Writes `source` as a snapshot file plus its .sha256. Used at build time and for named snapshots. */
export function writeSnapshot(source: string, target: string): SnapshotInfo {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  copyAtomically(source, target);
  const sha256 = sha256File(target);
  fs.writeFileSync(`${target}.sha256`, `${sha256}\n`);
  return { name: path.basename(target, '.db'), sha256, bytes: fs.statSync(target).size };
}

export function createSnapshot(runtime: Runtime, name: string): SnapshotInfo {
  if (name === BASELINE || name === SEED_ONLY) fail('INVALID_SNAPSHOT', `The ${name} snapshot is built with the image and cannot be replaced`);
  const target = snapshotFile(runtime.snapshots, name);
  return runtime.store.swap(() => ({ ...writeSnapshot(runtime.store.file, target), name }));
}

export function listSnapshots(config: SnapshotConfig): SnapshotInfo[] {
  if (!fs.existsSync(config.dir)) return [];
  // The built snapshots of this SEED_PROFILE are listed under their fixed names; other profiles' are hidden.
  const built = new Map([
    [path.basename(baselineFile(config.dir, config.profile)), BASELINE],
    [path.basename(seedOnlyFile(config.dir, config.profile)), SEED_ONLY],
  ]);
  const order = (name: string) => (name === BASELINE ? 0 : name === SEED_ONLY ? 1 : 2);
  return fs
    .readdirSync(config.dir)
    .filter((f) => f.endsWith('.db') && fs.existsSync(path.join(config.dir, `${f}.sha256`)))
    .filter((f) => built.has(f) || !RESERVED.test(f))
    .map((f) => ({
      name: built.get(f) ?? path.basename(f, '.db'),
      sha256: fs.readFileSync(path.join(config.dir, `${f}.sha256`), 'utf8').trim(),
      bytes: fs.statSync(path.join(config.dir, f)).size,
    }))
    .sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name));
}

/**
 * Restores the working database from a snapshot. The snapshot is checked against its recorded
 * hash first; a corrupted snapshot is refused and the working database is left untouched.
 * The restored file is hashed before the connection reopens, so nothing can write in between.
 */
export function resetToSnapshot(runtime: Runtime, name: string = BASELINE): ResetResult {
  const started = performance.now();
  const source = snapshotFile(runtime.snapshots, name);
  const expected = expectedHash(source, name);
  if (sha256File(source) !== expected) {
    fail('INVALID_SNAPSHOT', `Snapshot "${name}" does not match its recorded sha256; reset refused`);
  }

  const { sha256, removedSideFiles } = runtime.store.swap(() => {
    const removed = removeSideFiles(runtime.store.file);
    copyAtomically(source, runtime.store.file);
    return { sha256: sha256File(runtime.store.file), removedSideFiles: removed };
  });

  return {
    snapshot: name,
    sha256,
    matches: sha256 === expected,
    durationMs: Math.round(performance.now() - started),
    removedSideFiles,
  };
}

function tableDigests(file: string): Map<string, { rows: number; digest: string }> {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as {
        name: string;
      }[]
    ).map((t) => t.name);
    const digests = new Map<string, { rows: number; digest: string }>();
    for (const table of tables) {
      const hash = crypto.createHash('sha256');
      let rows = 0;
      for (const row of db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).iterate()) {
        hash.update(JSON.stringify(row));
        rows++;
      }
      digests.set(table, { rows, digest: hash.digest('hex') });
    }
    return digests;
  } finally {
    db.close();
  }
}

/** Proof of a reset: file hash against the snapshot, no pending side files, and a per-table content digest. */
export function verifySnapshot(runtime: Runtime, name: string = BASELINE): VerifyResult {
  const source = snapshotFile(runtime.snapshots, name);
  const expected = expectedHash(source, name);
  const file = runtime.store.file;
  if (runtime.store.db.inTransaction) fail('INVALID_SNAPSHOT', 'A write transaction is open; try again');
  const actual = sha256File(file);
  const working = tableDigests(file);
  const snapshot = tableDigests(source);
  const names = [...new Set([...working.keys(), ...snapshot.keys()])].sort();
  const tables = names.map((table) => ({
    name: table,
    rows: working.get(table)?.rows ?? 0,
    matches: working.get(table)?.digest === snapshot.get(table)?.digest,
  }));
  return {
    snapshot: name,
    expectedSha256: expected,
    actualSha256: actual,
    matches: actual === expected,
    sideFiles: SIDE_FILES.filter((suffix) => fs.existsSync(file + suffix)).map((suffix) => path.basename(file + suffix)),
    tables,
    contentMatches: tables.every((t) => t.matches),
  };
}

/**
 * Start-up: make sure the working database exists and was built for SEED_PROFILE, copying the
 * profile's baseline when it doesn't. Only files are copied; no SQL statement writes.
 */
export function prepareWorkingDatabase(config: SnapshotConfig, workingFile: string): 'kept' | 'created' | 'replaced' {
  const baseline = baselineFile(config.dir, config.profile);
  if (!fs.existsSync(baseline)) {
    throw new Error(`No baseline for SEED_PROFILE "${config.profile}" at ${baseline}. Run "pnpm build:db".`);
  }
  if (fs.existsSync(workingFile)) {
    const db = new Database(workingFile, { readonly: true, fileMustExist: true });
    let profile: string | undefined;
    try {
      profile = (db.prepare(`SELECT value FROM meta WHERE key = 'seed_profile'`).get() as { value: string } | undefined)?.value;
    } finally {
      db.close();
    }
    if (profile === config.profile) return 'kept';
    removeSideFiles(workingFile);
    copyAtomically(baseline, workingFile);
    return 'replaced';
  }
  copyAtomically(baseline, workingFile);
  return 'created';
}
