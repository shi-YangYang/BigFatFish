import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import type { EngineInput } from '../ai/engine.js';
import { defaultPersona } from '../ai/persona-presets.js';
import { openDatabase } from '../storage/database.js';
import { MemoryStore } from './store.js';
import { MemoryTurnAnalyzer } from './turn-analysis.js';
import type { SourceTurn } from './personal-learning.js';

const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function fixture(output: (input: EngineInput) => unknown) {
  const db = openDatabase(':memory:');
  databases.push(db);
  db.exec("INSERT INTO models(id,config) VALUES('chat','{}'); INSERT INTO personas VALUES(1,'{}','now')");
  const conversation = (principal='local-owner',audience='owner') => {
    const id = randomUUID();
    db.prepare("INSERT INTO conversations VALUES(?,'test','chat','now',?,?)").run(id,audience,principal);
    return id;
  };
  const local = conversation();
  const turn = (text: string, reply = '收到', room: string = local, receipt = true, author = 'local-owner') => {
    const messageId = randomUUID(), request = randomUUID();
    const insert = db.prepare(`INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author)
      VALUES(?,?,?,?,'completed','2026-11-06T09:00:00Z',?,1,?)`);
    insert.run(messageId,room,'user',text,request,author);
    insert.run(randomUUID(),room,'assistant',reply,request,'fish');
    if (receipt) db.prepare("INSERT INTO memory_turn_jobs(source_id) VALUES(?)").run(messageId);
    return {messageId,text,author};
  };
  const run = vi.fn(async (input: EngineInput) => JSON.stringify(output(input)));
  const query = vi.fn(async () => undefined);
  const store = new MemoryStore(db);
  const config = {routes:() => ({chat:'chat'}),persona:() => defaultPersona,model:() => ({
    key:'fixture',config:{id:'chat',label:'chat',model:'chat',provider:'openai' as const,baseURL:'https://invalid.test'},
  })};
  const analyzer = new MemoryTurnAnalyzer(db,store,{query,memoryIds:() => []},config,{run});
  const signal = new AbortController().signal;
  const save = async (source: SourceTurn) => store.transaction(await analyzer.prepare(source,signal));
  return { db, turn, run, query, save, store, local, conversation, analyzer, signal };
}
const correction = {items:[{quote:'改到周三了。',topic:'复诊',kind:'experience'}]};

it('separates settled facts from speculative sentences, rejects fabricated substrings and excludes unsafe turns', async () => {
  const {turn,save,run,store} = fixture(() => ({items:[
    {quote:'我养了一只叫栗子的猫。',topic:'猫',kind:'fact'},
    {quote:'我养了一只叫栗子的狗。',topic:'狗',kind:'fact'},
    {quote:'我周末要去面试',topic:'面试',kind:'experience'},
  ]}));
  const source = turn('我喜欢乌龙茶。我养了一只叫栗子的猫。我要不要周末去面试还没想好。');
  await save(source);
  expect(store.list().map(m => m.content).sort()).toEqual(['主人喜欢乌龙茶','我养了一只叫栗子的猫。'].sort());
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0]![0]).toMatchObject({ephemeral:true,resume:false});
  expect(run.mock.calls[0]![0].tools).toBeUndefined();
  expect(run.mock.calls[0]![0].prompt).not.toContain('周末去面试');
  for (const text of ['我朋友说：“我养了一只叫栗子的猫。”','别记。我养了一只叫栗子的猫。',
    '我的密码是1234。我养了一只叫栗子的猫。','如果我周三有空，我喜欢和你散步。',
    '我喜欢果茶。才怪！','我今天点了杯奶茶']) await save(turn(text));
  expect(store.list()).toHaveLength(2);
  expect(run).toHaveBeenCalledTimes(1);
});

it.each(['周一复诊。','复诊还是周一吗？'])('uses one prior grounded appointment to resolve a date correction (%s)', async focus => {
  const {turn,save,store,run,query} = fixture(() => correction);
  await save(turn('我下周一复诊。'));
  if (focus.endsWith('？')) turn('对了。',focus);
  else turn(focus);
  const amended = turn('改到周三了。');
  await save(amended);
  const records = store.list();
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({subject:'复诊',content:'复诊：改到周三了。'});
  expect(records[0]!.sources).toContainEqual({type:'message',author:'local-owner',id:amended.messageId,quote:amended.text});
  expect(query).not.toHaveBeenCalled(); // Named appointment targets use an exact scoped lookup.
  expect(run).toHaveBeenCalledTimes(1);
});

it('does not guess between two events or turn a suggestion into a new fact', async () => {
  const {turn,save,store,conversation} = fixture(() => correction);
  await save(turn('我下周一复诊。'));
  await save(turn('我下周一面试。'));
  turn('复诊和面试都约在周一。');
  await save(turn('改到周三了。'));
  const separate = conversation();
  turn('我今天吃了火锅。','你朋友的复诊是周一吗？',separate);
  await save(turn('改到周三了。','收到',separate));
  expect(store.list().map(m => m.content).join(' ')).not.toContain('周三');
  const independent = fixture(() => correction);
  independent.turn('你忙吗？','复诊还是周一吗？');
  await independent.save(independent.turn('改到周三了。'));
  expect(independent.store.list()).toHaveLength(0);
});

it('filters history by conversation, sender, delivery receipt, source time, and privacy before invoking the model', async () => {
  const {turn,save,run,conversation,local,store} = fixture(() => ({items:[]}));
  const other = conversation();
  turn('独立聊天的内容','别处',other);
  turn('未获准学习的录音','转写来源',local,false);
  turn('不是当前发言人的内容','错误来源',local,true,'qq-user:999');
  turn('不要记住这里有私人代码','好的');
  turn('我是工程师。','听起来不错');
  const current = turn('我养了一只黑猫。');
  turn('在当前消息之后才能看到的文字');
  await save(current);
  const prompt = run.mock.calls[0]![0].prompt;
  expect(prompt).toContain('我是工程师');
  for (const text of ['独立聊天','未获准学习','当前发言人的内容','私人代码','之后才能看到']) expect(prompt).not.toContain(text);
  expect(store.list()).toEqual([]);
});

it('compares natural paraphrases with scoped prior facts and does not add a duplicate', async () => {
  const {turn,save,run,store} = fixture(input => {
    if (input.prompt.includes('\ncompare\n')) return {decision:'duplicate',index:0};
    const first = '我养了一只叫栗子的猫。', second = '我养的小猫叫栗子。';
    const current = JSON.parse(input.prompt.split('\n').at(-1)!) as {current:string[]};
    return {items:[{quote:current.current.includes(first) ? first : second,topic:'栗子',kind:'fact'}]};
  });
  await save(turn('我养了一只叫栗子的猫。'));
  await save(turn('我养的小猫叫栗子。'));
  expect(store.list()).toHaveLength(1);
  expect(run.mock.calls.map(([input])=>input.prompt.split('\n')[1])).toEqual(['extract','extract','compare']);
});

it('understands an implied personal habit in private chat and declines a question or an ambiguous group habit', async () => {
  const quote = '以后奶茶都喝三分糖。';
  const {turn,save,run,store,conversation,db} = fixture(() => ({items:[{kind:'preference',topic:'奶茶',quote}]}));
  const group = conversation('qq-user:222','group');
  const config = {url:'ws://127.0.0.1:1234',accountId:'333',ownerId:'111',friendIds:[],groups:['77'],enabled:true,replyEnabled:true,proactiveEnabled:false};
  db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('qq',?,'v1')").run(JSON.stringify(config));
  db.prepare("INSERT INTO channel_sessions VALUES('333:v1:group:77:222',?)").run(group);
  await save(turn(quote));
  await save(turn('以后奶茶都喝三分糖吗？'));
  await save(turn(quote,'收到',group,true,'qq-user:222'));
  expect(run).toHaveBeenCalledTimes(1);
  expect(store.list().map(m => [m.role,m.content])).toEqual([['owner',quote]]);
});

function ownerGroups(f: ReturnType<typeof fixture>) {
  const config = {url:'ws://127.0.0.1:1234',accountId:'333',ownerId:'111',friendIds:[],groups:['77','88'],
    enabled:true,replyEnabled:true,proactiveEnabled:false};
  f.db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('qq',?,'v1')").run(JSON.stringify(config));
  const senders = new Map(config.groups.map(group => {
    const conversation = f.conversation('qq-user:111','group');
    f.db.prepare('INSERT INTO channel_sessions VALUES(?,?)').run('333:v1:group:'+group+':111',conversation);
    return [group,conversation] as const;
  }));
  return (group: string, quote: string) => f.turn(quote,'收到',senders.get(group)!,true,'qq-user:111');
}

it('reschedules a single public appointment privately and follows later corrections in the originating room', async () => {
  const f = fixture(() => ({items:[]}));
  const groupTurn = ownerGroups(f);
  const appointments = (group?: string) => f.store.retrieve('复诊',8000,8,group ? {scopeKey:'qq:333:group:'+group} : 'owner');
  const original = groupTurn('77','我下周一约好了复诊。');
  await f.save(original);
  const correction = f.turn('我的复诊改到周三了。');
  await f.save(correction);
  expect(appointments().map(m=>m.content)).toEqual([expect.stringContaining('周三')]);
  expect(appointments()[0]!.sources.map(s=>s.id).sort()).toEqual([original.messageId,correction.messageId].sort());
  expect(appointments('77').map(m=>m.content)).toEqual([expect.stringContaining('周一')]);
  expect(appointments('88')).toHaveLength(0);
  await f.save(groupTurn('77','我的复诊改到周五了。'));
  expect(appointments().map(m=>m.content)).toEqual([expect.stringContaining('周五')]);
  await f.save(f.turn('我的复诊改到周六了。我喜欢乌龙茶。'));
  expect(appointments().map(m=>m.content)).toEqual([expect.stringContaining('周六')]);
  expect(appointments('77').map(m=>m.content)).toEqual([expect.stringContaining('周五')]);
  expect(appointments('77')[0]!.sources.map(s=>s.quote)).toEqual(['我的复诊改到周五了。',original.text]);
  expect(f.store.list().filter(m=>m.subject==='复诊')).toHaveLength(2);
  expect(f.run).not.toHaveBeenCalled();
});

it('preserves two independent public appointments on one topic when the owner does not identify which moved', async () => {
  const f = fixture(() => ({items:[]}));
  const groupTurn = ownerGroups(f);
  await f.save(groupTurn('77','我下周一约好了复诊。'));
  await f.save(groupTurn('88','我下周二约好了复诊。'));
  await f.save(f.turn('我的复诊改到周三了。我喜欢咖啡。'));
  expect(f.store.retrieve('复诊').map(m=>m.content)).toEqual(expect.arrayContaining([
    expect.stringContaining('周一'),expect.stringContaining('周二')]));
  expect(f.store.list({query:'周三'})).toEqual([]);
  expect(f.store.list({query:'咖啡'})).toHaveLength(1);
});

it('keeps the final address and its own quote from a mixed turn, and accepts the next correction', async () => {
  const f = fixture(() => ({items:[]}));
  await f.save(f.turn('以后叫我小洋。我喜欢乌龙茶。以后叫我阿洋。'));
  const address = () => f.store.list({query:'主人的称呼'})[0]!;
  expect(address()).toMatchObject({content:'主人希望被称为阿洋',sources:[{quote:'以后叫我阿洋。'}]});
  await f.save(f.turn('以后叫我阿澈。'));
  expect(address().content).toBe('主人希望被称为阿澈');
  expect(address().sources.map(s=>s.quote)).toEqual(['以后叫我阿洋。','以后叫我阿澈。']);
  expect(f.store.list({query:'乌龙茶'})).toHaveLength(1);
  expect(f.run).not.toHaveBeenCalled();
});

it('drops a queued private correction if its public target was edited or deleted during analysis', async () => {
  const f = fixture(() => ({items:[]}));
  const groupTurn = ownerGroups(f);
  await f.save(groupTurn('77','我下周一约好了复诊。'));
  const pending = await f.analyzer.prepare(f.turn('我的复诊改到周三了。'),f.signal);
  const old = f.store.list()[0]!;
  const edited = f.store.update(old.id,{version:old.version,content:'手动记录的周一复诊'});
  expect(f.store.transaction(pending)).toBe(false);
  const next = await f.analyzer.prepare(f.turn('我的复诊改到周四了。'),f.signal);
  f.store.delete(edited.id,{version:edited.version});
  expect(f.store.transaction(next)).toBe(false);
  expect(f.store.list()).toHaveLength(0);
});

it('keeps scoped current demographic fields with dated evidence and follows management edits', async () => {
  const f=fixture(() => ({items:[]}));
  const groups=ownerGroups(f);
  const publicSource=groups('77','我是男生，今年23岁；我周六约好了体检。');
  await f.save(publicSource);
  const age = (audience: Parameters<MemoryStore['profileEntries']>[1]) =>
    f.store.profileEntries({personKey:'owner'},audience).find(e=>e.key==='age');
  expect(age('owner')).toMatchObject({value:'23 岁',asOf:'2026-11-06',source:{id:publicSource.messageId}});
  expect(f.store.profileEntries({personKey:'owner'},'owner').map(e=>[e.key,e.value]))
    .toEqual([['gender','男'],['age','23 岁']]);
  const change=f.turn('刚刚说错了，我今年24岁。我的体检改到周日了。');
  const instant = '2026-11-06T16:01:00Z';
  f.db.prepare('UPDATE messages SET created_at=? WHERE id=?').run(instant,change.messageId);
  await f.save(change);
  expect(age('owner')).toMatchObject({value:'24 岁',asOf:new Date(instant).toLocaleDateString('sv-SE'),source:{id:change.messageId}});
  expect(age({scopeKey:'qq:333:group:77'})).toMatchObject({value:'23 岁'});
  expect(age({scopeKey:'qq:333:group:88'})).toBeUndefined();
  const field = age('owner')!;
  const edit=f.store.update(field.memoryId,{version:field.version,content:'25岁'});
  expect(age('owner')).toMatchObject({value:'25 岁',source:{type:'user'}});
  await f.save(f.turn('我今年26岁'));
  expect(age('owner')?.value).toBe('25 岁');
  f.store.delete(edit.id,{version:edit.version});
  expect(f.store.profileEntries({scopeKey:'owner'})).toHaveLength(0);
});

it('recognizes short private introductions but never profiles questions, hypotheticals or other people', async () => {
  const f=fixture(() => ({items:[]}));
  for (const text of ['男，23岁？','我的同事是男生，今年23岁','如果我是女生，今年23岁。','不要记，男，23岁。',
    '我觉得他是男生，今年23岁。']) await f.save(f.turn(text));
  expect(f.store.profileEntries()).toHaveLength(0);
  await f.save(f.turn('男，23岁；我周六约好了体检。明天会下雨吗？','收到',f.conversation()));
  expect(f.store.profileEntries().map(e=>[e.key,e.value])).toEqual([['gender','男'],['age','23 岁']]);
});

it('requires a self-report before promoting age or gender from a conversation about someone else', async () => {
  const f=fixture(()=>({items:[]}));
  f.turn('我有个弟弟。','你弟弟今年多大了？');
  await f.save(f.turn('23岁。'));
  await f.save(f.turn('说一下我妹妹的情况。女，19岁。'));
  f.turn('是邻居家的狗。','它几岁了？');
  const answer=f.turn('3岁。');
  await f.save(answer);
  expect(f.store.profileEntries()).toEqual([]);
  expect(f.store.list().filter(m=>/年龄|性别/u.test(m.subject))).toEqual([]);
  // Older model-organized facts must pass the same provenance check when projected.
  f.store.insert({kind:'fact',subject:'年龄',content:'3岁。',importance:4,
    sources:[{type:'message',id:answer.messageId,quote:'3岁。'}]},'confirmed',{role:'owner',personKey:'owner',scopeKey:'owner'});
  expect(f.store.profileEntries()).toEqual([]);
  f.turn('再聊我弟弟。','他多大了？');
  await f.save(f.turn('我是男生，我今年24岁。'));
  expect(f.store.profileEntries().map(e=>e.value)).toEqual(['男','24 岁']);
});

it('excludes a request to ask about a relative while preserving an independent assertion', async () => {
  const request='下面聊聊我弟弟，你先问我他今年多大。';
  const f=fixture(()=>({items:[{quote:request,topic:'弟弟',kind:'fact'}]}));
  await f.save(f.turn(request+'我喜欢茉莉花茶。'));
  expect(f.store.list().map(m=>m.content)).toEqual(['主人喜欢茉莉花茶']);
  expect(f.run).not.toHaveBeenCalled();
});

it('remembers independently booked items and corrects the date of one grounded trip', async () => {
  const {turn,save,store,run,conversation} = fixture(() => ({items:[]}));
  await save(turn('我已经订好了海岛露营的白沙湾营地。'));
  const next = conversation();
  const send = (text: string) => save(turn(text,'收到',next));
  await send('我给这次海岛露营订好了双人帐篷。');
  await send('我下周六要去海岛露营旅行。');
  await send('我的旅行改到周日了。我喜欢茉莉花茶。');
  const facts = store.list({status:'confirmed'});
  expect(facts.map(m => m.subject).sort()).toEqual(['海岛露营的白沙湾营地','双人帐篷','旅行','主人对茉莉花茶的喜好'].sort());
  const trip = facts.find(m => m.subject === '旅行')!;
  expect(trip.content).toContain('改到周日');
  expect(trip.sources.map(s => s.quote)).toEqual(expect.arrayContaining(['我下周六要去海岛露营旅行。','我的旅行改到周日了。']));
  expect(run).not.toHaveBeenCalled();
});
