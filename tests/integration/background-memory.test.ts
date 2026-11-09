import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { fixtureModel } from '../fixtures/model.mjs';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';

it('completes two consecutive chat replies while the first memory analysis is paused, then remembers the sourced fact', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-memory-queue-chat-')));
  preparePaths(p);
  const db = openDatabase(p.database);
  const chat = new ChatService(db, p);
  let resumeAnalysis!: () => void;
  const gate = new Promise<void>(resolve => { resumeAnalysis = resolve; });
  const source = '我养了一只叫栗子的猫。';
  const conversation = () => chat.create({}).id;
  const send = async (id: string, content: string) => {
    const sent = chat.send(id, { content, requestId: crypto.randomUUID() });
    await vi.waitFor(() => expect(chat.message(sent.id)).toMatchObject({ status: 'completed', content: '知道啦' }));
  };
  let analyzing = false;
  const contexts = new Map<string, string>();
  const model = vi.spyOn(DSHAdapter.prototype, 'run').mockImplementation(async input => {
    input.onSessionReady();
    if (input.prompt.startsWith('BFF_MEMORY_TURN_ANALYSIS')) {
      expect(input.tools ?? []).toHaveLength(0);
      if (input.prompt.includes(source)) {
        analyzing = true;
        await gate;
        return JSON.stringify({ items: [{ quote: source, kind: 'fact', topic: '猫' }] });
      }
      return '{"items":[]}';
    }
    contexts.set(input.prompt, input.context ?? '');
    input.onText('知道啦');
    return '知道啦';
  });
  try {
    chat.config.saveModel({ id: 'fixture', provider: 'openai', baseURL: 'https://unused.invalid/v1', model: 'fixture' });
    chat.config.saveRoutes({ chat: 'fixture' });
    const first = conversation();
    await send(first, source);
    await vi.waitFor(() => expect(analyzing).toBe(true));
    await send(first, '你好');
    expect(chat.life.memories.list({ status: 'confirmed' })).toHaveLength(0);
    resumeAnalysis();
    await vi.waitFor(() => expect(chat.life.memories.list({ status: 'confirmed' })).toEqual([
      expect.objectContaining({ role: 'owner', sources: [expect.objectContaining({ quote: source })] }),
    ]));
    const question = '我的猫叫什么？';
    await send(conversation(), question);
    expect(contexts.get(question)).toContain('栗子');
  } finally {
    resumeAnalysis();
    await chat.close();
    model.mockRestore();
    db.close();
    rmSync(p.root, { recursive: true, force: true });
  }
});

it('extracts a source through the configured chat provider using an isolated DSH task', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-memory-queue-sdk-')));
  preparePaths(p);
  const db = openDatabase(p.database);
  const chat = new ChatService(db, p);
  const fixture = await fixtureModel();
  const quote = '我养了一只叫栗子的猫。';
  fixture.controls.turnMemoryResponse = JSON.stringify({ items: [{ quote, kind: 'fact', topic: '猫' }] });
  try {
    chat.config.saveModel({ id: 'loopback', provider: 'openai', baseURL: fixture.url, model: 'fixture-model' });
    chat.config.saveRoutes({ chat: 'loopback' });
    const sent = chat.send(chat.create({}).id, { content: quote, requestId: 'first' });
    await vi.waitFor(() => expect(chat.message(sent.id)).toMatchObject({ status: 'completed', content: '测试模型回复' }),
      { timeout: 15000 });
    await vi.waitFor(() => expect(chat.life.memories.list({ status: 'confirmed' })).toEqual([
      expect.objectContaining({ role: 'owner', sources: [expect.objectContaining({ quote })] }),
    ]), { timeout: 15000 });
    const analysis = fixture.requests.filter(r => JSON.stringify(r.body?.messages).includes('BFF_MEMORY_TURN_ANALYSIS'));
    expect(analysis).toHaveLength(1);
  } finally {
    await chat.close();
    await fixture.close();
    db.close();
    rmSync(p.root, { recursive: true, force: true });
  }
});
