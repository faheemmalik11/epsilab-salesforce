import type { Clock } from './clock.js';
import type { Db } from './db/connection.js';
import type { ServiceContext } from './services/context.js';
import { resolveActingUser } from './services/users.js';

/** What every REST and MCP request needs to build its service context. */
export interface RuntimeDeps {
  db: Db;
  clock: Clock;
  defaultUserId?: string | null;
}

export function contextFor(deps: RuntimeDeps, requestedUserId?: string | null): ServiceContext {
  return {
    db: deps.db,
    clock: deps.clock,
    actingUserId: resolveActingUser(deps.db, requestedUserId, deps.defaultUserId),
  };
}
