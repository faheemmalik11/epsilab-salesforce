import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import { registerApiRoutes } from './api/routes.js';
import { registerMcpRoutes } from './mcp/routes.js';
import type { Db } from './db/connection.js';
import { apiError } from './services/errors.js';

export interface AppDeps {
  db: Db;
  mcpAllowedHosts: string[];
  logger?: boolean;
}

function sendNotFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).send([apiError('NOT_FOUND', 'The requested resource does not exist')]);
}

/** Client-side routes have no file extension; anything else that's missing is a real 404. */
function isClientRoute(url: string): boolean {
  const pathname = url.split('?')[0]!;
  return !pathname.startsWith('/api/') && path.extname(pathname) === '';
}

/** REST API and MCP endpoint, served on API_PORT. */
export async function buildApiApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  await registerApiRoutes(app, deps);
  await registerMcpRoutes(app, { db: deps.db, allowedHosts: deps.mcpAllowedHosts });
  app.setNotFoundHandler((_request, reply) => sendNotFound(reply));
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
  app.setNotFoundHandler((request, reply) =>
    request.method === 'GET' && isClientRoute(request.url) ? reply.sendFile('index.html') : sendNotFound(reply),
  );
  return app;
}
