import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { exportArchive, restoreArchive } from '../maintenance/archive.js';
import { paths, preparePaths } from '../paths.js';
import { migrate, migrations, openDatabase } from '../storage/database.js';
import { MemoryStore } from './store.js';
import type { MemoryAttribution } from './types.js';

const owner = {role:'owner',personKey:'owner',scopeKey:'owner'} as const;
const group = 'qq:10001:group:30003';
const peer = {role:'other',personKey:'qq:10001:20002',scopeKey:group} as const;
function add(store: MemoryStore, subject: string, content: string, actor: MemoryAttribution=owner, kind='experience') {
  return store.insert({kind,subject,content,importance:3,sources:[{type:'user',id:randomUUID(),quote:content}]},'confirmed',actor);
}

it('consolidates separate facts under a named event, retains provenance and distinguishes similarly named activities',()=>{
  const db=openDatabase(':memory:'), store=new MemoryStore(db);
  try {
    const location=add(store,'集合地点','栖霞夏令营的集合地点是东门');
    const preference=add(store,'主人对栖霞夏令营的喜好','主人喜欢栖霞夏令营',owner,'preference');
    const gear=add(store,'行李','我为鹭岛夏令营准备了望远镜');
    const first=store.scenes({},'owner');
    expect(first.map(s=>s.title)).toEqual(['栖霞夏令营']);
    expect(first[0]!.members.map(m=>m.id).sort()).toEqual([location.id,preference.id].sort());
    expect(store.scenes({memoryId:store.profileEntries()[0]!.memoryId})[0]!.id).toBe(first[0]!.id);
    const travel=add(store,'交通','鹭岛夏令营的车票已经订好');
    expect(store.scenes({query:'鹭岛夏令营'},'owner')[0]!.members.map(m=>m.id).sort()).toEqual([gear.id,travel.id].sort());
    const changed=store.update(location.id,{version:location.version,content:'栖霞夏令营的集合地点改成北门'});
    const scene=store.scenes({id:first[0]!.id},'owner')[0]!;
    expect(scene.summary).toContain('北门'); expect(scene.summary).not.toContain('东门');
    expect(store.get(scene.members.find(m=>m.id===location.id)!.id).sources.some(s=>s.quote.includes('东门'))).toBe(true);
    store.delete(location.id,{version:changed.version});
    expect(store.scenes({memoryId:preference.id})).toEqual([]);
    expect(store.scenes().map(s=>s.title)).toEqual(['鹭岛夏令营']);
  } finally {db.close();}
});

it('matches an explicit subject across different subjects without a catalogued activity name',()=>{
  const db=openDatabase(':memory:'),store=new MemoryStore(db);
  try {
    add(store,'风筝','我把风筝交给小林保管');
    add(store,'仓库','风筝现在存放在旧厂房的仓库');
    const found=store.scenes({query:'上次说的风筝怎么样了'},'owner');
    expect(found[0]).toMatchObject({title:'风筝'});
    expect(found[0]!.summary).toMatch(/小林/); expect(found[0]!.summary).toMatch(/旧厂房/);
  } finally {db.close();}
});

it('keeps every contributing fact in its audience through sharing, rejection, merge and deletion',()=>{
  const db=openDatabase(':memory:'),store=new MemoryStore(db);
  try {
    const a=add(store,'地点','海岛露营的集合地点是码头',{...owner,scopeKey:group});
    const b=add(store,'装备','海岛露营的帐篷由我负责',peer);
    const c=add(store,'交通','海岛露营的车票由我预订',owner);
    store.update(c.id,{version:c.version,visibility:'shared'});
    const inGroup=store.scenes({},peer);
    expect(inGroup[0]).toMatchObject({title:'海岛露营',role:'general',scopeKey:group});
    expect(inGroup[0]!.members.map(m=>m.id).sort()).toEqual([a.id,b.id].sort());
    expect(store.scenes({},'owner')).toEqual([]);
    expect(store.scenes({query:'之前的约定'},'owner',[a.id])).toEqual([]);
    expect(store.scenes({query:'之前的约定'},peer,[a.id]).map(s=>s.id)).toEqual([inGroup[0]!.id]);
    expect(store.scenes({},{...peer,scopeKey:'qq:10001:group:99999'})).toEqual([]);
    const d=add(store,'帐篷','海岛露营的防雨帐篷由我负责',peer);
    store.merge(d.id,{version:d.version,otherId:b.id,otherVersion:b.version});
    const afterMerge=store.scenes({memoryId:d.id},peer)[0]!;
    expect(afterMerge.members.map(m=>m.id)).not.toContain(b.id);
    store.update(d.id,{version:store.get(d.id).version,status:'rejected'});
    expect(store.scenes({},peer)).toEqual([]);
  } finally {db.close();}
});

it('migrates confirmed facts without enqueuing history and rebuilds a logical backup into the same scene',async()=>{
  const root=mkdtempSync(join(tmpdir(),'bff-scenes-'));
  try {
    const old=paths(join(root,'old'));preparePaths(old);
    let db=new DatabaseSync(old.database);
    migrate(db,migrations.slice(0,11));
    for (const [id,subject,content,status] of [
      ['a','地点','山谷音乐节的舞台在河边','confirmed'],['b','行程','我去山谷音乐节的车票已经订好','confirmed'],['c','猜测','山谷音乐节的嘉宾可能明天到','candidate'],
    ]) {
      db.prepare(`INSERT INTO memories(id,kind,subject,content,normalized,importance,status,created_at,updated_at,actor_role,person_key,scope_key)
        VALUES(?,'experience',?,?,?,3,?,'2026-01-01','2026-01-01','owner','owner','owner')`).run(id!,subject!,content!,content!,status!);
      db.prepare("INSERT INTO memory_links(memory_id,source_type,source_id,quote) VALUES(?,'user',?,?)").run(id!,id!,content!);
    }
    db.close(); db=openDatabase(old.database);
    const before=new MemoryStore(db).scenes();
    expect(before).toHaveLength(1);expect(before[0]!.members.map(m=>m.id).sort()).toEqual(['a','b']);
    expect(db.prepare('SELECT count(*) AS n FROM memory_turn_jobs').get()?.n).toBe(0);
    db.close();
    const backup=join(root,'saved.json'),dest=paths(join(root,'restored'));
    await exportArchive(old,backup,{scopes:['memories']}); await restoreArchive(dest,backup);
    db=openDatabase(dest.database);
    try { expect(new MemoryStore(db).scenes()).toEqual(before); } finally {db.close();}
  } finally {rmSync(root,{recursive:true,force:true});}
});

it('keeps a grounded reference with the preceding topic and an automatic rescheduling with its own original event', async()=>{
  const root=mkdtempSync(join(tmpdir(),'bff-scene-anaphora-'));
  const home=paths(join(root,'home'));preparePaths(home);
  const db=openDatabase(home.database),store=new MemoryStore(db);
  try {
    db.exec("INSERT INTO models VALUES('chat','{}',NULL); INSERT INTO personas VALUES(1,'{}','now'); INSERT INTO conversations VALUES('c','test','chat','now','owner','local-owner')");
    const insert=db.prepare(`INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version,author)
      VALUES(?,'c',?,?,'completed','2026-11-07T12:00:00Z',?,1,?)`);
    function msg(text:string) {
      const id=randomUUID();insert.run(id,'user',text,id,'local-owner');insert.run(randomUUID(),'assistant','好',id,'fish');
      return {type:'message',id,quote:text};
    }
    const fact=(subject:string, text:string)=>store.insert({kind:'experience',subject,content:text,importance:4,sources:[msg(text)]},'confirmed',owner);
    const camp=fact('营地','我已经订好了海岛露营的白沙湾营地。');
    const tent=fact('帐篷','这次的帐篷我已经订好了。');
    const trip=fact('旅行','我下周六要去海岛露营旅行。');
    const revised=msg('我的旅行改到周日了。');
    // The learning worker updates the fact in place before inserting the new evidence.
    store.transaction(()=>{
      db.prepare('UPDATE memories SET content=?,normalized=? WHERE id=?').run(revised.quote,'我的旅行改到周日了',trip.id);
      store.insert({kind:'experience',subject:'旅行',content:revised.quote,importance:4,sources:[revised]},'confirmed',owner);
    });
    const scene=store.scenes({memoryId:tent.id},'owner')[0]!;
    expect(scene.title).toBe('海岛露营');
    expect(scene.members.map(m=>m.id).sort()).toEqual([camp,tent,trip].map(m=>m.id).sort());
    expect(scene.summary).toMatch(/白沙湾/);expect(scene.summary).toContain('周日');expect(scene.summary).not.toContain('周六');
    expect(scene.summary).toContain('变更');
    fact('茶','我喜欢桂花茶。');
    fact('集合','我约好参加栖霞夏令营。');
    const other=fact('营地','我约好参加鹭岛夏令营。');
    const ambiguous=fact('讲座','这次的讲座我已经报名了。');
    expect(store.scenes({memoryId:ambiguous.id})).toEqual([]);
    store.delete(other.id,{version:other.version});
    const file=join(root,'memories.json'),dest=paths(join(root,'restore'));
    await exportArchive(home,file,{scopes:['memories']}); await restoreArchive(dest,file);
    const restored=openDatabase(dest.database);
    try {expect(new MemoryStore(restored).scenes({memoryId:tent.id})[0]?.id).toBe(scene.id);} finally {restored.close();}
    const moved=store.update(camp.id,{version:camp.version,content:'松林徒步的集合地点是北门'});
    expect(store.scenes({memoryId:tent.id})).toEqual([]);
    expect(store.scenes({memoryId:camp.id}).map(s=>s.title)).not.toContain('海岛露营');
    store.delete(camp.id,{version:moved.version});
    expect(store.scenes({memoryId:tent.id})).toEqual([]);
  } finally { db.close();rmSync(root,{recursive:true,force:true}); }
});
