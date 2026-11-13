import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Db } from '../db/connection.js';
import { getHealth } from '../services/health.js';

export interface McpDeps {
  db: Db;
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    structuredContent: value as Record<string, unknown>,
  };
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
    async () => jsonResult(getHealth(deps.db)),
  );

  return server;
}
