import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import { openDatabase } from '../storage/database.js';
import { MemoryStore } from './store.js';
import { selectStatement } from './natural-learning.js';
import { trustedSpeakerTurn } from './speaker.js';
import { PersonalLearning, type SourceTurn, type PreparedChange } from './personal-learning.js';

const databases: ReturnType<typeof openDatabase>[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture() {
  const db = openDatabase(':memory:'); databases.push(db);
  db.exec("INSERT INTO models(id,config) VALUES('fixture','{}'); INSERT INTO personas VALUES(1,'{}','now')");
  const memories = new MemoryStore(db), learning = new PersonalLearning(db,memories);
  function turn(text: string, author = 'local-owner', audience = 'owner', principal = author, status = 'completed') {
    const messageId = randomUUID(), conversationId = randomUUID();
    db.prepare("INSERT INTO conversations VALUES(?,'主人','fixture','now',?,?)").run(conversationId,audience,principal);
    const insert = db.prepare("INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author) VALUES(?,?,?,?,?,'now','request',1,?)");
    insert.run(messageId,conversationId,'user',text,'completed',author);
    insert.run(randomUUID(),conversationId,'assistant','收到',status,'fish');
    return { messageId, author, text, conversationId };
  }
  function commit(source: SourceTurn, changes: PreparedChange[]) {
    const speaker = trustedSpeakerTurn(db,source);
    return !!speaker && memories.transaction(() => learning.commit(source,speaker,changes));
  }
  function capture(source: SourceTurn) {
    const speaker = trustedSpeakerTurn(db,source);
    const statement = speaker && selectStatement(source.text,speaker,speaker.at);
    if (!statement || !commit(source,[{statement}])) return null;
    const row = db.prepare("SELECT memory_id FROM memory_links WHERE source_type='message' AND source_id=?").get(source.messageId);
    return memories.get(String(row!.memory_id));
  }
  return { db, memories, capture, commit, turn };
}

it('writes qualifying preferences automatically with their verified owner, and never revives rejected or deleted statements on replay', () => {
  const { capture, turn, memories } = fixture();
  const informal = turn('我喜欢乌龙茶。');
  const first = capture(informal)!;
  expect(first).toMatchObject({status:'confirmed',role:'owner',personKey:'owner',scopeKey:'owner'});
  expect(memories.retrieve('乌龙茶').map(x=>x.id)).toEqual([first.id]);
  const request = turn('请记住，我喜欢乌龙茶！');
  const saved = capture(request)!;
  expect(saved.id).toBe(first.id);
  expect(saved.sources.map(s=>s.quote)).toEqual([informal.text,request.text]);
  expect(capture(request)).toBeNull();
  memories.update(saved.id,{version:saved.version,status:'rejected'});
  expect(capture(turn('记住：我喜欢乌龙茶'))).toBeNull();
  expect(memories.retrieve('乌龙茶')).toEqual([]);
  const address = turn('以后叫我小洋');
  const remembered = capture(address)!;
  memories.delete(remembered.id, {version:remembered.version});
  expect(capture(address)).toBeNull();
  expect(memories.list({query:'小洋'})).toEqual([]);
});

it('corrects the address across turns, removes only same-source duplicate notes, and respects later manual edits/deletion', () => {
  const { db, capture, turn, memories } = fixture();
  const initial = turn('以后叫我爸爸');
  const related = turn('今天陪爸爸散了步');
  const correct = turn('以后叫我阿洋，不要叫爸爸。');
  const note = db.prepare("INSERT INTO conversation_notes VALUES(?,'local',?,'local-owner',?,?,'now')");
  note.run('keep',related.messageId,'散了步','散了步');
  note.run('remove',correct.messageId,'不要叫爸爸','不要叫爸爸');
  capture(initial);
  const saved = capture(correct)!;
  expect(saved.content).toContain('阿洋'); expect(saved.sources.map(s=>s.quote)).toEqual([initial.text,correct.text]);
  expect(memories.retrieve('爸爸')).toHaveLength(0);
  expect(db.prepare('SELECT id FROM conversation_notes').all()).toEqual([{id:'keep'}]);
  const edited = memories.update(saved.id,{version:saved.version,content:'主人希望被称为小洋'});
  expect(capture(correct)).toBeNull();
  expect(capture(turn('以后叫我小阳'))).toBeNull();
  memories.delete(edited.id,{version:edited.version});
  expect(memories.retrieve('小洋')).toHaveLength(0);
});

it('checks the current QQ owner and revision-scoped private session as well as sender and completed paired turn', () => {
  const { db, capture, turn, memories } = fixture();
  const config = { url:'ws://127.0.0.1:1234', accountId:'333', ownerId:'111', friendIds:['222'], groups:['77'], enabled:true, replyEnabled:true, proactiveEnabled:false };
  db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('qq',?,'v1')").run(JSON.stringify(config));
  const message = '以后叫我阿洋';
  expect(capture(turn(message,'qq-user:111','group'))).toBeNull();
  expect(capture(turn(message,'qq-owner:222'))).toBeNull();
  expect(capture(turn(message,'qq-owner:111','owner','local-owner'))).toBeNull();
  expect(capture(turn(message,'local-owner','owner','local-owner','failed'))).toBeNull();
  const qq = turn(message,'qq-owner:111');
  expect(capture(qq)).toBeNull();
  db.prepare("INSERT INTO channel_sessions VALUES('333:v1:private:111:111',?)").run(qq.conversationId);
  expect(capture({...qq,author:'local-owner'})).toBeNull();
  expect(capture({...qq,messageId:'missing'})).toBeNull();
  expect(capture(qq)?.sources).toEqual([{type:'message',id:qq.messageId,quote:message,author:'qq-owner:111'}]);
  db.prepare("UPDATE plugin_config SET revision='v2' WHERE id='qq'").run();
  expect(capture(qq)).toBeNull();
  db.prepare("UPDATE plugin_config SET revision='v1', config=? WHERE id='qq'").run(JSON.stringify({...config,ownerId:'222'}));
  expect(capture(qq)).toBeNull();
  expect(memories.list()).toHaveLength(1);
});

it('requires a complete single direct declaration and declines credentials, hypothetical, temporary and quoted facts', () => {
  const { capture, turn, memories } = fixture();
  const quoted = turn('例子是「我喜欢乌龙茶」');
  expect(capture({...quoted,text:'我喜欢乌龙茶'})).toBeNull();
  for (const text of ['我是你的主人', '假如以后叫我爸爸','请记住，我可能喜欢乌龙茶','我朋友喜欢乌龙茶','我喜欢的不是乌龙茶',
    '记住我的密码是abcde','记住：我喜欢 Token','请记住，今天我喜欢乌龙茶','视频里说我叫阿洋','“以后叫我爸爸”',
    '我喜欢乌龙茶吗','以后叫我去取快递','记住我喜欢乌龙茶。顺便告诉你我的密码是abcd','以后叫我爸爸，不要叫爸爸']) {
    expect(capture(turn(text)),text).toBeNull();
  }
  expect(memories.list()).toHaveLength(0);
});

it('applies multiple independent claims atomically, checks original quotes, and gives pending user edits priority', () => {
  const { capture, commit, memories, turn } = fixture();
  const first = capture(turn('以后叫我阿洋'))!;
  const mixed = turn('以后叫我小鲸。我喜欢乌龙茶。');
  const speaker = {role:'owner', scopeKey:'owner'} as const;
  const alias = selectStatement('以后叫我小鲸。',speaker,'now')!;
  const tea = selectStatement('我喜欢乌龙茶。',speaker,'now')!;
  const invented = selectStatement('我喜欢咖啡。',speaker,'now')!;
  memories.delete(first.id,{version:first.version});
  expect(commit(mixed,[{statement:alias},{statement:tea},{statement:invented}])).toBe(true);
  expect(memories.list().map(m=>[m.content,m.sources[0]?.quote])).toEqual([['主人喜欢乌龙茶','我喜欢乌龙茶。']]);

  const mixed2 = turn('以后叫我小鲸。我喜欢红茶。');
  const red = selectStatement('我喜欢红茶。',speaker,'now')!;
  expect(commit(mixed2,[{statement:alias},{statement:red}])).toBe(true);
  expect(memories.list().filter(m=>m.sources.some(s=>s.id === mixed2.messageId))).toHaveLength(2);
});

it('keeps a private correction out of the originating group, while the owner recalls the current arrangement', () => {
  const { db, capture, commit, memories, turn } = fixture();
  const config = { url:'ws://127.0.0.1:1234', accountId:'333', ownerId:'111', friendIds:[], groups:['77'], enabled:true, replyEnabled:true, proactiveEnabled:false };
  db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('qq',?,'v1')").run(JSON.stringify(config));
  const group = turn('我下周一约好了复诊。','qq-user:111','group');
  db.prepare("INSERT INTO channel_sessions VALUES('333:v1:group:77:111',?)").run(group.conversationId);
  const appointment = capture(group)!;
  const correction = turn('改到周三了。');
  const target = {id:appointment.id, version:appointment.version};
  const statement = {kind:'experience', subject:'复诊', content:'复诊：改到周三了。', quote:correction.text, replaces:true} as const;
  expect(commit(correction,[{statement,target}])).toBe(true);
  const current = memories.retrieve('复诊');
  expect(current.map(m=>m.content)).toEqual([statement.content]);
  expect(current[0]!.sources.map(s=>s.id).sort()).toEqual([group.messageId,correction.messageId].sort());
  expect(memories.retrieve('复诊',4000,8,{scopeKey:'qq:333:group:77'}).map(m=>m.content)).toEqual([appointment.content]);

  db.prepare("INSERT INTO plugin_config(id,config,revision) VALUES('sdk:qq',?,'v2')").run(JSON.stringify({enabled:false,installed:true}));
  expect(trustedSpeakerTurn(db,group)).toBeNull();
});
