import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import { fixtureModel } from '../fixtures/model.mjs';
import type { ModelConfig, ReasoningEffort } from '../../apps/runtime/src/ai/types.js';
it('applies real DSH reasoning to resumed sessions and restores provider defaults without changing model identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bff reasoning ')), p = paths(root); preparePaths(p);
  const db = openDatabase(p.database), chat = new ChatService(db, p), engine = new DSHAdapter(p), fixture = await fixtureModel();
  try {
    for (const provider of ['openai', 'deepseek'] as const) {
      const model: ModelConfig = { id: provider, label: provider, provider, model: provider === 'deepseek' ? 'deepseek-v4-flash' : 'fixture-model', baseURL: provider === 'deepseek' ? fixture.url.replace('/v1', '/anthropic') : fixture.url, contextWindow: 8192, maxTokens: 512, timeoutMs: 10000, vision: false };
      chat.config.saveModel({ ...model, apiKey: 'fixture-reasoning' });
      const conversation = chat.create({ modelId: model.id }), sessionId = randomUUID();
      let turn = 0;
      for (const effort of ['high', 'low', undefined, 'none', 'max'] as const) {
        chat.config.saveModel({ ...model, reasoningEffort: effort });
        const loaded = chat.config.model(model.id);
        expect(loaded.config.reasoningEffort).toBe(effort);
        // Archive restoration re-validates stored config via this same save path.
        expect(chat.config.saveModel(loaded.config).reasoningEffort).toBe(effort);
        const before = fixture.requests.length;
        const output = await engine.run({ conversationId: conversation.id, sessionId, resume: turn > 0, model: loaded.config, key: loaded.key, persona: chat.config.persona(), prompt: `reasoning-turn-${turn++}`, signal: AbortSignal.timeout(15000), onText: () => {}, onSessionReady: () => {} });
        expect(output).toContain('回复');
        const actual = fixture.requests.slice(before).find(req => req.url.includes('messages') || req.url.includes('completions'))!;
        if (provider === 'openai') {
          expect(actual.body.reasoning_effort).toBe(effort);
          expect(actual.body.max_completion_tokens).toBe(512);
        } else {
          expect(actual.body.thinking).toEqual({ type: effort === 'none' ? 'disabled' : 'enabled' });
          expect(actual.body.output_config).toEqual(effort === 'none' ? undefined : { effort: effort ?? 'high' });
        }
        if (turn > 1) expect(JSON.stringify(actual.body.messages)).toContain('reasoning-turn-0');
      }
      for (const change of [{ baseURL: model.baseURL + '/changed' }, { model: 'other' }, { contextWindow: 16384 }]) expect(() => chat.config.saveModel({ ...model, ...change })).toThrow('MODEL_IN_USE');
      expect(() => chat.config.saveModel({ ...model, reasoningEffort: 'invalid' as ReasoningEffort })).toThrow('INVALID_REASONING_EFFORT');
      if (provider === 'deepseek') expect(() => chat.config.saveModel({ ...model, reasoningEffort: 'medium' })).toThrow('INVALID_REASONING_EFFORT');
    }
  } finally { await engine.close(); await chat.close(); db.close(); await fixture.close(); rmSync(root, { recursive: true, force: true }); }
}, 120000);
