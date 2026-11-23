import Fastify from 'fastify';
import { registerAi } from '../routes.js';
import { expect, it, vi } from 'vitest';
import { DSHAdapter } from '../engine/dsh.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths, preparePaths } from '../../storage/paths.js';
import { openDatabase } from '../../storage/database.js';
import { ChatService } from './service.js';

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


it('recovers only a local, idle conversation on a configured model without losing its history or changing defaults', async () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff-model-recovery-')));
  preparePaths(p);
  const db = openDatabase(p.database), chat = new ChatService(db,p), app = Fastify();
  let finish = () => {};
  const hold = new Promise<void>(resolve => { finish = resolve; });
  const engine = vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input => {
    if (input.ephemeral) return '{"changed":false,"items":[]}';
    input.onSessionReady(); await hold; return '继续聊天';
  });
  try {
    await registerAi(app,chat);
    for (const id of ['original','working']) chat.config.saveModel({id, provider:'openai', baseURL:'http://127.0.0.1:1/v1',model:id});
    chat.config.saveRoutes({chat:'original'});
    const local=chat.create({}), group=chat.create({},{audience:'group',principal:'qq-user:12345'});
    db.prepare("INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author) VALUES('first',?,'user','旧会话原话','completed',?,'first-turn',1,'local-owner')").run(local.id,new Date().toISOString());
    const rebind=(id:string, modelId:string)=>app.inject({method:'PUT',url:`/v1/conversations/${id}/model`,payload:{modelId}});
    expect((await rebind(group.id,'working')).statusCode).toBe(403);
    expect((await rebind(local.id,'missing')).statusCode).toBe(409);
    expect((await rebind(local.id,'working')).json()).toMatchObject({id:local.id, modelId:'working', readOnly:false});
    expect(chat.config.routes().chat).toBe('original');
    const sent=chat.send(local.id,{requestId:'next',content:'继续'});
    expect((await rebind(local.id,'original')).statusCode).toBe(409);
    await vi.waitFor(()=>expect(engine.mock.calls.find(([input])=>!input.ephemeral)?.[0]).toMatchObject({model:{id:'working'},resume:false,prompt:expect.stringContaining('旧会话原话')}));
    finish();
    await vi.waitFor(()=>expect(chat.message(sent.id).status).toBe('completed'));
    expect(chat.messages(local.id).map(x=>x.content)).toEqual(['旧会话原话','继续','继续聊天']);
  } finally { finish(); await app.close(); await chat.close(); engine.mockRestore(); db.close(); rmSync(p.root,{recursive:true,force:true}); }
});
