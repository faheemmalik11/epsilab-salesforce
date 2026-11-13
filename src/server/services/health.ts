import type { Db } from '../db/connection.js';

export interface HealthStatus {
  status: 'ok';
  fixture: string;
  expectedLeads: number;
  expectedUsers: number;
  sqliteVersion: string;
}

export function getHealth(db: Db): HealthStatus {
  const rows = db.prepare('SELECT key, value FROM meta').all() as { key: string; value: string }[];
  const meta = new Map(rows.map((r) => [r.key, r.value]));
  const { version } = db.prepare('SELECT sqlite_version() AS version').get() as { version: string };
  return {
    status: 'ok',
    fixture: meta.get('fixture') ?? 'unknown',
    expectedLeads: Number(meta.get('expected_leads')),
    expectedUsers: Number(meta.get('expected_users')),
    sqliteVersion: version,
  };
}
