import { isValidId, toId18 } from '../db/ids.js';
import type { Db } from '../db/connection.js';
import { fail } from './errors.js';

export interface UserSummary {
  Id: string;
  Name: string;
  Alias: string | null;
  Email: string | null;
  IsActive: boolean;
}

export function listUsers(db: Db): UserSummary[] {
  const rows = db
    .prepare('SELECT "Id", "Name", "Alias", "Email", "IsActive" FROM "User" ORDER BY "Name" COLLATE NOCASE, "Id"')
    .all() as (Omit<UserSummary, 'IsActive'> & { IsActive: number })[];
  return rows.map((r) => ({ ...r, IsActive: r.IsActive === 1 }));
}

/**
 * Resolves who a request acts as. An explicit user must exist and be active; without one,
 * the configured default is used, then the first active user by name.
 */
export function resolveActingUser(db: Db, requested?: string | null, defaultUserId?: string | null): string {
  const candidate = requested || defaultUserId;
  if (candidate) {
    if (!isValidId(candidate)) fail('MALFORMED_ID', `Acting user: id value of incorrect type: ${candidate}`);
    const id = toId18(candidate);
    const user = db.prepare('SELECT "IsActive" FROM "User" WHERE "Id" = ?').get(id) as { IsActive: number } | undefined;
    if (!user) fail('INVALID_CROSS_REFERENCE_KEY', `Acting user ${candidate} does not exist.`);
    if (user.IsActive !== 1) fail('INACTIVE_OWNER_OR_USER', `Acting user ${candidate} is inactive.`);
    return id;
  }
  const first = db
    .prepare('SELECT "Id" FROM "User" WHERE "IsActive" = 1 ORDER BY "Name" COLLATE NOCASE, "Id" LIMIT 1')
    .get() as { Id: string } | undefined;
  if (!first) fail('INVALID_CROSS_REFERENCE_KEY', 'No active user is available to act as.');
  return first.Id;
}
