import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { ChatService } from '../../apps/runtime/src/ai/chat.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
import type { EngineInput } from '../../apps/runtime/src/ai/engine.js';
import { NoteScope } from '../../apps/runtime/src/memory/note-scope.js';

afterEach(()=>vi.restoreAllMocks());

it('recalls paraphrases in live chat and tools, keeps scoped evidence current, and reuses its derived cache', async()=>{
  const p=paths(mkdtempSync(join(tmpdir(),'bff-semantic-'))); preparePaths(p);
  const db=openDatabase(p.database);
  let chat=new ChatService(db,p);
  const inputs:EngineInput[]=[];
  const passages:string[]=[];
  let toolResult:unknown;
  function encoder() {
    vi.spyOn(chat.life.embedder,'status').mockReturnValue({state:'ready',downloadedBytes:1,totalBytes:1,error:undefined});
    vi.spyOn(chat.life.embedder,'embed').mockImplementation(async(texts,kind)=>{
      if (kind==='passage') passages.push(...texts);
      return texts.map(text=>{
        const vector=new Float32Array(512);
        vector[/医院|看大夫|健康|复诊/.test(text)?0:/围捕|捕食|打猎/.test(text)?1:/学校|上课/.test(text)?2:3]=1;
        return vector;
      });
    });
  }
  vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{
    inputs.push(input);input.onSessionReady();
    if(input.prompt==='工具测试') toolResult=await input.tools!.find(t=>t.name==='memory_query')!.execute({query:'看大夫'},input.signal);
    return '收到';
  });
  async function settled() {
    chat.life.semantic.schedule();
    await vi.waitFor(()=>expect(chat.life.semantic.status()).toMatchObject({indexing:false,failed:false}),{interval:5});
  }
  let seq=0;
  async function send(prompt:string,group=false) {
    const id=chat.create({},group?{audience:'group',principal:'qq-user:22'}:undefined).id;
    const m=chat.send(id,{content:prompt,requestId:String(++seq)},group?'qq-user:22':'local-owner',
      group?{memoryScope:'qq:33:group:99'}:undefined);
    await vi.waitFor(()=>expect(chat.message(m.id).status).toBe('completed'),{interval:5});
    return inputs.findLast(i=>i.prompt===prompt)!;
  }
  try {
    encoder();
    chat.config.saveModel({id:'test',provider:'openai',baseURL:'https://unused.invalid/v1',model:'fixture'});
    chat.config.saveRoutes({chat:'test'});
    const memories=chat.life.memories;
    const visit=memories.create({kind:'fact',subject:'日程',content:'星期四要去医院复诊',importance:2});
    const publicMemory=memories.create({kind:'fact',subject:'社团',content:'健康讲座在南门',importance:2});
    const visible=memories.update(publicMemory.id,{visibility:'shared',version:publicMemory.version});
    const insertNote = db.prepare('INSERT INTO conversation_notes VALUES(?,?,?,?,?,?,?)');
    insertNote.run('ours','qq:33:group:99','m1','qq-user:22','健康讲座带水','带水','now');
    insertNote.run('theirs','qq:33:group:98','m2','qq-user:22','健康书籍密码','书籍','now');
    const watch={id:'evt',kind:'douyin.watched',sourceId:'video-id',summary:'虎鲸围捕鱼群',occurredAt:'2026-01-01'};
    memories.record(watch);
    memories.record({...watch,id:'other',kind:'qq.received',summary:'虎鲸保密细节'});
    await settled();
    expect(chat.life.semantic.status().indexed).toBe(5);

    const local=await send('看大夫安排在哪天');
    expect(local.context).toContain(visit.content);
    expect((await send('它们是怎么合作打猎的')).context).toContain(watch.summary);
    expect((await send('B站那些捕食行为')).context).not.toContain(watch.summary);
    const group=await send('看大夫怎么走',true);
    expect(group.context).toContain('健康讲座带水');
    expect(group.context).toContain(publicMemory.content);
    expect(group.context).not.toMatch(/复诊|书籍密码/);
    await send('工具测试',true);
    expect(JSON.stringify(toolResult)).toContain('带水');
    expect(JSON.stringify(toolResult)).not.toMatch(/复诊|书籍密码/);
    // A known ID cannot read a note under the other QQ relationship either.
    const peer='qq:33:private:22';
    insertNote.run('old-owner',peer,'m3','qq-owner:22','健康私聊','健康','now');
    await settled();
    const ids=chat.life.semantic.noteIds(await chat.life.semantic.query('看大夫'),new NoteScope(db,peer,false).recent().map(n=>n.id));
    expect(ids).not.toContain('old-owner');

    const before=passages.length;
    memories.update(visit.id,{content:'改到星期五上课',version:visit.version});
    memories.update(visible.id,{visibility:'private',version:visible.version});
    await settled();
    expect(passages.slice(before)).toEqual([expect.stringContaining('星期五上课')]);
    expect((await send('看大夫安排在哪天')).context).not.toContain('改到星期五上课');
    expect((await send('看大夫怎么走',true)).context).not.toContain(publicMemory.content);
    expect((await send('学校安排呢')).context).toContain('改到星期五上课');
    const old=memories.get(visit.id); memories.delete(old.id,{version:old.version});
    await settled();
    expect((await send('学校安排呢')).context).not.toContain('上课');
    const beforeRestart=passages.length;
    await chat.close();
    chat=new ChatService(db,p);encoder();await settled();
    expect(passages.length).toBe(beforeRestart);
    expect((await send('它们是怎么合作打猎的')).context).toContain(watch.summary);
  } finally {
    await chat.close();db.close();rmSync(p.root,{recursive:true,force:true});
  }
});

it('falls back to lexical chat when the derived index cannot be opened, and rejects stale encodings during an edit', async()=>{
  const p=paths(mkdtempSync(join(tmpdir(),'bff-semantic-edit-')));preparePaths(p);
  const db=openDatabase(p.database), chat=new ChatService(db,p);
  let finish!:()=>void, started!:()=>void;
  const blocked=new Promise<void>(resolve=>{finish=resolve;});
  const reached=new Promise<void>(resolve=>{started=resolve;});
  const vector=(axis:number)=>{const result=new Float32Array(512);result[axis]=1;return result;};
  vi.spyOn(chat.life.embedder,'status').mockReturnValue({state:'ready',downloadedBytes:1,totalBytes:1,error:undefined});
  vi.spyOn(chat.life.embedder,'embed').mockImplementation(async(texts,kind)=>{
    if(kind==='passage' && texts.some(t=>t.includes('花生'))) {started();await blocked;}
    return texts.map(t=>vector(t.includes('巴士')?1:0));
  });
  const contexts:string[]=[];
  vi.spyOn(DSHAdapter.prototype,'run').mockImplementation(async input=>{contexts.push(input.context!);return '收到';});
  try {
    const store=chat.life.memories;
    const old=store.create({kind:'fact',subject:'食物',content:'对花生过敏',importance:1});
    await reached;
    store.update(old.id,{version:old.version,content:'改坐巴士'});
    finish();
    await vi.waitFor(()=>expect(chat.life.semantic.status()).toEqual({indexed:1,indexing:false,failed:false}));
    expect(chat.life.semantic.memoryIds(vector(0),true)).toEqual([]);
    expect(chat.life.semantic.memoryIds(vector(1),true)).toEqual([old.id]);
    // The derived table can be unavailable without disabling lexical replies.
    db.exec('DROP TABLE semantic_cache.vectors');
    chat.config.saveModel({id:'test',provider:'openai',baseURL:'https://unused.invalid/v1',model:'test'});
    chat.config.saveRoutes({chat:'test'});
    const m=chat.send(chat.create({}).id,{content:'巴士',requestId:'retry'});
    await vi.waitFor(()=>expect(chat.message(m.id).status).toBe('completed'));
    expect(contexts[0]).toContain('改坐巴士');
    expect(chat.life.semantic.status().failed).toBe(true);
  } finally {finish();await chat.close();db.close();rmSync(p.root,{recursive:true,force:true});}
});
