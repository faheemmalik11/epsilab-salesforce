import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { SEED_DIR } from './helpers.js';

export type Row = Record<string, string>;

function readRows(file: string): Row[] {
  return parse(fs.readFileSync(path.join(SEED_DIR, file)), { columns: true, bom: true }) as Row[];
}

/** The real users plus the first `leadCount` real leads, for small but realistic fixtures. */
export function realSample(leadCount: number): { users: Row[]; leads: Row[] } {
  return { users: readRows('users-core.csv'), leads: readRows('leads.csv').slice(0, leadCount) };
}

function toCsv(rows: Row[]): string {
  return stringify(rows, { header: true, columns: Object.keys(rows[0]!) });
}

function countsFor(users: Row[], leads: Row[]) {
  const status: Record<string, number> = {};
  for (const lead of leads) status[lead['Lead Status']!] = (status[lead['Lead Status']!] ?? 0) + 1;
  return {
    leads: leads.length,
    users: users.length,
    status,
    rating_hot: leads.filter((l) => l.Rating === 'Hot').length,
    lead_source_values: new Set(leads.map((l) => l['Lead Source']).filter((v) => v !== '-')).size,
  };
}

export interface FixtureOptions {
  users: Row[];
  leads: Row[];
  /** Edits applied to the manifest after it is computed from the files. */
  editManifest?: (manifest: Record<string, any>) => void;
  /** Raw CSV text, written instead of rendering `leads` (for malformed input). */
  rawLeadsCsv?: string;
}

/** Writes a seed directory whose manifest matches its files, unless edited. Returns its path. */
export function writeSeedDir(options: FixtureOptions): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epsilab-seed-'));
  const files: Record<string, string> = {
    'leads.csv': options.rawLeadsCsv ?? toCsv(options.leads),
    'users-core.csv': toCsv(options.users),
  };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  const manifest: Record<string, any> = {
    fixture: 'test-fixture',
    counts: countsFor(options.users, options.leads),
    files: Object.entries(files).map(([name, content]) => ({
      path: name,
      bytes: Buffer.byteLength(content),
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    })),
  };
  options.editManifest?.(manifest);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}
