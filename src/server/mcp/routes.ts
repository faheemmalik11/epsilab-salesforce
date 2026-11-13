import type { FastifyInstance } from 'fastify';
import { hostHeaderValidation } from '@modelcontextprotocol/fastify';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createMcpServer, type McpDeps } from './server.js';

const methodNotAllowed = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed. This server is stateless; use POST.' },
  id: null,
};

export async function registerMcpRoutes(
  app: FastifyInstance,
  deps: McpDeps & { allowedHosts: string[] },
): Promise<void> {
  const onRequest = hostHeaderValidation(deps.allowedHosts);

  // Stateless: one server and transport per request, as in the SDK's Fastify example.
  app.post('/mcp', { onRequest }, async (request, reply) => {
    const server = createMcpServer(deps);
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/mcp',
      onRequest,
      handler: async (_request, reply) => reply.code(405).send(methodNotAllowed),
    });
  }
}
