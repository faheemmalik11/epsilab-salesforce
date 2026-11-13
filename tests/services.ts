import { fixedClock } from '../src/server/clock.js';
import type { Db } from '../src/server/db/connection.js';
import { nextId } from '../src/server/db/ids.js';
import type { ServiceContext } from '../src/server/services/index.js';
import { createTestDb, type TestDb } from './helpers.js';

export const CLOCK = '2028-11-11T09:00:00.000Z';

export interface Users {
  rep: string;
  manager: string;
  inactive: string;
}

function insertUser(db: Db, firstName: string, lastName: string, active: boolean): string {
  const id = nextId(db, '005');
  db.prepare(
    `INSERT INTO "User" ("Id", "FirstName", "LastName", "Name", "Alias", "IsActive", "Username")
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, firstName, lastName, `${firstName} ${lastName}`, firstName.slice(0, 4).toLowerCase(), active ? 1 : 0, `${firstName}@example.invalid`);
  return id;
}

export interface ServiceFixture extends TestDb {
  users: Users;
  ctx: ServiceContext;
  as(userId: string): ServiceContext;
  count(table: string): number;
}

/** A fresh database with three users and a fixed-clock context acting as the rep. */
export function createServiceFixture(): ServiceFixture {
  const t = createTestDb();
  const users: Users = {
    rep: insertUser(t.db, 'Riley', 'Rep', true),
    manager: insertUser(t.db, 'Morgan', 'Manager', true),
    inactive: insertUser(t.db, 'Ina', 'Inactive', false),
  };
  const as = (userId: string): ServiceContext => ({ db: t.db, clock: fixedClock(CLOCK), actingUserId: userId });
  return {
    ...t,
    users,
    ctx: as(users.rep),
    as,
    count: (table) => (t.db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n,
  };
}

/** Runs fn and returns the ServiceError's error array, failing if nothing was thrown. */
export function errorsOf(fn: () => unknown): unknown[] {
  try {
    fn();
  } catch (error) {
    if (error && typeof error === 'object' && 'errors' in error) return (error as { errors: unknown[] }).errors;
    throw error;
  }
  throw new Error('Expected a ServiceError');
}
