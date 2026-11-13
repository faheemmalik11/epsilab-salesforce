import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { buildBaselines } from '../src/server/db/build.js';
import { baselineFile, seedOnlyFile } from '../src/server/environment/snapshots.js';
import type { CachedBaselines } from './baselines.js';
import { BUILD_CLOCK } from './baselines.js';

/**
 * Builds the baseline for every SEED_PROFILE once per run. A full build takes several seconds, so
 * test files copy these files instead of building their own; tests about building still build.
 */
export default function setup(project: TestProject) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-baselines-cache-'));
  const snapshotDir = path.join(dir, 'snapshots');
  const reports = buildBaselines(snapshotDir, path.resolve('seed'), BUILD_CLOCK);
  const cached: CachedBaselines = Object.fromEntries(
    reports.map((r) => [
      r.profile,
      { file: baselineFile(snapshotDir, r.profile), sha256: r.snapshot.sha256, seedOnlyFile: seedOnlyFile(snapshotDir, r.profile), import: r.import, generated: r.generated },
    ]),
  );
  project.provide('baselines', cached);
  return () => fs.rmSync(dir, { recursive: true, force: true });
}
