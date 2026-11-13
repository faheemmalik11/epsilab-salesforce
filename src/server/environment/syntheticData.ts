import { generateData, type GenerateReport } from '../seed/generate.js';
import { fail } from '../services/errors.js';
import type { Runtime } from './runtime.js';

/** Meta key set to "none" in a seed-only database; a database without it was built with its generated records. */
export const SYNTHETIC_DATA_KEY = 'synthetic_data';

export interface SyntheticDataStatus {
  status: 'none' | 'generated';
}

export interface SyntheticDataResult extends SyntheticDataStatus {
  generated: GenerateReport;
  durationMs: number;
}

function meta(runtime: Runtime): Record<string, string> {
  const rows = runtime.store.db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function describeSyntheticData(runtime: Runtime): SyntheticDataStatus {
  return { status: meta(runtime)[SYNTHETIC_DATA_KEY] === 'none' ? 'none' : 'generated' };
}

/**
 * Generates the synthetic records into a seed-only database, with the profile and clock it was built
 * for: on an untouched seed the data equals the baseline's. Records added since the reset are kept, and
 * so is their log; leads added by hand join the name pool, so generated names can then differ.
 */
export function generateSyntheticData(runtime: Runtime): SyntheticDataResult {
  const started = performance.now();
  const values = meta(runtime);
  if (values[SYNTHETIC_DATA_KEY] !== 'none') {
    fail('SYNTHETIC_DATA_EXISTS', 'Synthetic data has already been generated. Reset to the seed-only snapshot first.');
  }
  const db = runtime.store.db;
  const generated = generateData(db, { profile: values.seed_profile!, clock: values.clock!, keepEarlierLog: true });
  db.prepare('UPDATE meta SET value = ? WHERE key = ?').run('generated', SYNTHETIC_DATA_KEY);
  return { status: 'generated', generated, durationMs: Math.round(performance.now() - started) };
}
