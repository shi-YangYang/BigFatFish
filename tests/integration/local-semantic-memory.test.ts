import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { expect, it, vi } from 'vitest';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import { registerLife } from '../../apps/runtime/src/memory/routes.js';

// Opt-in with the directory of a previously downloaded model. No remote model or account is used.
const weights = process.env.BFF_TEST_BGE_DIR;
it.skipIf(!weights)('finds an automatically saved natural-language memory by paraphrase with the real local encoder', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bff-real-recall-'));
  const p = paths(root);
  preparePaths(p);
  cpSync(weights!, join(p.data, 'bge-small-zh-v1.5-int8'), { recursive: true });
  const db = openDatabase(p.database);
  const chat = new ChatService(db, p);
  const server = Fastify();
  registerLife(server, chat.life);
  const source = '耳鼻喉科的大夫约我周一上午回医院复诊。';
  const question = '我的下次就医安排在哪天？';
  let context = '';
  const engine = vi.spyOn(DSHAdapter.prototype, 'run').mockImplementation(async input => {
    if (input.prompt.startsWith('BFF_MEMORY_TURN_ANALYSIS')) return '{"items":[]}';
    context = input.context ?? '';
    return '收到';
  });
  try {
    chat.config.saveModel({ id: 'fixture', provider: 'openai', baseURL: 'https://unused.invalid/v1', model: 'fixture' });
    chat.config.saveRoutes({ chat: 'fixture' });
    const send = async (text: string) => {
      const m = chat.send(chat.create({}).id, { requestId: crypto.randomUUID(), content: text });
      await vi.waitFor(() => expect(chat.message(m.id).status).toBe('completed'), { timeout: 5000 });
      return context;
    };
    await send(source);
    const lookup = () => chat.life.memories.list({ query: '复诊' });
    await vi.waitFor(() => expect(lookup()).toHaveLength(1));
    const confirmed = lookup()[0]!;
    expect(confirmed).toMatchObject({status:'confirmed',role:'owner',sources:[{type:'message',quote:source}]});
    for (const [subject, content] of [['露营', '周末去山脚支帐篷'], ['甜品', '打算做焦糖布丁'], ['旅行', '买了开往苏州的高铁票']]) {
      chat.life.memories.create({ kind: 'experience', subject, content, importance: 3 });
    }
    // The automatically saved statement has no lexical match for this paraphrase.
    expect(await send(question)).not.toContain(source);
    const started = await server.inject({ method: 'PUT', url: '/v1/memory-recall', payload: { enabled: true } });
    expect(started.statusCode).toBe(200);
    await vi.waitFor(async () => {
      const reply = await server.inject({ method: 'GET', url: '/v1/memory-recall' });
      expect(reply.json()).toMatchObject({ state: 'ready', indexing: false, indexed: 4 });
    }, { timeout: 20000 });
    expect(await send(question)).toContain(source);
    expect(await send("月球的半径是多少？")).not.toContain(source);
    chat.life.memories.delete(confirmed.id, { version: confirmed.version });
    expect(await send(question)).not.toContain(source);
  } finally {
    await server.close();
    await chat.close();
    engine.mockRestore();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 45000);
