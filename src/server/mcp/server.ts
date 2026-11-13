import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { OBJECTS, type ObjectName } from '../metadata/index.js';
import { OPPORTUNITY_STAGE } from '../metadata/picklists.js';
import { createdResult, describeObject, listObjects, presentRecord, presentRecords } from '../presenters.js';
import { contextFor, type RuntimeDeps } from '../requestContext.js';
import {
  convertLead,
  createRecord,
  deleteRecord,
  getHealth,
  getRecord,
  listMutations,
  listUsers,
  logCall,
  queryRecords,
  ServiceError,
  updateRecord,
} from '../services/index.js';
import type { ServiceContext } from '../services/context.js';

export type McpDeps = RuntimeDeps;

const objectName = z.enum(OBJECTS.map((o) => o.name) as [ObjectName, ...ObjectName[]]).describe('Salesforce object API name');
const recordId = z.string().describe('15 or 18-character Salesforce record ID');
const fields = z.record(z.string(), z.unknown()).describe('Field API names and values, as in the Salesforce REST API');
const actingUserId = z
  .string()
  .optional()
  .describe('Seeded user to act as. Defaults to the configured default user. Inactive users are rejected.');
const STAGES = OPPORTUNITY_STAGE.values.map((s) => s.value).join(', ');

function success(value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  };
}

/** Service errors come back as the same Salesforce error array the REST API returns. */
function failure(error: ServiceError) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(error.errors) }],
    structuredContent: { errors: error.errors },
  };
}

/** Runs a tool body with a service context for the acting user, mapping service errors to tool errors. */
async function run(deps: McpDeps, userId: string | undefined, body: (ctx: ServiceContext) => object) {
  try {
    return success(body(contextFor(deps, userId)));
  } catch (error) {
    if (error instanceof ServiceError) return failure(error);
    throw error;
  }
}

export function createMcpServer(deps: McpDeps): McpServer {
  const server = new McpServer({ name: 'epsilab-salesforce', version: '0.1.0' });

  server.registerTool(
    'health',
    {
      title: 'Health check',
      description: 'Reports the seed fixture loaded into the database and the SQLite version.',
      inputSchema: z.object({}),
    },
    async () => success(getHealth(deps.db)),
  );

  server.registerTool(
    'list_objects',
    { description: 'Lists the supported Salesforce objects and whether they can be written.', inputSchema: z.object({}) },
    async () => success({ sobjects: listObjects() }),
  );

  server.registerTool(
    'describe_object',
    {
      description: 'Describes an object: field names, types, required fields, references and picklist values.',
      inputSchema: z.object({ object: objectName }),
    },
    async ({ object }) => success(describeObject(object)),
  );

  server.registerTool(
    'list_users',
    { description: 'Lists the seeded users with their IDs and active flags.', inputSchema: z.object({}) },
    async () => success({ users: listUsers(deps.db) }),
  );

  server.registerTool(
    'create_record',
    {
      description: 'Creates a record and returns { id, success, errors }. Validation matches the GUI and REST API.',
      inputSchema: z.object({ object: objectName, fields, actingUserId }),
    },
    async ({ object, fields: values, actingUserId: userId }) =>
      run(deps, userId, (ctx) => createdResult(createRecord(ctx, object, values))),
  );

  server.registerTool(
    'get_record',
    { description: 'Gets one record by ID.', inputSchema: z.object({ object: objectName, id: recordId, actingUserId }) },
    async ({ object, id, actingUserId: userId }) =>
      run(deps, userId, (ctx) => presentRecord(deps.db, object, getRecord(ctx, object, id))),
  );

  server.registerTool(
    'update_record',
    {
      description: 'Updates fields on a record and returns the saved record.',
      inputSchema: z.object({ object: objectName, id: recordId, fields, actingUserId }),
    },
    async ({ object, id, fields: values, actingUserId: userId }) =>
      run(deps, userId, (ctx) => presentRecord(deps.db, object, updateRecord(ctx, object, id, values))),
  );

  server.registerTool(
    'delete_record',
    {
      description: 'Deletes a record. Deleting an account also deletes its contacts, opportunities and related tasks.',
      inputSchema: z.object({ object: objectName, id: recordId, actingUserId }),
    },
    async ({ object, id, actingUserId: userId }) =>
      run(deps, userId, (ctx) => {
        deleteRecord(ctx, object, id);
        return { id, success: true, errors: [] };
      }),
  );

  server.registerTool(
    'query_records',
    {
      description:
        'Filters, sorts and pages records of one object. Returns { totalSize, done, records }. Text sorts are case-insensitive. ' +
        'For the All Leads view, filter IsConverted eq false.',
      inputSchema: z.object({
        object: objectName,
        where: z
          .array(
            z.object({
              field: z.string(),
              op: z.enum(['eq', 'ne', 'in', 'isNull', 'notNull', 'contains']),
              value: z.unknown().optional(),
            }),
          )
          .optional(),
        orderBy: z.array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']).optional() })).optional(),
        limit: z.number().int().optional().describe('1 to 2000, default 50'),
        offset: z.number().int().optional(),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, ...options }) =>
      run(deps, userId, (ctx) => {
        const result = queryRecords(ctx, options);
        return { ...result, records: presentRecords(deps.db, options.object, result.records) };
      }),
  );

  server.registerTool(
    'convert_lead',
    {
      description:
        'Converts a lead in one transaction: a new or existing account, a new contact and, unless doNotCreateOpportunity, ' +
        'an opportunity. The lead becomes read-only. A failure creates nothing.',
      inputSchema: z.object({
        leadId: recordId,
        convertedStatus: z.string().describe('Must be a converted lead status: "Closed - Converted"'),
        accountId: z.string().optional().describe('Existing account to attach to; omit to create one from the lead'),
        doNotCreateOpportunity: z.boolean().optional(),
        opportunityName: z.string().optional().describe('Defaults to the lead Company'),
        ownerId: z.string().optional().describe('Owner of the new records; defaults to the lead owner'),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, ...input }) => run(deps, userId, (ctx) => convertLead(ctx, input)),
  );

  server.registerTool(
    'log_call',
    {
      description: 'Logs a completed call (a Task with subtype Call and status Completed) on a lead, contact, account or opportunity.',
      inputSchema: z.object({
        whoId: z.string().optional().describe('Lead or contact ID'),
        whatId: z.string().optional().describe('Account or opportunity ID'),
        subject: z.string().optional(),
        description: z.string().optional(),
        activityDate: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, ...input }) => run(deps, userId, (ctx) => createdResult(logCall(ctx, input))),
  );

  server.registerTool(
    'create_task',
    {
      description: 'Creates a task. Status defaults to Not Started and Priority to Normal.',
      inputSchema: z.object({
        subject: z.string(),
        status: z.string().optional(),
        priority: z.string().optional(),
        activityDate: z.string().optional().describe('Due date, YYYY-MM-DD'),
        whoId: z.string().optional().describe('Lead or contact ID'),
        whatId: z.string().optional().describe('Account or opportunity ID'),
        description: z.string().optional(),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, subject, status, priority, activityDate, whoId, whatId, description }) =>
      run(deps, userId, (ctx) =>
        createdResult(
          createRecord(ctx, 'Task', {
            Subject: subject,
            ...(status !== undefined ? { Status: status } : {}),
            ...(priority !== undefined ? { Priority: priority } : {}),
            ...(activityDate !== undefined ? { ActivityDate: activityDate } : {}),
            ...(whoId !== undefined ? { WhoId: whoId } : {}),
            ...(whatId !== undefined ? { WhatId: whatId } : {}),
            ...(description !== undefined ? { Description: description } : {}),
          }),
        ),
      ),
  );

  server.registerTool(
    'add_contact_role',
    {
      description: 'Adds a contact role to an opportunity. Making it primary clears any other primary role.',
      inputSchema: z.object({
        opportunityId: recordId,
        contactId: recordId,
        role: z.string().optional().describe('For example Decision Maker, Economic Buyer, Influencer'),
        isPrimary: z.boolean().optional(),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, opportunityId, contactId, role, isPrimary }) =>
      run(deps, userId, (ctx) =>
        createdResult(
          createRecord(ctx, 'OpportunityContactRole', {
            OpportunityId: opportunityId,
            ContactId: contactId,
            ...(role !== undefined ? { Role: role } : {}),
            ...(isPrimary !== undefined ? { IsPrimary: isPrimary } : {}),
          }),
        ),
      ),
  );

  server.registerTool(
    'update_opportunity_stage',
    {
      description:
        `Moves an opportunity to a stage (${STAGES}). Probability and forecast category follow the stage. ` +
        'Stages after Qualification require an Amount.',
      inputSchema: z.object({
        opportunityId: recordId,
        stageName: z.string(),
        amount: z.number().optional(),
        nextStep: z.string().optional(),
        actingUserId,
      }),
    },
    async ({ actingUserId: userId, opportunityId, stageName, amount, nextStep }) =>
      run(deps, userId, (ctx) =>
        presentRecord(
          deps.db,
          'Opportunity',
          updateRecord(ctx, 'Opportunity', opportunityId, {
            StageName: stageName,
            ...(amount !== undefined ? { Amount: amount } : {}),
            ...(nextStep !== undefined ? { NextStep: nextStep } : {}),
          }),
        ),
      ),
  );

  server.registerTool(
    'get_mutation_log',
    {
      description: 'Lists every create, update and delete since the last build or reset, oldest first.',
      inputSchema: z.object({ afterSeq: z.number().int().optional(), limit: z.number().int().optional() }),
    },
    async ({ afterSeq, limit }) => run(deps, undefined, (ctx) => ({ mutations: listMutations(ctx, { afterSeq, limit }) })),
  );

  return server;
}
