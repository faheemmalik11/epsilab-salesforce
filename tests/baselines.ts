import fs from 'node:fs';
import { inject } from 'vitest';
import type { BuildReport } from '../src/server/db/build.js';

/** The clock every test baseline is built with (the default CLOCK). */
export const BUILD_CLOCK = '2028-11-11T09:00:00Z';

export interface CachedBaseline extends BuildReport {
  file: string;
  sha256: string;
  /** The seed-only snapshot built beside the baseline. */
  seedOnlyFile: string;
}

export type CachedBaselines = Record<string, CachedBaseline>;

declare module 'vitest' {
  export interface ProvidedContext {
    baselines: CachedBaselines;
  }
}

/** The baseline built once for this run by `tests/globalSetup.ts`, copied to `target`. */
export function copyBaseline(profile: string, target: string): CachedBaseline {
  const baseline = inject('baselines')[profile];
  if (!baseline) throw new Error(`No cached baseline for profile "${profile}"`);
  fs.copyFileSync(baseline.file, target);
  return baseline;
}

export function cachedBaseline(profile: string): CachedBaseline {
  const baseline = inject('baselines')[profile];
  if (!baseline) throw new Error(`No cached baseline for profile "${profile}"`);
  return baseline;
}
