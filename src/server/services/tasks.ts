import type { ServiceContext } from './context.js';
import { createRecord } from './records/records.js';
import type { SObject } from './records/values.js';

export interface LogCallInput {
  whoId?: string | null;
  whatId?: string | null;
  subject?: string;
  description?: string | null;
  activityDate?: string;
  ownerId?: string;
}

/** Log a Call: a completed Task with subtype Call, dated today unless given. */
export function logCall(ctx: ServiceContext, input: LogCallInput): SObject {
  return createRecord(ctx, 'Task', {
    Subject: input.subject ?? 'Call',
    TaskSubtype: 'Call',
    Type: 'Call',
    Status: 'Completed',
    ActivityDate: input.activityDate ?? ctx.clock.today(),
    WhoId: input.whoId ?? null,
    WhatId: input.whatId ?? null,
    Description: input.description ?? null,
    ...(input.ownerId ? { OwnerId: input.ownerId } : {}),
  });
}
