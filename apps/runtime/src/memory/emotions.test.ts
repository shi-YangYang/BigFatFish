import {expect,it} from 'vitest';
import {openDatabase} from '../storage/database.js';
import {defaultPersona} from '../ai/configuration.js';
import type {Configuration} from '../ai/configuration.js';
import {EmotionalLife,fadedMood} from './emotions.js';
import {AutomaticDiary,dueDiaryDay} from './diary-auto.js';
import type {MemoryTask} from './types.js';

const config={routes:()=>({chat:'model'}),model:()=>({config:{id:'model',model:'fixture',provider:'openai',baseURL:'http://127.0.0.1'},key:''}),persona:()=>defaultPersona} as unknown as Configuration;
const wait=async(predicate:()=>boolean)=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,5));expect(predicate()).toBe(true);};
function seed(db:ReturnType<typeof openDatabase>,id:string,text:string,at=new Date().toISOString(),conversation='local'){
 db.prepare("INSERT OR IGNORE INTO models VALUES('model','{}',NULL)").run();db.prepare("INSERT OR IGNORE INTO personas VALUES(1,'{}','now')").run();
 db.prepare("INSERT OR IGNORE INTO conversations VALUES(?,'test','model',?,'owner','local-owner')").run(conversation,at);
 db.prepare("INSERT INTO messages VALUES(?,?,'user',?,'completed',NULL,?,?,1,'local-owner')").run(id,conversation,text,at,id);
 db.prepare("INSERT INTO messages VALUES(?,?,'assistant','好的','completed',NULL,?,?,1,'fish')").run(id+'-reply',conversation,at,id);
}
it('persists sourced emotions, ignores neutral turns, deduplicates and decays across service restarts',async()=>{
 const db=openDatabase(':memory:');seed(db,'one','你今天真棒');seed(db,'two','查询时间');let calls=0;
 const engine={run:async()=>{calls++;return calls===1?JSON.stringify({changed:true,mood:'开心',intensity:0.6,reason:'被夸奖很开心',quote:'你今天真棒'}):JSON.stringify({changed:false});},close:async()=>{}};
 let life=new EmotionalLife(db,config,engine,()=>{});
 try{life.enqueue('message','one');life.enqueue('message','one');await wait(()=>life.current().mood==='开心');life.enqueue('message','two');await wait(()=>calls===2);expect(life.current().mood).toBe('开心');
 const context=life.capture('local');expect(context.context).toContain('被夸奖很开心');context.assertCurrent();await life.close();life=new EmotionalLife(db,config,engine,()=>{});expect(life.current().mood).toBe('开心');expect(life.current('owner',Date.now()+8*3600_000).mood).toBe('平静');
 db.prepare("DELETE FROM messages WHERE id='one'").run();expect(()=>context.assertCurrent()).toThrow('MEMORY_SCOPE_CHANGED');expect(life.current().mood).toBe('平静');expect(calls).toBe(2);
 }finally{await life.close();db.close();}
});
it('rejects invented evidence and preserves newer state when older events arrive later',async()=>{
 const db=openDatabase(':memory:');seed(db,'new','真棒');seed(db,'old','不好',new Date(Date.now()-3600_000).toISOString());let quote='真棒';
 const engine={run:async()=>JSON.stringify({changed:true,mood:quote==='真棒'?'开心':'委屈',intensity:0.5,reason:'感受',quote}),close:async()=>{}};
 const life=new EmotionalLife(db,config,engine,()=>{});try{life.enqueue('message','new');await wait(()=>life.current().mood==='开心');quote='不好';life.enqueue('message','old');await wait(()=>db.prepare("SELECT status FROM emotion_jobs WHERE source_id='old'").get()?.status==='done');expect(life.current().mood).toBe('开心');
 seed(db,'invalid','普通聊天');quote='伪造原话';life.enqueue('message','invalid');await wait(()=>db.prepare("SELECT attempts FROM emotion_jobs WHERE source_id='invalid'").get()?.attempts===1);expect(life.current().mood).toBe('开心');
 db.prepare("INSERT INTO activity_records VALUES('receipt','qq.sent','sent','已发送',?)").run(new Date().toISOString());life.enqueue('activity','receipt');expect(db.prepare("SELECT 1 FROM emotion_jobs WHERE source_id='receipt'").get()).toBeUndefined();
 }finally{await life.close();db.close();}
});
it('limits emotional carryover independently of process uptime',()=>{const at=new Date(0).toISOString();expect(fadedMood({mood:'委屈',intensity:0.6,reason:'被误解',occurred_at:at},90*60_000).intensity).toBeCloseTo(0.3);expect(fadedMood({mood:'委屈',intensity:0.6,reason:'被误解',occurred_at:at},8*3600_000).mood).toBe('平静');});
it('isolates owner, friends and groups and rechecks revocation before committing an appraisal',async()=>{
 const db=openDatabase(':memory:');seed(db,'owner','主人私密夸奖');
 const qq={enabled:true,replyEnabled:true,accountId:'10001',ownerId:'20002',friendIds:['30003'],groupIds:['40004'],groupMentionOnly:false,allowProactive:false};
 // Use the actual parser defaults to create a valid QQ binding.
 const {configuration}=await import('../channels/protocol.js');
 const valid=configuration({...qq,url:'ws://127.0.0.1:3001',groups:['40004'],proactiveEnabled:false});
 db.prepare("INSERT INTO plugin_config VALUES('qq',?,NULL,'r1')").run(JSON.stringify(valid));
 let release:(value:string)=>void=()=>{};const life=new EmotionalLife(db,config,{run:()=>new Promise<string>(r=>{release=r;}),close:async()=>{}},()=>{});
 try{life.enqueue('message','owner');await new Promise(r=>setTimeout(r,10));release(JSON.stringify({changed:true,mood:'开心',intensity:0.5,reason:'主人私密原因',quote:'主人私密夸奖'}));await wait(()=>life.current().mood==='开心');
 db.prepare("INSERT INTO conversations VALUES('group','group','model','now','group','qq-user:30003')").run();db.prepare("INSERT INTO channel_sessions VALUES('10001:r1:group:40004:30003','group')").run();
 expect(life.context('group')).not.toContain('主人私密原因');expect(life.current('qq:10001:private:30003').mood).toBe('平静');
 seed(db,'group-message','群里开心',undefined,'group');db.prepare("UPDATE messages SET author='qq-user:30003' WHERE id='group-message'").run();
 life.enqueue('message','group-message');await new Promise(r=>setTimeout(r,10));db.prepare("UPDATE plugin_config SET revision='revoked' WHERE id='qq'").run();release(JSON.stringify({changed:true,mood:'开心',intensity:0.5,reason:'群里开心',quote:'群里开心'}));await wait(()=>db.prepare("SELECT status FROM emotion_jobs WHERE source_id='group-message'").get()?.status==='skipped');expect(life.current('qq:10001:group:40004').mood).toBe('平静');
 }finally{await life.close();db.close();}
});
it('runs automatic diaries once, skips empty days, retries bounded failures and cancels on disable',()=>{
 const db=openDatabase(':memory:');let now=Date.parse('2026-11-07T23:10:00Z'),starts=0,guard:()=>void=()=>{};const tasks=new Map<string,MemoryTask>();let empty=false;
 const runner={start:(day:string,timezone:string,_id:string,assertCurrent:()=>void)=>{starts++;guard=assertCurrent;if(empty)throw new (class extends Error {})('unused');const task={id:'task-'+starts,kind:'diary' as const,status:'running',modelId:'model',error:null,result:null,createdAt:new Date(now).toISOString()};tasks.set(task.id,task);return task;},task:(id:string)=>tasks.get(id)!,cancel:(id:string)=>{tasks.get(id)!.status='cancelled';}};
 let auto=new AutomaticDiary(db,runner,()=>{},()=>now);
 try{auto.save({...auto.options(),timezone:'UTC'});auto.tick();auto.tick();expect(starts).toBe(1);guard();auto.save({...auto.options(),enabled:false});expect(()=>guard()).toThrow('CANCELLED');expect(tasks.get('task-1')?.status).toBe('cancelled');auto.tick();expect(starts).toBe(1);
 auto.save({...auto.options(),enabled:true});auto.tick();tasks.get('task-2')!.status='completed';auto.tick();auto.tick();expect(starts).toBe(2);auto.close();auto=new AutomaticDiary(db,runner,()=>{},()=>now);auto.tick();expect(starts).toBe(2);
 now+=86400_000;db.prepare("INSERT INTO daily_diaries VALUES('manual','2026-11-08','UTC','手写','[]',1,'model','now','ready')").run();auto.tick();expect(starts).toBe(2);
 empty=true;now+=86400_000;auto.tick();expect(auto.status().last?.status).toBe('retry');now+=300_001;auto.tick();now+=300_001;auto.tick();expect(auto.status().last?.status).toBe('failed');expect(starts).toBe(5);
 }finally{auto.close();db.close();}
});
it('handles local day boundaries, one-day catch-up and first enable without historic backfill',()=>{
 const options={enabled:true,hour:23,timezone:'Asia/Shanghai',since:'2026-11-06T00:00:00Z',revision:'r'};
 expect(dueDiaryDay(Date.parse('2026-11-07T15:00:00Z'),options)).toBe('2026-11-07');expect(dueDiaryDay(Date.parse('2026-11-07T16:05:00Z'),options)).toBe('2026-11-07');expect(dueDiaryDay(Date.parse('2026-11-07T01:00:00Z'),{...options,since:'2026-11-07T00:00:00Z'})).toBeNull();
});
