import { afterEach, expect, it } from 'vitest';
import { createServer as httpServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, preparePaths } from '../paths.js';
import { openDatabase } from '../storage/database.js';
import { Configuration } from './configuration.js';
import { discoverModels, testModelConnection } from './model-connection.js';
import { registerAi } from './routes.js';
import { ChatService } from './chat.js';
import { createServer } from '../server.js';

let cleanup = async () => {};
afterEach(async () => cleanup());
it('diagnoses unsaved connections without persisting or leaking credentials, bounds responses and classifies failures', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff model-probe '))); preparePaths(p); const db = openDatabase(p.database), config = new Configuration(db, p);
  let status = 200, response: unknown = { data: [{ id: 'one' }, { id: 'one' }, { id: 'two', name: '二' }] }, slow = false;
  const requests: { url: string; key?: string; body: Record<string, unknown> }[] = [];
  const server = httpServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += part;
    requests.push({ url: req.url!, key: req.headers.authorization ?? String(req.headers['x-api-key'] ?? ''), body: JSON.parse(raw || '{}') });
    if (slow) return;
    res.writeHead(status, { 'content-type': 'application/json', ...(status === 302 ? { location: '/should-not-follow' } : {}) });
    res.end(typeof response === 'string' ? response : JSON.stringify(response));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup = async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); db.close(); rmSync(p.root, { recursive: true, force: true }); };
  const baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  const draft = { provider: 'openai', baseURL };
  expect((await discoverModels(config, draft)).models).toEqual([{ id: 'one', name: 'one' }, { id: 'two', name: '二' }]);
  expect(config.models()).toHaveLength(0);
  const saved = { ...draft, id: 'saved', label: 'test', model: 'one', contextWindow: 8192, maxTokens: 512, timeoutMs: 1000, vision: false };
  config.saveModel({ ...saved, apiKey: 'stored-fixture-key' });
  await discoverModels(config, { ...draft, id: 'saved', baseURL: baseURL + '/' }); expect(requests.at(-1)?.key).toBe('Bearer stored-fixture-key');
  await expect(discoverModels(config, { ...draft, id: 'saved', baseURL: baseURL + '/other' })).rejects.toThrow('MODEL_KEY_REENTRY_REQUIRED');
  await discoverModels(config, { ...draft, id: 'saved', baseURL: baseURL + '/other', apiKey: 'new-fixture' }); expect(requests.at(-1)?.key).toBe('Bearer new-fixture');
  await discoverModels(config, { ...draft, id: 'saved', apiKey: '' }); expect(requests.at(-1)?.key).toBe('');
  response = { choices: [{ message: { content: 'OK' } }] };
  expect(await testModelConnection(config, { ...saved, reasoningEffort: 'max' })).toMatchObject({ ok: true });
  expect(requests.at(-1)?.body).toMatchObject({ model: 'one', reasoning_effort: 'max', max_completion_tokens: 256, stream: false });
  response = { content: [{ type: 'text', text: 'OK' }] };
  await testModelConnection(config, { ...saved, id: '', provider: 'deepseek', baseURL: baseURL.replace('/v1', '/anthropic'), reasoningEffort: 'none', apiKey: 'deepseek-fixture' });
  expect(requests.at(-1)).toMatchObject({ url: '/anthropic/v1/messages', key: 'deepseek-fixture', body: { max_tokens: 256, thinking: { type: 'disabled' } } });
  expect(requests.at(-1)?.body).not.toHaveProperty('output_config');
  response = { data: [] }; await discoverModels(config, { ...draft, provider: 'deepseek', baseURL: baseURL.replace('/v1', '/anthropic') }); expect(requests.at(-1)?.url).toBe('/models');
  for (const [code, message] of [[401, 'MODEL_AUTH_FAILED'], [403, 'MODEL_ACCESS_DENIED'], [404, 'MODEL_ENDPOINT_NOT_FOUND'], [429, 'MODEL_RATE_LIMIT'], [500, 'MODEL_SERVICE_UNAVAILABLE'], [302, 'MODEL_REDIRECT_DENIED']] as const) {
    status = code; response = { error: 'stored-fixture-key' }; await expect(discoverModels(config, draft)).rejects.toThrow(message);
  }
  expect(requests.some(req => req.url === '/should-not-follow')).toBe(false);
  status = 200; response = 'bad-json'; await expect(discoverModels(config, draft)).rejects.toThrow('MODEL_INVALID_RESPONSE');
  response = { data: [{ id: '' }] }; await expect(discoverModels(config, draft)).rejects.toThrow('MODEL_INVALID_LIST');
  response = 'x'.repeat(1_048_577); await expect(discoverModels(config, draft)).rejects.toThrow('MODEL_RESPONSE_TOO_LARGE');
  response = { choices: [{ message: { content: '' } }] }; await expect(testModelConnection(config, saved)).rejects.toThrow('MODEL_EMPTY_TEST_RESPONSE');
  slow = true; await expect(discoverModels(config, { ...draft, timeoutMs: 1000 })).rejects.toThrow('MODEL_CONNECTION_TIMEOUT');
  for (const url of ['http://example.com/v1', 'https://user:pass@example.com', 'https://example.com/?key=x']) await expect(discoverModels(config, { ...draft, baseURL: url })).rejects.toThrow('INVALID_MODEL_URL');
  expect(config.model('saved').config).not.toHaveProperty('reasoningEffort');
  expect(db.prepare('SELECT COUNT(*) AS n FROM conversations').get()?.n).toBe(0);
  expect(JSON.stringify(config.models())).not.toContain('stored-fixture-key');
});
it('protects new Runtime endpoints with existing authentication', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff model-auth '))); preparePaths(p); const db = openDatabase(p.database), chat = new ChatService(db, p);
  const app = createServer(p, { version: 1, port: 12345, pid: process.pid, token: 'a'.repeat(64), instanceId: 'fixture', startedAt: new Date().toISOString() }, () => {});
  cleanup = async () => { await app.close(); await chat.close(); db.close(); rmSync(p.root, { recursive: true, force: true }); };
  await registerAi(app, chat);
  for (const url of ['/v1/models/discover', '/v1/models/test']) {
    expect((await app.inject({ method: 'POST', url, headers: { host: '127.0.0.1:12345' }, payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url, headers: { host: '127.0.0.1:12345', authorization: 'Bearer ' + 'a'.repeat(64) }, payload: {} })).json()).toEqual({ error: 'INVALID_PROVIDER' });
  }
});
