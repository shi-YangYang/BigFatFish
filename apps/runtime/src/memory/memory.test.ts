import { afterEach, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, migrations, openDatabase } from '../storage/database.js';
import { preparePaths, paths } from '../paths.js';
import { Configuration } from '../ai/configuration.js';
import { MemoryStore } from './store.js';
import { LifeService, dayAt, diaryDate } from './life.js';
import { privateCopy } from './files.js';
const roots:string[]=[];afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
const temp=()=>{const p=paths(mkdtempSync(join(tmpdir(),'bff-memory-unit-')));roots.push(p.root);preparePaths(p);return p;};
const candidate=(content='主人喜欢茶',subject='主人饮品偏好',id='manual')=>({kind:'preference',content,subject,importance:3,sources:[{type:'user',id,quote:content}]});
it('preserves P1 data while migrating and rolls back a failed P2 migration',()=>{
 const db=new DatabaseSync(':memory:');migrate(db,migrations.slice(0,2));db.prepare("INSERT INTO settings VALUES('retained','yes')").run();
 expect(()=>migrate(db,[...migrations.slice(0,2),migrations[2]!+'BROKEN SQL'])).toThrow();expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(2);expect(db.prepare("SELECT name FROM sqlite_master WHERE name='memories'").get()).toBeUndefined();
 migrate(db);expect(db.prepare("SELECT value FROM settings WHERE key='retained'").get()!.value).toBe('yes');expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(4);db.close();
});
it('deduplicates normalized statements, preserves sources/rejection and requires explicit conflict choice',()=>{
 const db=openDatabase(':memory:'),store=new MemoryStore(db);
 const a=store.insert(candidate()),duplicate=store.insert(candidate('主人喜欢茶！','主人饮品偏好','source2'));expect(a.id).toBe(duplicate.id);expect(duplicate.sources).toHaveLength(2);
 const rejected=store.update(a.id,{version:duplicate.version,status:'rejected'});expect(store.insert(candidate()).status).toBe('rejected');expect(store.retrieve('茶')).toHaveLength(0);
 const confirmed=store.update(a.id,{version:rejected.version,status:'confirmed'}),b=store.insert(candidate('主人不喜欢茶'));expect(b.conflicts).toContain(a.id);expect(()=>store.update(b.id,{version:b.version,status:'confirmed'})).toThrow('MEMORY_CONFLICT');
 expect(()=>store.update(a.id,{version:1,content:'改动'})).toThrow('MEMORY_VERSION_CONFLICT');store.update(b.id,{version:b.version,status:'confirmed',allowConflict:true});expect(store.retrieve('茶')).toHaveLength(2);
 store.delete(a.id,{version:confirmed.version});expect(()=>store.get(a.id)).toThrow('MEMORY_NOT_FOUND');expect(db.prepare('SELECT * FROM memory_links WHERE memory_id=?').all(a.id)).toHaveLength(0);db.close();
});
it('enforces retrieval budgets, updates search and collections, exports only selected data',()=>{
 const db=openDatabase(':memory:'),store=new MemoryStore(db);const m=store.create({...candidate(),kind:'interest'});expect(store.list({kind:'interest',status:'confirmed'})).toHaveLength(1);expect(db.prepare('SELECT * FROM interests').all()).toHaveLength(1);
 expect(store.retrieve('茶')).toHaveLength(1);expect(store.retrieve('茶',10)).toHaveLength(0);
 const updated=store.update(m.id,{version:m.version,content:'喜欢绘画',kind:'relationship'});expect(store.list({query:'绘画'})).toHaveLength(1);expect(store.list({query:'茶'})).toHaveLength(0);expect(store.retrieve('茶')).toHaveLength(0);expect(db.prepare('SELECT * FROM interests').all()).toHaveLength(0);expect(db.prepare('SELECT * FROM relationships').all()).toHaveLength(1);
 const exported=store.export({format:'json',ids:[m.id]});expect(exported.content).toContain('喜欢绘画');expect(exported.content).not.toContain('master.key');expect(()=>store.export({format:'../../json',ids:[m.id]})).toThrow();store.delete(m.id,{version:updated.version});db.close();
});
it('rejects nonexistent, assistant and incomplete-turn sources; records activity and mood exactly once',()=>{
 const db=openDatabase(':memory:'),store=new MemoryStore(db);expect(()=>store.insert({...candidate(),sources:[{type:'message',id:'missing',quote:'茶'}]})).toThrow('INVALID_MEMORY_SOURCE');
 const event={id:'real-event',kind:'chat.completed',sourceId:'message-id',summary:'完成一次真实对话',occurredAt:new Date().toISOString()};expect(store.record(event)).toBe(true);expect(store.record(event)).toBe(false);expect(store.timeline()).toHaveLength(1);expect(db.prepare('SELECT * FROM experiences').all()).toHaveLength(1);expect(db.prepare('SELECT * FROM mood_history').all()).toHaveLength(1);db.close();
});
it('handles timezone midnight, invalid dates, interrupted tasks and failed readable copies',()=>{
 expect(dayAt('2026-11-02T18:00:00Z','Asia/Shanghai')).toBe('2026-11-03');expect(dayAt('2026-11-02T18:00:00Z','America/Los_Angeles')).toBe('2026-11-02');expect(()=>diaryDate('2026-02-30','UTC')).toThrow('INVALID_DATE');expect(()=>diaryDate('2026-02-02','not/a/zone')).toThrow('INVALID_TIMEZONE');
 const p=temp(),db=openDatabase(p.database),config=new Configuration(db,p);db.prepare("INSERT INTO memory_tasks VALUES('interrupted','r','extract','{}','running','test',NULL,NULL,'now')").run();
 db.prepare("INSERT INTO daily_diaries VALUES('copy','2026-11-03','UTC','真实日记','[]',1,'test','now','pending')").run();
 const life=new LifeService(db,p,config,{run:async()=>{throw new Error('not called');},close:async()=>{}},new EventEmitter());expect(life.task('interrupted').status).toBe('interrupted');expect(life.diary('copy').copyStatus).toBe('failed');
 writeFileSync(join(p.data,'diaries'),'blocking file');expect(life.rebuild('copy').copyStatus).toBe('failed');expect(life.diary('copy').content).toBe('真实日记');rmSync(join(p.data,'diaries'));expect(life.rebuild('copy').copyStatus).toBe('ready');
 if(process.platform!=='win32')expect(statSync(join(p.data,'diaries','copy.md')).mode&0o777).toBe(0o600);
 const m=life.memories.create(candidate());writeFileSync(join(p.data,'exports'),'blocked');expect(()=>life.export({ids:[m.id],format:'json'})).toThrow('EXPORT_FAILED');db.close();
});
it.skipIf(process.platform==='win32')('rejects symlink copy destinations without writing outside product data',()=>{const p=temp(),outside=join(p.root,'outside');writeFileSync(outside,'safe');symlinkSync(outside,join(p.data,'diaries'));expect(()=>privateCopy(join(p.data,'diaries'),'copy.md','secret')).toThrow('UNSAFE_DATA_PATH');});

it('explicitly merges synonymous records with all sources and checks both edit versions',()=>{const db=openDatabase(':memory:'),store=new MemoryStore(db);const a=store.insert(candidate()),b=store.insert(candidate('主人爱喝茶','饮品爱好','second'));expect(()=>store.merge(a.id,{version:0,otherId:b.id,otherVersion:b.version})).toThrow('MEMORY_VERSION_CONFLICT');const merged=store.merge(a.id,{version:a.version,otherId:b.id,otherVersion:b.version});expect(merged.content).toBe(a.content);expect(merged.sources).toHaveLength(2);expect(()=>store.get(b.id)).toThrow('MEMORY_NOT_FOUND');db.close();});

it('does not retrieve a confirmed fact after its only source disappears',()=>{const db=openDatabase(':memory:'),store=new MemoryStore(db);db.prepare("INSERT INTO activity_records VALUES('source','activity','original','茶的话题','2026-11-03T00:00:00Z')").run();const m=store.insert({...candidate(),sources:[{type:'activity',id:'source',quote:'茶的话题'}]});store.update(m.id,{version:m.version,status:'confirmed'});expect(store.retrieve('茶')).toHaveLength(1);db.prepare("DELETE FROM activity_records WHERE id='source'").run();expect(store.retrieve('茶')).toHaveLength(0);const current=store.get(m.id);store.update(m.id,{version:current.version,content:'用户重新确认喜欢茶'});expect(store.retrieve('茶')).toHaveLength(1);db.close();});

it.each(['edit','deduplicate','merge'] as const)('keeps accumulated %s sources manageable, exported and independently bounded in context',mode=>{
 const db=openDatabase(':memory:'),store=new MemoryStore(db);
 try {
  let m=store.create(candidate());
  for(let i=1;i<=200;i++){
   if(mode==='edit')m=store.update(m.id,{version:m.version,content:`主人喜欢茶，第${i}次填写`});
   else if(mode==='deduplicate')m=store.insert(candidate(m.content,m.subject,`source-${i}`));
   else {const other=store.insert(candidate(`另一条茶记录${i}`,`来源主题${i}`,`source-${i}`));m=store.merge(m.id,{version:m.version,otherId:other.id,otherVersion:other.version});}
  }
  expect(m.sources).toHaveLength(201);
  m=store.update(m.id,{version:m.version,status:'rejected'});expect(m.status).toBe('rejected');expect(store.retrieve('茶')).toHaveLength(0);
  m=store.update(m.id,{version:m.version,content:'主人现在喜欢乌龙茶'});
  m=store.update(m.id,{version:m.version,status:'confirmed'});expect(m.sources).toHaveLength(202);
  const context=store.retrieve('乌龙茶');expect(context).toHaveLength(1);expect(context[0]!.sources).toHaveLength(3);expect(context[0]!.sources[0]!.quote).toBe(m.content);
  expect(context.reduce((n,m)=>n+JSON.stringify(m).length,0)).toBeLessThanOrEqual(4000);expect(store.retrieve('乌龙茶',10)).toHaveLength(0);
  expect(JSON.parse(store.export({format:'json',ids:[m.id]}).content).memories[0].sources).toEqual(m.sources);
  expect(store.export({format:'markdown',ids:[m.id]}).content).toContain(m.sources[0]!.quote);
  expect(()=>store.insert({...candidate(),sources:m.sources})).toThrow('INVALID_MEMORY');
 } finally { db.close(); }
});

it('bounds long context excerpts while retaining full valid evidence and skipping missing newer sources',()=>{
 const db=openDatabase(':memory:'),store=new MemoryStore(db);
 try {
  const m=store.insert({...candidate(),sources:[{type:'user',id:'long',quote:'茶'.repeat(4000)}]},'confirmed');
  db.prepare("INSERT INTO memory_links VALUES(?, 'activity', 'missing', '茶')").run(m.id);
  const context=store.retrieve('茶');expect(context).toHaveLength(1);expect(context[0]!.sources).toEqual([{type:'user',id:'long',quote:'茶'.repeat(500)}]);
  expect(store.get(m.id).sources[0]!.quote).toHaveLength(4000);
 } finally { db.close(); }
});

function diaryFixture(){
 const p=temp(),db=openDatabase(p.database),config=new Configuration(db,p);
 config.saveModel({id:'test',label:'测试',provider:'openai',baseURL:'http://127.0.0.1:9999/v1',model:'test',contextWindow:32768,maxTokens:4096,timeoutMs:30000,vision:false});config.saveRoutes({chat:'test'});
 const prompts:string[]=[];
 const life=new LifeService(db,p,config,{run:async({prompt})=>{prompts.push(prompt);const sources=JSON.parse(prompt.split('\n来源：')[1]!.split('\n参考记忆：')[0]!) as {id:string}[];return JSON.stringify({content:'真实活动日记',sourceIds:sources.map(s=>s.id)});},close:async()=>{}},new EventEmitter());
 const insert=db.prepare('INSERT INTO activity_records VALUES(?,?,?,?,?)');
 const event=(id:string,at:string)=>insert.run(id,'activity',id,'真实活动',at);
 return {db,life,prompts,event};
}

it.each([501,9999])('reads the target day after %i preceding-day events without truncation',async preceding=>{
 const {db,life,prompts,event}=diaryFixture();
 try {
  for(let i=0;i<preceding;i++)event(`before-${i}`,'2026-01-01T12:00:00.000Z');
  event('target','2026-01-02T00:00:00.000Z');
  const task=life.start('diary',{day:'2026-01-02',timezone:'UTC',requestId:'day'});
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(life.task(task.id).status).toBe('completed');expect(prompts).toHaveLength(1);expect(life.diaries()[0]!.sources.map(s=>s.id)).toEqual(['target']);
 } finally { await life.close();db.close(); }
});

it('retains same-timestamp events spanning a page and rejects oversized days or incomplete scans before model invocation',async()=>{
 const {db,life,prompts,event}=diaryFixture();
 try {
  for(let i=0;i<499;i++)event(`before-${i}`,'2026-01-01T12:00:00.000Z');
  event('target-a','2026-01-02T00:00:00.000Z');event('target-b','2026-01-02T00:00:00.000Z');
  const task=life.start('diary',{day:'2026-01-02',timezone:'UTC',requestId:'ties'});await new Promise(resolve=>setTimeout(resolve,0));
  expect(life.task(task.id).status).toBe('completed');expect(life.diaries()[0]!.sources.map(s=>s.id)).toEqual(['target-a','target-b']);
  for(let i=0;i<199;i++)event(`target-${i}`,'2026-01-02T01:00:00.000Z');
  expect(()=>life.start('diary',{day:'2026-01-02',timezone:'UTC',requestId:'too-many'})).toThrow('SOURCE_BUDGET_EXCEEDED');expect(prompts).toHaveLength(1);
  db.prepare("DELETE FROM activity_records WHERE id LIKE 'target%'").run();
  for(let i=499;i<10001;i++)event(`before-${i}`,'2026-01-01T12:00:00.000Z');
  event('target','2026-01-02T00:00:00.000Z');
  expect(()=>life.start('diary',{day:'2026-01-02',timezone:'UTC',requestId:'scan-limit'})).toThrow('SOURCE_BUDGET_EXCEEDED');expect(prompts).toHaveLength(1);
 } finally { await life.close();db.close(); }
});

it.each([
 {timezone:'Asia/Shanghai',day:'2026-11-03',before:'2026-11-02T15:59:59.999Z',inside:['2026-11-02T16:00:00.000Z','2026-11-03T15:59:59.999Z'],after:'2026-11-03T16:00:00.000Z'},
 {timezone:'America/Los_Angeles',day:'2026-11-01',before:'2026-11-01T06:59:59.999Z',inside:['2026-11-01T07:00:00.000Z','2026-11-01T08:30:00.000Z','2026-11-01T09:30:00.000Z','2026-11-02T07:59:59.999Z'],after:'2026-11-02T08:00:00.000Z'}
])('uses actual $timezone midnight boundaries including repeated DST hours',async({timezone,day,before,inside,after})=>{
 const {db,life,event}=diaryFixture();
 try {
  event('before',before);inside.forEach((at,i)=>event(`inside-${i}`,at));event('after',after);
  const task=life.start('diary',{day,timezone,requestId:'timezone'});await new Promise(resolve=>setTimeout(resolve,0));
  expect(life.task(task.id).status).toBe('completed');expect(life.diaries()[0]!.sources.map(s=>s.id)).toEqual(inside.map((_,i)=>`inside-${i}`));
 } finally { await life.close();db.close(); }
});
