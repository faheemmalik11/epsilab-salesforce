import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SeedError } from './errors.js';

export interface SeedManifest {
  fixture: string;
  date_shift_days?: number;
  suggested_clock_start?: string;
  counts: {
    leads: number;
    users: number;
    status: Record<string, number>;
    rating_hot: number;
    lead_source_values: number;
  };
  files: { path: string; bytes: number; sha256: string }[];
}

export const SEED_FILES = { leads: 'leads.csv', users: 'users-core.csv' } as const;

function readFileOrFail(file: string): Buffer {
  if (!fs.existsSync(file)) throw new SeedError(`Seed file not found: ${file}`);
  return fs.readFileSync(file);
}

export function readManifest(seedDir: string): SeedManifest {
  const raw = readFileOrFail(path.join(seedDir, 'manifest.json')).toString('utf8');
  let manifest: SeedManifest;
  try {
    manifest = JSON.parse(raw) as SeedManifest;
  } catch {
    throw new SeedError('manifest.json is not valid JSON');
  }
  if (!manifest.counts || !Array.isArray(manifest.files)) {
    throw new SeedError('manifest.json is missing "counts" or "files"');
  }
  return manifest;
}

/** Reads each seed file and checks its size and sha256 against the manifest before anything is parsed. */
export function readVerifiedFiles(seedDir: string, manifest: SeedManifest): Record<string, Buffer> {
  const contents: Record<string, Buffer> = {};
  for (const name of Object.values(SEED_FILES)) {
    const entry = manifest.files.find((f) => f.path === name);
    if (!entry) throw new SeedError(`manifest.json has no entry for ${name}`);
    const data = readFileOrFail(path.join(seedDir, name));
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== entry.bytes || sha256 !== entry.sha256) {
      throw new SeedError(`${name} does not match manifest.json (expected sha256 ${entry.sha256}, got ${sha256})`);
    }
    contents[name] = data;
  }
  return contents;
}
