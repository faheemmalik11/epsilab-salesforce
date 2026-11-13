import type { ObjectName } from '../../metadata/index.js';
import { CLOSED_TASK_STATUSES, LEAD_STATUS, OPPORTUNITY_STAGE, stageOf } from '../../metadata/picklists.js';
import type { ServiceContext } from '../context.js';
import { fail } from '../errors.js';
import type { Dependent, ObjectRules, WriteEvent } from './rules.js';
import { personName } from './values.js';

const QUALIFICATION_INDEX = OPPORTUNITY_STAGE.values.findIndex((s) => s.value === 'Qualification');
const CONVERTED_STATUSES = new Set(LEAD_STATUS.values.filter((v) => v.converted).map((v) => v.value));

export const AMOUNT_REQUIRED_MESSAGE = 'Amount is required for stages after Qualification.';

function idsWhere(ctx: ServiceContext, object: ObjectName, column: string, value: unknown): string[] {
  return (ctx.db.prepare(`SELECT "Id" FROM "${object}" WHERE "${column}" = ?`).all(value) as { Id: string }[]).map(
    (r) => r.Id,
  );
}

function deriveName({ next }: WriteEvent): void {
  next.Name = personName(next.FirstName ?? null, next.LastName ?? null);
}

const leadRules: ObjectRules = {
  guard(_ctx, previous, system) {
    if (previous.IsConverted && !system) fail('CANNOT_UPDATE_CONVERTED_LEAD', 'A converted lead cannot be updated.');
  },
  beforeWrite(event) {
    const { next, system, supplied } = event;
    if (!system && supplied.has('Status') && typeof next.Status === 'string' && CONVERTED_STATUSES.has(next.Status)) {
      fail('INVALID_STATUS', `Lead Status: "${next.Status}" can only be set by converting the lead.`, ['Status']);
    }
    deriveName(event);
  },
  beforeDelete(_ctx, record) {
    if (record.IsConverted) fail('CANNOT_UPDATE_CONVERTED_LEAD', 'A converted lead cannot be deleted.');
  },
  dependents: (ctx, record) => [{ object: 'Task', ids: idsWhere(ctx, 'Task', 'WhoId', record.Id) }],
};

const contactRules: ObjectRules = {
  beforeWrite: deriveName,
  dependents: (ctx, record) => [
    { object: 'OpportunityContactRole', ids: idsWhere(ctx, 'OpportunityContactRole', 'ContactId', record.Id) },
    { object: 'Task', ids: idsWhere(ctx, 'Task', 'WhoId', record.Id) },
  ],
};

const accountRules: ObjectRules = {
  dependents: (ctx, record): Dependent[] => [
    { object: 'Contact', ids: idsWhere(ctx, 'Contact', 'AccountId', record.Id) },
    { object: 'Opportunity', ids: idsWhere(ctx, 'Opportunity', 'AccountId', record.Id) },
    { object: 'Task', ids: idsWhere(ctx, 'Task', 'WhatId', record.Id) },
  ],
};

const opportunityRules: ObjectRules = {
  beforeWrite({ next, previous, supplied }) {
    const stageName = String(next.StageName);
    const stage = stageOf(stageName);
    if (!stage) return;

    if (!previous || previous.StageName !== stageName) {
      if (!supplied.has('Probability')) next.Probability = stage.probability;
      if (!supplied.has('ForecastCategoryName')) next.ForecastCategoryName = stage.forecastCategory;
    }
    next.IsClosed = stage.closed;
    next.IsWon = stage.won;

    const stageIndex = OPPORTUNITY_STAGE.values.indexOf(stage);
    if (stageIndex > QUALIFICATION_INDEX && next.Amount === null) {
      fail('FIELD_CUSTOM_VALIDATION_EXCEPTION', AMOUNT_REQUIRED_MESSAGE, ['Amount']);
    }
  },
  dependents: (ctx, record) => [
    { object: 'OpportunityContactRole', ids: idsWhere(ctx, 'OpportunityContactRole', 'OpportunityId', record.Id) },
    { object: 'Task', ids: idsWhere(ctx, 'Task', 'WhatId', record.Id) },
  ],
};

const taskRules: ObjectRules = {
  beforeWrite({ next }) {
    next.IsClosed = typeof next.Status === 'string' && CLOSED_TASK_STATUSES.has(next.Status);
  },
};

const contactRoleRules: ObjectRules = {
  // An opportunity has at most one primary contact role, as in Salesforce.
  afterWrite({ ctx, saved }, ops) {
    if (!saved.IsPrimary) return;
    const others = ctx.db
      .prepare(
        `SELECT "Id" FROM "OpportunityContactRole" WHERE "OpportunityId" = ? AND "IsPrimary" = 1 AND "Id" <> ?`,
      )
      .all(saved.OpportunityId, saved.Id) as { Id: string }[];
    for (const { Id } of others) ops.updateSystem('OpportunityContactRole', Id, { IsPrimary: false });
  },
};

export const OBJECT_RULES: Partial<Record<ObjectName, ObjectRules>> = {
  Lead: leadRules,
  Contact: contactRules,
  Account: accountRules,
  Opportunity: opportunityRules,
  Task: taskRules,
  OpportunityContactRole: contactRoleRules,
};
