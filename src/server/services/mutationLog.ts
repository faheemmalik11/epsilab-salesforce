import type { ObjectName } from '../metadata/index.js';
import type { ServiceContext } from './context.js';
import type { SObject } from './records/values.js';

export type Operation = 'create' | 'update' | 'delete';

export interface MutationEntry {
  seq: number;
  at: string;
  actorId: string | null;
  operation: Operation;
  object: ObjectName;
  recordId: string;
  before: SObject | null;
  after: SObject | null;
}

export function logMutation(
  ctx: ServiceContext,
  operation: Operation,
  object: ObjectName,
  recordId: string,
  before: SObject | null,
  after: SObject | null,
): void {
  ctx.db
    .prepare(
      `INSERT INTO mutation_log (at, actor_id, operation, object, record_id, before, after)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ctx.clock.now(),
      ctx.actingUserId,
      operation,
      object,
      recordId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
    );
}

interface LogRow {
  seq: number;
  at: string;
  actor_id: string | null;
  operation: Operation;
  object: ObjectName;
  record_id: string;
  before: string | null;
  after: string | null;
}

export function listMutations(ctx: ServiceContext, options: { afterSeq?: number; limit?: number } = {}): MutationEntry[] {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 1000);
  const rows = ctx.db
    .prepare('SELECT * FROM mutation_log WHERE seq > ? ORDER BY seq LIMIT ?')
    .all(options.afterSeq ?? 0, limit) as LogRow[];
  return rows.map((r) => ({
    seq: r.seq,
    at: r.at,
    actorId: r.actor_id,
    operation: r.operation,
    object: r.object,
    recordId: r.record_id,
    before: r.before ? (JSON.parse(r.before) as SObject) : null,
    after: r.after ? (JSON.parse(r.after) as SObject) : null,
  }));
}
