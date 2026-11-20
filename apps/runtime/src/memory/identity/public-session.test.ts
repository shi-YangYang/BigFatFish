import { expect, it, vi } from 'vitest';
import { openDatabase } from '../../storage/database.js';
import { NoteScope } from '../notes/note-scope.js';
import { PublicMemorySession, type DisclosedMemory } from './public-session.js';
import { MemoryStore } from '../store.js';
import { ConversationNotes } from '../notes/notes.js';

it('keeps the same engine session for new memories but revokes disclosed versions before delivery and on resume', () => {
  const db = openDatabase(':memory:');
  try {
    db.exec(`INSERT INTO models(id,config) VALUES('m','{}');
      INSERT INTO conversations(id,title,model_id,created_at,audience,principal) VALUES('c','','m','now','group','qq-user:3');
      INSERT INTO agent_sessions(conversation_id,engine_id) VALUES('c','legacy')`);
    const store = new MemoryStore(db), audience = {scopeKey:'qq:1:group:2',personKey:'qq:1:3'};
    const noteScope = new NoteScope(db,audience.scopeKey,false);
    const session = () => new PublicMemorySession(db,'c',noteScope,
      (m: DisclosedMemory) => store.canRecall(m.id,audience,m.version), false);
    const currentEngine = () => db.prepare("SELECT engine_id FROM agent_sessions WHERE conversation_id='c'").get()!.engine_id;
    const create = (subject: string) => store.create({kind:'fact',subject,content:subject,importance:3});
    const a = create('春游在北门集合'), shared = store.update(a.id,{version:a.version,visibility:'shared'});
    const before = session(), engine = currentEngine();
    before.observeMemories([shared]);
    const newMemory = create('集合时带上地图');
    store.update(newMemory.id,{version:newMemory.version,visibility:'shared'});
    expect(() => before.assertCurrent()).not.toThrow();
    const resumed = session();
    expect(currentEngine()).toBe(engine);
    store.update(shared.id,{version:shared.version,content:'改在南门集合'});
    expect(() => resumed.assertCurrent()).toThrow('MEMORY_SCOPE_CHANGED');
    const afterEdit = session(), next = currentEngine();
    expect(next).not.toBe(engine);
    const note = noteScope.append({id:'source',author:'qq-user:3'},'群内讨论','群内讨论');
    afterEdit.observe([note.id]);
    noteScope.remove(note.id);
    expect(() => afterEdit.assertCurrent()).toThrow('MEMORY_SCOPE_CHANGED');
    session();
    expect(currentEngine()).not.toBe(next);
  } finally { db.close(); }
});

it('guards the entire source before review; only an ordinary, grounded and still-authorized note can persist', async () => {
  const db = openDatabase(':memory:');
  try {
    const store = new MemoryStore(db), signal = new AbortController().signal;
    const review=vi.fn(async()=>false), notes=new ConversationNotes(db,undefined,review);
    const append=(text:string,guard=()=>{},book=notes,scope='qq:1:group:2')=>book.tools(scope,
      {id:'source',author:'qq-user:3',text},store,'group',guard).find(t=>t.name==='memory_append')!;
    const add=(text:string,excerpt:string)=>append(text).execute({content:excerpt,quote:excerpt},signal);
    for (const text of ['春游在北门。密码是一个秘密。','春游在北门。但不要记。']) {
      expect(await add(text,'春游在北门')).toEqual({saved:false});
    }
    await expect(add('春游在北门。','并不在原文')).rejects.toThrow('INVALID_MEMORY_SOURCE');
    await expect(append('北门',()=>{},notes,'qq:1:private:4').execute({content:'北门',quote:'北门'},signal)).rejects.toThrow('INVALID_MEMORY_SOURCE');
    expect(review).not.toHaveBeenCalled();
    for (const [text,excerpt] of [['我喜欢乌龙茶。','喜欢乌龙茶'],['她说自己23岁。','23岁'],['假如春游在北门呢？','春游在北门']]){
      expect(await add(text!,excerpt!)).toEqual({saved:false});
    }
    expect(review).toHaveBeenCalledTimes(3);
    review.mockRejectedValueOnce(new Error('review unavailable'));
    expect(await add('群里讨论了活动的标题','活动的标题')).toEqual({saved:false});
    expect(await append('群内笔记',()=>{},new ConversationNotes(db)).execute({content:'群内笔记',quote:'群内笔记'},signal)).toEqual({saved:false});
    let permitted=true;
    review.mockImplementationOnce(async()=>{permitted=false;return true;});
    await expect(append('北门',()=>{if(!permitted)throw Error('SCOPE_REVOKED');}).execute({content:'北门',quote:'北门'},signal)).rejects.toThrow('SCOPE_REVOKED');
    expect(db.prepare('SELECT * FROM conversation_notes').all()).toEqual([]);
  } finally { db.close(); }
});
