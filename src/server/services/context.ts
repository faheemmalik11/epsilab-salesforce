import type { Clock } from '../clock.js';
import type { Db } from '../db/connection.js';

/** Everything a service call needs. REST, MCP and tests each build one per request. */
export interface ServiceContext {
  db: Db;
  clock: Clock;
  /** The seeded user the caller is acting as. */
  actingUserId: string;
}
