import { expect, it } from 'vitest';
import { openDatabase } from '../storage/database.js';
import { NoteScope } from './note-scope.js';
import { PublicMemorySession, type DisclosedMemory } from './public-session.js';
import { MemoryStore } from './store.js';
import { ConversationNotes } from './notes.js';

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

it('does not let a note duplicate an auto-saved statement or extract an innocent excerpt from a sensitive or refused turn', async () => {
  const db = openDatabase(':memory:');
  try {
    const store = new MemoryStore(db), notes = new ConversationNotes(db), signal = new AbortController().signal;
    for (const [text, excerpt] of [
      ['我喜欢乌龙茶。','喜欢乌龙茶'], ['春游在北门。密码是一个秘密。','春游在北门'], ['春游在北门。但不要记。','春游在北门'],
    ] as const) {
      const tool = notes.tools('qq:1:group:2',{id:'source',author:'qq-user:3',text},store,'group',() => {})
        .find(t => t.name === 'memory_append')!;
      expect(await tool.execute({content:excerpt,quote:excerpt},signal)).toEqual({saved:false});
    }
    expect(db.prepare('SELECT * FROM conversation_notes').all()).toEqual([]);
  } finally { db.close(); }
});
