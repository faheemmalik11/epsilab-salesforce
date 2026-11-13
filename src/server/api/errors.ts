import type { FastifyError, FastifyInstance } from 'fastify';
import { apiError, ServiceError } from '../services/errors.js';

/** Every REST failure is returned as the Salesforce error array: [{ errorCode, message, fields? }]. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ServiceError) {
      return reply.code(error.isNotFound ? 404 : 400).send(error.errors);
    }
    // Fastify's own request errors: unparsable JSON, empty body, unsupported content type.
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(400).send([apiError('JSON_PARSER_ERROR', error.message)]);
    }
    request.log.error(error);
    return reply.code(500).send([apiError('UNKNOWN_EXCEPTION', 'An unexpected error occurred.')]);
  });
}
