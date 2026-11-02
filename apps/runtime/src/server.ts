import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import type { Connection, RuntimeStatus } from './connection.js';
import { readLogs } from './logger.js';
import type { DataPaths } from './paths.js';
import { SCHEMA_VERSION } from './storage/database.js';
export function createServer(p: DataPaths, connection: Connection, shutdown: () => void) {
  const app = Fastify({ logger: false, bodyLimit: 4096, requestTimeout: 5000, connectionTimeout: 5000, keepAliveTimeout: 1000, forceCloseConnections: true, ajv: { customOptions: { removeAdditional: false } } });
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    const host = req.headers.host;
    if (req.headers.origin !== undefined || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'none') || host !== `127.0.0.1:${connection.port}`) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    if (req.method === 'GET' && req.url === '/health') return;
    const actual = Buffer.from(req.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${connection.token}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  });
  app.setErrorHandler((error, _req, reply) => {
    const code = (error as { statusCode?: number }).statusCode;
    const status = code && code < 500 ? code : 500;
    reply.code(status).send({ error: status < 500 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR' });
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/v1/status', async (): Promise<RuntimeStatus> => ({ state: 'running', pid: process.pid, instanceId: connection.instanceId, startedAt: connection.startedAt, uptimeSeconds: Math.floor((Date.now() - Date.parse(connection.startedAt)) / 1000), schemaVersion: SCHEMA_VERSION }));
  app.get<{ Querystring: { lines?: number } }>('/v1/logs', { schema: { querystring: { type: 'object', properties: { lines: { type: 'integer', minimum: 1, maximum: 200, default: 50 } }, additionalProperties: false } } }, async (req) => ({ lines: readLogs(p.log, req.query.lines ?? 50) }));
  app.post('/v1/shutdown', { schema: { body: { type: 'object', additionalProperties: false, maxProperties: 0 } } }, async (_req, reply) => {
    reply.raw.once('finish', shutdown);
    return { state: 'stopping' };
  });
  return app;
}
