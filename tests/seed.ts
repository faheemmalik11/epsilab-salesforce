import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { SEED_DIR } from './helpers.js';

export type SeedRow = Record<string, string>;

const cache = new Map<string, SeedRow[]>();

export function readSeed(file: 'leads.csv' | 'users-core.csv'): SeedRow[] {
  let rows = cache.get(file);
  if (!rows) {
    rows = parse(fs.readFileSync(path.join(SEED_DIR, file)), { columns: true, bom: true }) as SeedRow[];
    cache.set(file, rows);
  }
  return rows;
}

export const seedManifest = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'manifest.json'), 'utf8'));
