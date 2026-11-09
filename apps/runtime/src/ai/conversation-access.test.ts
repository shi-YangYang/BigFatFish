import Fastify from 'fastify';
import { registerAi } from './routes.js';
import { expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, preparePaths } from '../paths.js';
import { openDatabase } from '../storage/database.js';
import { ChatService } from './chat.js';

it('reports actual conversation access without leaking principals or trusting QQ titles', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-conversation-access-')));
  preparePaths(p);
  const db = openDatabase(p.database), chat = new ChatService(db, p);
  const app = Fastify();
  try {
    await registerAi(app, chat);
    chat.config.saveModel({ id: 'fixture', provider: 'openai', baseURL: 'http://127.0.0.1:1/v1', model: 'fixture' });
    const local = chat.create({ modelId: 'fixture', title: 'QQ 群 12345' });
    const external = chat.create({ modelId: 'fixture', title: '普通标题' }, { audience: 'group', principal: 'qq-user:12345' });
    expect(local.readOnly).toBe(false);
    expect(external.readOnly).toBe(true);
    expect(chat.conversation(local.id).readOnly).toBe(false);
    expect(chat.conversation(external.id).readOnly).toBe(true);
    const listed = (await app.inject('/v1/conversations')).json<ReturnType<typeof chat.conversations>>();
    expect(listed.find(item => item.id === local.id)?.readOnly).toBe(false);
    expect(listed.find(item => item.id === external.id)?.readOnly).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('principal');
    expect(JSON.stringify(listed)).not.toContain('qq-user:12345');
    expect(() => chat.send(external.id, { content: 'blocked', requestId: 'read-only' })).toThrow('EXTERNAL_CONVERSATION_READ_ONLY');
    // An older local conversation must survive the 500-row limit even if the
    // owner has hundreds of newer conversations through a connection.
    const insert = db.prepare("INSERT INTO conversations (id, title, model_id, created_at, audience, principal) VALUES (?, '私聊', 'fixture', '9999-01-01', 'owner', 'qq-owner:12345')");
    for (let index = 0; index < 500; index++) insert.run(`channel-${index}`);
    expect(chat.conversations()).toHaveLength(500);
    expect(chat.conversations().some(item => item.id === local.id)).toBe(false);
    expect((await app.inject('/v1/conversations/local')).json()).toEqual([local]);
  } finally { await app.close(); await chat.close(); db.close(); rmSync(p.root, { recursive: true, force: true }); }
});
