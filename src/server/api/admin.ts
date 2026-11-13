import type { FastifyInstance, FastifyRequest } from 'fastify';
import { describeClock, setClock, type Runtime } from '../environment/runtime.js';
import { createSnapshot, listSnapshots, resetToSnapshot, verifySnapshot } from '../environment/snapshots.js';
import { describeSyntheticData, generateSyntheticData } from '../environment/syntheticData.js';
import { fail } from '../services/errors.js';

function stringField(request: FastifyRequest, name: string): string | undefined {
  const body = request.body as Record<string, unknown> | undefined;
  const value = body?.[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') fail('JSON_PARSER_ERROR', `${name} must be a string.`, [name]);
  return value;
}

/** Environment plumbing: reset, snapshots, synthetic data and the app clock. The same functions back the MCP tools. */
export async function registerAdminRoutes(app: FastifyInstance, runtime: Runtime): Promise<void> {
  app.post('/api/admin/reset', async (request) => resetToSnapshot(runtime, stringField(request, 'snapshot')));

  app.get('/api/admin/snapshots', async () => ({ snapshots: listSnapshots(runtime.snapshots) }));

  app.post('/api/admin/snapshots', async (request, reply) => {
    const name = stringField(request, 'name');
    if (!name) fail('REQUIRED_FIELD_MISSING', 'Required fields are missing: [name]', ['name']);
    return reply.code(201).send(createSnapshot(runtime, name));
  });

  app.get<{ Params: { name: string } }>('/api/admin/snapshots/:name/verify', async (request) =>
    verifySnapshot(runtime, request.params.name),
  );

  app.get('/api/admin/synthetic-data', async () => describeSyntheticData(runtime));

  app.post('/api/admin/synthetic-data', async (_request, reply) => reply.code(201).send(generateSyntheticData(runtime)));

  app.get('/api/admin/clock', async () => describeClock(runtime));

  app.post('/api/admin/clock', async (request) => {
    setClock(runtime, {
      start: stringField(request, 'start') ?? runtime.clockSetting.start,
      mode: stringField(request, 'mode') ?? runtime.clockSetting.mode,
    });
    return describeClock(runtime);
  });
}
