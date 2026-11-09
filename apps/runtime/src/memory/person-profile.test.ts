import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { exportArchive, restoreArchive } from '../maintenance/archive.js';
import { paths, preparePaths } from '../paths.js';
import { migrate, migrations, openDatabase } from '../storage/database.js';
import { MemoryStore } from './store.js';

it('rebuilds structured fields from a v10 confirmed self-report and retains the date in a memories-only restore', async () => {
  const root=mkdtempSync(join(tmpdir(),'bff-profile-'));
  try {
    const source=paths(join(root,'old'));
    preparePaths(source);
    const old=new DatabaseSync(source.database);
    migrate(old,migrations.slice(0,10));
    const text='男，23岁。';
    old.exec(`INSERT INTO models VALUES('test','{}',NULL);
      INSERT INTO personas VALUES(1,'{}','now');
      INSERT INTO conversations VALUES('c','聊天','test','2024-06-01','owner','local-owner')`);
    const msg=old.prepare(`INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author)
      VALUES(?,'c',?,?,'completed','2024-06-01T02:00:00Z','r',1,?)`);
    msg.run('u','user',text,'local-owner'); msg.run('a','assistant','你好','fish');
    old.prepare(`INSERT INTO memories(id,kind,subject,content,normalized,importance,status,created_at,updated_at,actor_role,person_key,scope_key)
      VALUES('m','fact','男生',?, ?,4,'confirmed','2024-06-02','2024-08-05','owner','owner','owner')`).run(text,text);
    old.prepare("INSERT INTO memory_links VALUES('m','message','u',?)").run(text);
    old.close();
    const migrated=openDatabase(source.database);
    const entries=new MemoryStore(migrated).profileEntries();
    expect(entries.map(({value,asOf})=>[value,asOf])).toEqual([['男','2024-06-01'],['23 岁','2024-06-01']]);
    expect(migrated.prepare('SELECT speaker_verified FROM memory_links').get()?.speaker_verified).toBe(1);
    expect(migrated.prepare('SELECT count(*) AS count FROM memory_turn_jobs').get()?.count).toBe(0);
    migrated.close();
    const file=join(root,'memories.json');
    await exportArchive(source,file,{scopes:['memories']});
    const dest=paths(join(root,'new'));
    await restoreArchive(dest,file);
    const db=openDatabase(dest.database);
    try {
      expect(db.prepare('SELECT count(*) AS count FROM messages').get()?.count).toBe(0);
      expect(new MemoryStore(db).profileEntries()).toEqual(entries);
    } finally {db.close();}
  } finally {rmSync(root,{recursive:true,force:true});}
});
