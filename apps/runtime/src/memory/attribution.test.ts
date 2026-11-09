import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { paths, preparePaths } from '../paths.js';
import { migrate, migrations, openDatabase } from '../storage/database.js';
import { exportArchive, restoreArchive } from '../maintenance/archive.js';
import { MemoryStore } from './store.js';
import type { MemoryAttribution } from './types.js';

const owner: MemoryAttribution = {role:'owner',personKey:'owner',scopeKey:'owner'};
const group = {scopeKey:'qq:1:group:100'};
const peer = {role:'other',personKey:'qq:1:2',scopeKey:'qq:1:private:2'} as const;
const tea = {kind:'preference',subject:'饮茶',content:'我喜欢喝茶',importance:4,sources:[{type:'user',id:'source',quote:'我喜欢喝茶'}]};

it('scopes identity, exact and semantic selection, conflicts, merges and shared-session guards', () => {
  const db=openDatabase(':memory:'), store=new MemoryStore(db);
  try {
    const mine=store.insert(tea,'confirmed',owner), friend=store.insert(tea,'confirmed',peer);
    const publicOwner=store.insert(tea,'confirmed',{...owner,...group});
    const publicFriend=store.insert(tea,'confirmed',{...peer,...group});
    const elsewhere=store.insert(tea,'confirmed',{...peer,scopeKey:'qq:1:group:200'});
    const ids=[mine,friend,publicOwner,publicFriend,elsewhere].map(m=>m.id);
    expect(new Set(ids).size).toBe(5);
    for (const query of ['茶','完全不同的词']) {
      const read=(audience: Parameters<MemoryStore['retrieve']>[3])=>store.retrieve(query,8000,8,audience,ids).map(m=>m.id);
      expect(new Set(read('owner'))).toEqual(new Set([mine.id,publicOwner.id]));
      expect(read(peer)).toEqual([friend.id]);
      expect(new Set(read(group))).toEqual(new Set([publicFriend.id,publicOwner.id]));
      expect(read({scopeKey:'qq:1:private:2',personKey:'qq:1:3'})).toEqual([]);
    }
    expect(store.profile().map(m=>m.id)).not.toContain(friend.id);
    expect(store.list({role:'other'}).every(m=>m.role==='other')).toBe(true);
    expect(()=>store.update(friend.id,{version:friend.version,visibility:'shared'})).toThrow('INVALID_MEMORY');
    expect(()=>store.merge(mine.id,{version:mine.version,otherId:friend.id,otherVersion:friend.version})).toThrow('INVALID_MEMORY');
    const changed=store.update(friend.id,{version:friend.version,content:'我喜欢绿茶'});
    expect(store.canRecall(changed.id,peer,friend.version)).toBe(false);
    expect(store.canRecall(changed.id,peer,changed.version)).toBe(true);
    expect(store.get(mine.id).conflicts).not.toContain(friend.id);
  } finally { db.close(); }
});

it('classifies a v8 database only from historical evidence and keeps unresolved or mixed statements private', () => {
  const db = new DatabaseSync(':memory:'); migrate(db,migrations.slice(0,8));
  try {
    const memory=db.prepare("INSERT INTO memories (id,kind,subject,content,normalized,importance,status,created_at,updated_at,visibility) VALUES(?, 'fact',?,'喝茶','喝茶',2,'candidate','now','now','shared')");
    const link=db.prepare('INSERT INTO memory_links VALUES(?,?,?,?)');
    db.exec("INSERT INTO models VALUES('test','{}',NULL); INSERT INTO personas VALUES(1,'{}','now')");
    const conversation=db.prepare("INSERT INTO conversations VALUES(?, '题', 'test', 'now', ?, ?)");
    conversation.run('desktop','owner','local-owner'); conversation.run('group','group','qq-user:42');
    db.prepare("INSERT INTO channel_sessions VALUES('1:old-revision:group:100:42','group')").run();
    const message=db.prepare("INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author) VALUES(?,?,'user','喝茶','completed','now','1',1,?)");
    message.run('m1','desktop','local-owner'); message.run('m2','group','qq-user:42');
    for(const [id,subject] of [['owner','饮品'],['friend','饮品'],['orphan','qquser42饮品'],['manual','鱼的兴趣'],['mixed','饮品']]) memory.run(id!,subject!);
    for(const [id,src] of [['owner','m1'],['friend','m2'],['mixed','m1'],['mixed','m2'],['orphan','lost']]) link.run(id!,'message',src!,'喝茶');
    link.run('manual','user','typed','喝茶');
    migrate(db);
    const store=new MemoryStore(db);
    expect(store.get('owner')).toMatchObject({...owner,status:'candidate'});
    expect(store.get('friend')).toMatchObject({role:'other',personKey:'qq:1:42',...group,visibility:'private'});
    expect(store.get('manual').role).toBe('general');
    for(const id of ['orphan','mixed']) expect(store.get(id)).toMatchObject({role:'unassigned',visibility:'private'});
  } finally { db.close(); }
});

it('restores v9 attribution in memory-only backups and reads v8 memory rows without assigning missing message authors to the owner', async () => {
  const root=mkdtempSync(join(tmpdir(),'bff-role-archive-'));
  try {
    const p=paths(join(root,'source'));preparePaths(p);
    const db=openDatabase(p.database),store=new MemoryStore(db);
    const friend=store.insert(tea,'confirmed',peer);
    const missing=store.create({...tea,subject:'旧资料'});
    db.prepare("UPDATE memory_links SET source_type='message',source_id='lost' WHERE memory_id=?").run(missing.id);
    db.close();
    const fresh=join(root,'fresh');await exportArchive(p,fresh,{scopes:['memories']});
    const restored=paths(join(root,'fresh-target'));await restoreArchive(restored,fresh);
    const db9=openDatabase(restored.database);
    expect(new MemoryStore(db9).get(friend.id)).toMatchObject(peer);
    db9.close();
    const envelope=JSON.parse(readFileSync(fresh,'utf8'));const payload=JSON.parse(Buffer.from(envelope.files[0].content,'base64').toString());
    payload.schema=8;
    for(const row of payload.tables.memory_links) { delete row.asserted_at; delete row.speaker_verified; }
    for(const row of payload.tables.memories){delete row.actor_role;delete row.person_key;delete row.scope_key;}
    const bytes=Buffer.from(JSON.stringify(payload));
    envelope.files[0]={path:'data.json',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')};
    const old=join(root,'old');writeFileSync(old,JSON.stringify(envelope));const to=paths(join(root,'old-target'));
    await restoreArchive(to,old);const db8=openDatabase(to.database);
    expect(new MemoryStore(db8).get(missing.id)).toMatchObject({role:'unassigned',visibility:'private'});db8.close();
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('resolves owner names and tastes by the newest statement across rooms but preserves each room’s original fact', () => {
  const db=openDatabase(':memory:'), store=new MemoryStore(db);
  try {
    db.exec("INSERT INTO models VALUES('test','{}',NULL); INSERT INTO personas VALUES(1,'{}','now')");
    const room=db.prepare("INSERT INTO conversations VALUES(?, '题', 'test', 'now', ?, ?)");
    room.run('desk','owner','local-owner'); room.run('group','group','qq-user:42');
    const write=db.prepare("INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author) VALUES(?,?,?,?,'completed',?,?,1,?)");
    for(const [subject,first,latest,kind] of [
      ['主人的称呼','以后叫我阿蓝','改叫我阿洋','preference'],
      ['主人的名字','我叫小林','我叫小周','fact'],
      ['主人对香菜的喜好','我喜欢香菜','我不喜欢香菜','preference']
    ] as const) {
      function record(original:boolean) {
        const [id,conv,author,at,text]=original
          ? [first,'group','qq-user:42','2025-01-01',first] as const
          : [latest,'desk','local-owner','2025-01-02',latest] as const;
        write.run(id,conv,'user',text,at,id,author);write.run(id+'-reply',conv,'assistant','知道了',at,id,'assistant');
        return store.insert({kind,subject,content:text,importance:4,sources:[{type:'message',id,quote:text}]},'confirmed',original?{...owner,...group}:owner);
      }
      // Simulate late processing of yesterday's public statement and a later edit in management.
      const current=record(false),old=record(true);store.update(old.id,{version:old.version,importance:5});
      expect(store.profile().map(m=>m.id)).toContain(current.id);
      expect(store.profile().map(m=>m.id)).not.toContain(old.id);
      expect(store.retrieve(first,8000,8,'owner',[old.id]).map(m=>m.id)).not.toContain(old.id);
      expect(store.retrieve(first,8000,8,group,[old.id,current.id]).map(m=>m.id)).toContain(old.id);
      expect(store.canRecall(current.id,group)).toBe(false);
    }
  } finally {db.close();}
});
