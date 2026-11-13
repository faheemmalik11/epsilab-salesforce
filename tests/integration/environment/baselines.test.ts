import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildBaselines, buildDatabase, type BaselineReport } from '../../../src/server/db/build.js';
import { baselineFile, prepareWorkingDatabase, sha256File } from '../../../src/server/environment/snapshots.js';
import { cachedBaseline } from '../../baselines.js';
import { SEED_DIR } from '../../helpers.js';

const CLOCK = '2028-11-11T09:00:00Z';
/** Full builds share the CPU with the other test files, so they get more than the default 30 s. */
const BUILD_TIMEOUT = 120_000;
let dir: string;
let reports: BaselineReport[];

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-baselines-'));
  reports = buildBaselines(path.join(dir, 'snapshots'), SEED_DIR, CLOCK);
}, BUILD_TIMEOUT);

// This file builds its own baselines (it tests building them); the rest of the suite shares the
// cached ones from tests/globalSetup.ts, which must be identical.
describe('the shared test baselines', () => {
  it('are byte-identical to the ones built here', () => {
    for (const report of reports) expect(cachedBaseline(report.profile).sha256, report.profile).toBe(report.snapshot.sha256);
  });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const scalar = (file: string, sql: string) => {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare(sql).get() as { n: number | string }).n;
  } finally {
    db.close();
  }
};

describe('baseline snapshots per SEED_PROFILE', () => {
  it('builds one verified baseline per profile, each with the full seed and its own generated volume', () => {
    expect(reports.map((r) => r.profile)).toEqual(['default', 'small']);
    for (const report of reports) {
      const file = baselineFile(path.join(dir, 'snapshots'), report.profile);
      expect(fs.readFileSync(`${file}.sha256`, 'utf8').trim()).toBe(sha256File(file));
      expect(scalar(file, 'SELECT COUNT(*) AS n FROM "Lead"')).toBe(21628);
      expect(scalar(file, `SELECT value AS n FROM meta WHERE key = 'seed_profile'`)).toBe(report.profile);
      expect(scalar(file, 'SELECT COUNT(*) AS n FROM mutation_log')).toBe(0);
      expect(fs.existsSync(`${file}-journal`)).toBe(false);
    }
    expect(reports[0]!.generated.Account).toBeGreaterThan(reports[1]!.generated.Account);
  });

  it('is deterministic: the default baseline matches an independent build byte for byte', () => {
    const independent = path.join(dir, 'independent.db');
    buildDatabase(independent, SEED_DIR, { profile: 'default', clock: CLOCK });
    expect(sha256File(independent)).toBe(reports[0]!.snapshot.sha256);
  }, BUILD_TIMEOUT);

  it('rejects an unknown profile', () => {
    expect(() => buildDatabase(path.join(dir, 'x.db'), SEED_DIR, { profile: 'huge', clock: CLOCK })).toThrow(/Unknown SEED_PROFILE "huge"/);
  });
});

describe('start-up working database (SEED_PROFILE at runtime)', () => {
  it('creates the working copy, keeps it across restarts, and replaces it when SEED_PROFILE changes', () => {
    const snapshots = path.join(dir, 'snapshots');
    const working = path.join(dir, 'app.db');
    expect(prepareWorkingDatabase({ dir: snapshots, profile: 'default' }, working)).toBe('created');
    expect(sha256File(working)).toBe(reports[0]!.snapshot.sha256);
    expect(prepareWorkingDatabase({ dir: snapshots, profile: 'default' }, working)).toBe('kept');
    expect(prepareWorkingDatabase({ dir: snapshots, profile: 'small' }, working)).toBe('replaced');
    expect(sha256File(working)).toBe(reports[1]!.snapshot.sha256);
    expect(scalar(working, `SELECT value AS n FROM meta WHERE key = 'seed_profile'`)).toBe('small');
  });

  it('fails clearly when the profile has no baseline', () => {
    expect(() => prepareWorkingDatabase({ dir: path.join(dir, 'snapshots'), profile: 'huge' }, path.join(dir, 'other.db'))).toThrow(
      /No baseline for SEED_PROFILE "huge"/,
    );
  });
});
