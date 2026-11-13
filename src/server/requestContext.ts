import type { Runtime } from './environment/runtime.js';
import type { ServiceContext } from './services/context.js';
import { resolveActingUser } from './services/users.js';

/** Builds a service context from the current runtime: today's database connection and clock. */
export function contextFor(runtime: Runtime, requestedUserId?: string | null): ServiceContext {
  const db = runtime.store.db;
  return {
    db,
    clock: runtime.clock,
    actingUserId: resolveActingUser(db, requestedUserId, runtime.defaultUserId),
  };
}
