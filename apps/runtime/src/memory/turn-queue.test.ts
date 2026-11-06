import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { migrate, migrations, openDatabase, transaction } from '../storage/database.js';
import { MemoryTurnQueue } from './turn-queue.js';

function seed(db: DatabaseSync) {
  db.exec(`INSERT INTO models(id,config) VALUES('model','{}');
    INSERT INTO personas VALUES(1,'{}','now');
    INSERT INTO conversations VALUES('chat','test','model','now','owner','local-owner')`);
}
function message(db: DatabaseSync, id: string) {
  db.prepare(`INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author)
    VALUES(?,'chat','user',?,'completed','now',?,1,'local-owner')`).run(id, id, id);
}

it('resumes only queued turns after a shutdown, in order, without replaying old chats or duplicate deliveries', async () => {
  const root = mkdtempSync(join(tmpdir(),'bff-turn-queue-')), file = join(root,'data.sqlite');
  let db = new DatabaseSync(file);
  let queue: MemoryTurnQueue | undefined;
  try {
    migrate(db, migrations.slice(0,9));
    seed(db); message(db,'historical');
    db.close();
    db = openDatabase(file);
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    queue = new MemoryTurnQueue(db, { prepare: async (source,signal) => {
      expect(source.messageId).toBe('first'); start();
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), {once:true}));
      return () => { throw new Error('interrupted result applied'); };
    } }, () => {});
    for (const id of ['first','second','rolled-back']) message(db,id);
    transaction(db, () => { queue!.enqueue('first'); queue!.enqueue('first'); queue!.enqueue('second'); });
    expect(() => transaction(db, () => { queue!.enqueue('rolled-back'); throw new Error('rollback'); })).toThrow('rollback');
    await started;
    await queue.close(); db.close();
    db = openDatabase(file);
    expect(db.prepare('SELECT source_id,status,attempts FROM memory_turn_jobs ORDER BY seq').all()).toEqual(
      ['first','second'].map(source_id => ({source_id,status:'pending',attempts:0})));
    const committed: string[] = [];
    queue = new MemoryTurnQueue(db, { prepare: async source => {
      expect(source).toEqual({messageId:source.text,text:source.text,author:'local-owner'});
      return () => { committed.push(source.messageId); return true; };
    } }, () => {});
    await vi.waitFor(() => expect(committed).toEqual(['first','second']));
    queue.enqueue('first');
    expect(db.prepare("SELECT count(*) AS n FROM memory_turn_jobs WHERE status='done'").get()?.n).toBe(2);
    db.prepare('DELETE FROM messages WHERE id=?').run('first');
    expect(db.prepare('SELECT source_id FROM memory_turn_jobs').all()).toEqual([{source_id:'second'}]);
  } finally {
    await queue?.close();
    if (db.isOpen) db.close();
    rmSync(root,{recursive:true,force:true});
  }
});

it('rolls back partial writes, retries the head a bounded number of times, then continues to the next turn', async () => {
  vi.useFakeTimers();
  const db = openDatabase(':memory:');
  seed(db); message(db,'bad'); message(db,'next');
  const seen: string[] = [];
  const changed = vi.fn();
  const queue = new MemoryTurnQueue(db, { prepare: async source => () => {
    seen.push(source.messageId);
    db.prepare('INSERT INTO settings VALUES(?,?)').run(source.messageId,'commit');
    if (source.messageId === 'bad') throw new Error('provider error with private text');
    return true;
  } }, changed);
  try {
    queue.enqueue('bad'); queue.enqueue('next');
    await vi.advanceTimersByTimeAsync(10);
    expect(seen).toEqual(['bad']);
    expect(db.prepare("SELECT status,attempts FROM memory_turn_jobs WHERE source_id='bad'").get())
      .toEqual({status:'pending',attempts:1});
    expect(db.prepare("SELECT value FROM settings WHERE key='bad'").get()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(6000);
    expect(seen).toEqual(['bad','bad','bad','next']);
    expect(db.prepare('SELECT source_id,status,attempts,error FROM memory_turn_jobs ORDER BY seq').all()).toEqual([
      {source_id:'bad',status:'failed',attempts:3,error:'MEMORY_ANALYSIS_FAILED'},
      {source_id:'next',status:'done',attempts:0,error:null},
    ]);
    expect(changed).toHaveBeenCalledTimes(1);
  } finally { await queue.close(); db.close(); vi.useRealTimers(); }
});

it('preserves the actual completion when the queue insert fails, while propagating a failure of completion itself', async () => {
  const db = openDatabase(':memory:');
  seed(db); message(db,'delivered');
  const queue = new MemoryTurnQueue(db,{prepare:async () => () => false},() => {});
  try {
    db.exec("CREATE TRIGGER reject_job BEFORE INSERT ON memory_turn_jobs BEGIN SELECT RAISE(ABORT,'fixture'); END");
    queue.completeTurn('delivered',() => { db.prepare("INSERT INTO settings VALUES('delivery','sent')").run(); });
    expect(db.prepare("SELECT value FROM settings WHERE key='delivery'").get()?.value).toBe('sent');
    expect(db.prepare("SELECT event FROM audit").all()).toEqual([{event:'memory.enqueue.failed:delivered'}]);
    expect(db.prepare("SELECT count(*) AS n FROM memory_turn_jobs").get()?.n).toBe(0);
    expect(() => queue.completeTurn('delivered',() => { throw new Error('delivery state write failed'); }))
      .toThrow('delivery state write failed');
    expect(db.prepare("SELECT count(*) AS n FROM audit").get()?.n).toBe(1);
  } finally { await queue.close(); db.close(); }
});
