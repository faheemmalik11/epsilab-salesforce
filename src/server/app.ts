import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerApiRoutes } from './api/routes.js';
import { registerMcpRoutes } from './mcp/routes.js';
import type { Db } from './db/connection.js';

export interface AppDeps {
  db: Db;
  mcpAllowedHosts: string[];
  logger?: boolean;
}

/** REST API and MCP endpoint, served on API_PORT. */
export async function buildApiApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  await registerApiRoutes(app, deps);
  await registerMcpRoutes(app, { db: deps.db, allowedHosts: deps.mcpAllowedHosts });
  return app;
}

/**
 * Built GUI on GUI_PORT. It also mounts the REST routes so the browser calls the
 * API on its own origin, which avoids CORS between the two ports.
 */
export async function buildGuiApp(deps: AppDeps & { webDir: string }): Promise<FastifyInstance> {
  const indexFile = path.join(deps.webDir, 'index.html');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`GUI build not found at ${deps.webDir}. Run "pnpm build:web" first.`);
  }

  const app = Fastify({ logger: deps.logger ?? false });
  await registerApiRoutes(app, deps);
  await app.register(fastifyStatic, { root: deps.webDir });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send([{ errorCode: 'NOT_FOUND', message: 'The requested resource does not exist' }]);
  });
  return app;
}
