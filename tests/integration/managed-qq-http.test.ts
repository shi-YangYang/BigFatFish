import { expect, it } from 'vitest';
import { Agent, request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../apps/runtime/src/paths.js';
import { createServer } from '../../apps/runtime/src/server.js';
import { InputError } from '../../apps/runtime/src/ai/types.js';
import { registerManagedQQ, type ManagedQQ } from '../../apps/runtime/src/channels/managed/service.js';

it('keeps contact refresh sockets open beyond five seconds and restores timeouts after success and failure', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-managed-http-')));
  const connection = { version: 1 as const, port: 0, pid: process.pid, token: 'a'.repeat(64), instanceId: 'fixture', startedAt: new Date().toISOString() };
  const app = createServer(p, connection, () => {});
  // Retain the server's short keep-alive connection to exercise the next request.
  const agent = new Agent({ keepAlive: true, maxSockets: 1, agentKeepAliveTimeoutBuffer: 0 });
  const contactsPath = '/v1/channels/qq/component/contacts', refreshPath = `${contactsPath}/refresh`;
  const contacts = { accountId: '10001', friends: [{ id: '20002', name: '好友' }], groups: [] };
  let fail = false;
  const managed = {
    contactList: () => contacts,
    refreshContacts: async () => {
      await delay(5200);
      if (fail) throw new InputError('QQ_CONTACTS_UNAVAILABLE', 409);
      return contacts;
    },
  } as unknown as ManagedQQ;
  const restored: { status: number; timeout: number | undefined }[] = [];
  const ordinaryTimeouts: (number | undefined)[] = [];
  // Observe after the production route's onSend restoration, before Node changes
  // the socket to its keep-alive timeout when it finishes writing the response.
  app.addHook('onRoute', options => {
    if (options.url !== refreshPath) return;
    const hooks = options.onSend;
    options.onSend = [...(Array.isArray(hooks) ? hooks : hooks ? [hooks] : []), async (req, reply, payload) => {
      restored.push({ status: reply.statusCode, timeout: req.raw.socket.timeout });
      return payload;
    }];
  });
  app.addHook('preHandler', async req => {
    if (req.url === contactsPath) ordinaryTimeouts.push(req.raw.socket.timeout);
  });
  registerManagedQQ(app, managed);
  const call = (route: string, method: string) => new Promise<{ status: number; body: unknown; elapsedMs: number; reusedSocket: boolean }>((resolve, reject) => {
    const start = performance.now();
    const req = request(`http://127.0.0.1:${connection.port}${route}`, {
      method, agent, headers: { authorization: `Bearer ${connection.token}` },
    }, res => {
      let raw = ''; res.setEncoding('utf8'); res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(raw), elapsedMs: performance.now() - start, reusedSocket: req.reusedSocket }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
  try {
    await app.listen({ host: '127.0.0.1', port: 0 });
    connection.port = (app.server.address() as { port: number }).port;
    for (const failing of [false, true]) {
      fail = failing;
      const refresh = await call(refreshPath, 'POST');
      expect(refresh.elapsedMs).toBeGreaterThan(5000);
      expect(refresh.status).toBe(failing ? 409 : 200);
      expect(refresh.body).toEqual(failing ? { error: 'QQ_CONTACTS_UNAVAILABLE' } : contacts);
      const cached = await call(contactsPath, 'GET');
      expect(cached.reusedSocket).toBe(true);
      expect(cached.status).toBe(200);
      expect(cached.body).toEqual(contacts);
    }
    expect(restored).toEqual([{ status: 200, timeout: 5000 }, { status: 409, timeout: 5000 }]);
    expect(ordinaryTimeouts).toEqual([5000, 5000]);
    expect(app.initialConfig.connectionTimeout).toBe(5000);
    expect(app.server.requestTimeout).toBe(5000);
  } finally {
    agent.destroy();
    await app.close();
    rmSync(p.root, { recursive: true, force: true });
  }
}, 15_000);
