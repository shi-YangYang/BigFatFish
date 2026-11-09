import { expect, it } from 'vitest';
import { Agent, createServer as httpServer, request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { createServer } from '../../apps/runtime/src/server.js';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { registerAi } from '../../apps/runtime/src/ai/routes.js';

it('keeps real diagnostic sockets open beyond five seconds, returns service deadlines and restores ordinary keep-alive requests', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff model-http '))); preparePaths(p);
  const db = openDatabase(p.database), chat = new ChatService(db, p), stop = new AbortController();
  const connection = { version: 1 as const, port: 0, pid: process.pid, token: 'a'.repeat(64), instanceId: 'fixture', startedAt: new Date().toISOString() };
  const app = createServer(p, connection, () => {});
  // Node's default 1s client buffer would discard this server's advertised 1s
  // keep-alive connections instead of exercising real connection reuse.
  const agent = new Agent({ keepAlive: true, maxSockets: 1, agentKeepAliveTimeoutBuffer: 0 });
  const upstream = httpServer(async (req, res) => {
    req.resume();
    if (req.url?.startsWith('/hang/')) return;
    await delay(6500, undefined, { signal: stop.signal }).catch(() => {});
    if (stop.signal.aborted) return;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.url?.endsWith('/models') ? { data: [{ id: 'fixture-model' }] } : { choices: [{ message: { content: 'OK' } }] }));
  });
  let ordinarySocketTimeout: number | undefined;
  try {
    await registerAi(app, chat);
    app.post('/fixture/ordinary-slow', async req => {
      ordinarySocketTimeout = req.raw.socket.timeout;
      await delay(6500, undefined, { signal: stop.signal }).catch(() => {});
      return { ok: true };
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    connection.port = (app.server.address() as { port: number }).port;
    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
    const baseURL = `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1`;
    const draft = { provider: 'openai', baseURL, model: 'fixture-model', timeoutMs: 10_000 };
    const calls: { path: string; reusedSocket: boolean; elapsedMs: number; code?: string }[] = [];
    const call = (path: string, body: unknown, keepAlive = false) => new Promise<{ status: number; body: Record<string, unknown>; elapsedMs: number }>((resolve, reject) => {
      const start = performance.now();
      const req = request(`http://127.0.0.1:${connection.port}${path}`, {
        method: 'POST', agent: keepAlive ? agent : false,
        headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
      }, res => {
        let raw = ''; res.setEncoding('utf8'); res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          const elapsedMs = Math.round(performance.now() - start);
          calls.push({ path, reusedSocket: req.reusedSocket, elapsedMs });
          resolve({ status: res.statusCode!, body: JSON.parse(raw), elapsedMs });
        });
        res.on('error', reject);
      });
      req.on('error', (error: NodeJS.ErrnoException) => {
        calls.push({ path, reusedSocket: req.reusedSocket, elapsedMs: Math.round(performance.now() - start), code: error.code });
        reject(error);
      });
      req.end(JSON.stringify(body));
    });
    const success = async (path: string, keepAlive = false) => {
      const result = await call(path, draft, keepAlive);
      expect(result.status).toBe(200);
      expect(result.elapsedMs).toBeGreaterThan(6000);
      expect(result.elapsedMs).toBeLessThan(10_000);
      expect(result.body.elapsedMs).toBeGreaterThan(6000);
      expect(result.body).toMatchObject(path.endsWith('/test') ? { ok: true } : { models: [{ id: 'fixture-model', name: 'fixture-model' }] });
    };
    const deadline = async (path: string) => {
      const result = await call(path, { ...draft, baseURL: baseURL.replace('/v1', '/hang/v1'), timeoutMs: 6000 });
      expect(result.status).toBe(409);
      expect(result.body).toEqual({ error: 'MODEL_CONNECTION_TIMEOUT' });
      expect(result.elapsedMs).toBeGreaterThan(5500);
      expect(result.elapsedMs).toBeLessThan(8500);
    };
    await Promise.all([
      success('/v1/models/discover'),
      success('/v1/models/test', true).then(async () => {
        await expect(call('/fixture/ordinary-slow', {}, true)).rejects.toMatchObject({ code: 'ECONNRESET' });
        expect(ordinarySocketTimeout).toBe(5000);
        const ordinary = calls.find(c => c.path === '/fixture/ordinary-slow')!;
        expect(ordinary.reusedSocket).toBe(true);
        expect(ordinary.elapsedMs).toBeGreaterThan(4500);
        expect(ordinary.elapsedMs).toBeLessThan(6000);
      }),
      deadline('/v1/models/discover'),
      deadline('/v1/models/test'),
    ]);
    expect(app.server.requestTimeout).toBe(5000);
    expect(app.initialConfig.connectionTimeout).toBe(5000);
    console.log(JSON.stringify(calls));
  } finally {
    stop.abort(); agent.destroy();
    await app.close(); await chat.close();
    await new Promise<void>(resolve => { upstream.close(() => resolve()); upstream.closeAllConnections(); });
    db.close(); rmSync(p.root, { recursive: true, force: true });
  }
}, 20_000);
