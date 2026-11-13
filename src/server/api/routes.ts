import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isObjectName, type ObjectName } from '../metadata/index.js';
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
  updateRecord,
  type ConvertLeadInput,
  type LogCallInput,
  type QueryOptions,
} from '../services/index.js';
import { fail, notFound } from '../services/errors.js';

export type ApiDeps = RuntimeDeps;

type ObjectParams = { object: string };
type RecordParams = { object: string; id: string };

const USER_HEADER = 'x-user-id';

function objectName(name: string): ObjectName {
  if (!isObjectName(name)) notFound();
  return name;
}

/** The request body as a plain JSON object. */
function body(request: FastifyRequest): Record<string, unknown> {
  const value = request.body;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('JSON_PARSER_ERROR', 'The request body must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function actingUser(request: FastifyRequest): string | undefined {
  const header = request.headers[USER_HEADER];
  return Array.isArray(header) ? header[0] : header;
}

function optionalInt(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) fail('MALFORMED_QUERY', `${name} must be a non-negative integer.`);
  return Number(value);
}

/** REST routes. Each one only translates HTTP to a shared service call and back. */
export async function registerApiRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  const ctx = (request: FastifyRequest) => contextFor(deps, actingUser(request));

  app.get('/api/health', async () => getHealth(deps.db));

  app.get('/api/users', async () => listUsers(deps.db));

  app.get('/api/users/current', async (request) => {
    const { actingUserId } = ctx(request);
    return listUsers(deps.db).find((u) => u.Id === actingUserId);
  });

  app.get('/api/sobjects', async () => ({ sobjects: listObjects() }));

  app.get<{ Params: ObjectParams }>('/api/sobjects/:object/describe', async (request) =>
    describeObject(objectName(request.params.object)),
  );

  app.post<{ Params: ObjectParams }>('/api/sobjects/:object', async (request, reply) => {
    const record = createRecord(ctx(request), objectName(request.params.object), body(request));
    return reply.code(201).send(createdResult(record));
  });

  app.get<{ Params: RecordParams }>('/api/sobjects/:object/:id', async (request) => {
    const object = objectName(request.params.object);
    return presentRecord(deps.db, object, getRecord(ctx(request), object, request.params.id));
  });

  app.patch<{ Params: RecordParams }>('/api/sobjects/:object/:id', async (request, reply) => {
    updateRecord(ctx(request), objectName(request.params.object), request.params.id, body(request));
    return reply.code(204).send();
  });

  app.delete<{ Params: RecordParams }>('/api/sobjects/:object/:id', async (request, reply) => {
    deleteRecord(ctx(request), objectName(request.params.object), request.params.id);
    return reply.code(204).send();
  });

  app.post('/api/query', async (request) => {
    const options = body(request) as unknown as QueryOptions;
    const object = objectName(String(options.object));
    const result = queryRecords(ctx(request), { ...options, object });
    return { ...result, records: presentRecords(deps.db, object, result.records) };
  });

  app.post<{ Params: { id: string } }>('/api/leads/:id/convert', async (request) =>
    convertLead(ctx(request), { ...(body(request) as Omit<ConvertLeadInput, 'leadId'>), leadId: request.params.id }),
  );

  app.post('/api/tasks/log-call', async (request, reply) => {
    const task = logCall(ctx(request), body(request) as LogCallInput);
    return reply.code(201).send(createdResult(task));
  });

  app.get<{ Querystring: { afterSeq?: string; limit?: string } }>('/api/mutations', async (request) => ({
    mutations: listMutations(ctx(request), {
      afterSeq: optionalInt('afterSeq', request.query.afterSeq),
      limit: optionalInt('limit', request.query.limit),
    }),
  }));
}
