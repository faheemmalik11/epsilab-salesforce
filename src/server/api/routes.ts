import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/connection.js';
import { getHealth } from '../services/health.js';

export interface ApiDeps {
  db: Db;
}

export async function registerApiRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.get('/api/health', async () => getHealth(deps.db));
}
