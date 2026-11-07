import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {paths,preparePaths} from '../../apps/runtime/src/paths.js';
import {openDatabase} from '../../apps/runtime/src/storage/database.js';
import {Configuration} from '../../apps/runtime/src/ai/configuration.js';
import {LifeService} from '../../apps/runtime/src/memory/life.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
it('writes a sourced automatic diary and copy, ignores transport-only days, and prevents a disabled pending write',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-auto-diary-')),p=paths(root);preparePaths(p);const db=openDatabase(p.database),config=new Configuration(db,p);
 config.saveModel({id:'fixture',label:'fixture',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'fixture'});config.saveRoutes({chat:'fixture'});
 let release:(text:string)=>void=()=>{},lastPrompt='';
 const life=new LifeService(db,p,config,{run:async input=>{lastPrompt=input.prompt;return new Promise<string>(r=>{release=r;});},close:async()=>{}},new EventEmitter());
 const today=new Date().toISOString().slice(0,10);
 try{
  life.automaticDiary.save({...life.automaticDiary.options(),hour:0,timezone:'UTC'});
  db.prepare("INSERT INTO activity_records VALUES('receipt','qq.sent','x','已发送',?)").run(new Date().toISOString());life.automaticDiary.tick();expect(life.automaticDiary.status().last?.status).toBe('skipped');expect(lastPrompt).toBe('');
  db.prepare('DELETE FROM diary_auto_runs').run();db.prepare("INSERT INTO activity_records VALUES('video','bilibili.watched','v','看了一段鲸鱼视频',?)").run(new Date().toISOString());
  life.automaticDiary.tick();await new Promise(r=>setTimeout(r,0));expect(lastPrompt).toContain('第一人称');expect(lastPrompt).not.toContain('已发送');
  release(JSON.stringify({content:'今天看到鲸鱼的视频，觉得很有趣。',sourceIds:['video']}));await new Promise(r=>setTimeout(r,0));expect(life.diaries()[0]?.content).toContain('鲸鱼');expect(readFileSync(join(p.data,'diaries',life.diaries()[0]!.id+'.md'),'utf8')).toContain('activity:video');life.automaticDiary.tick();expect(life.automaticDiary.status().last?.status).toBe('done');
  db.prepare('DELETE FROM daily_diaries').run();db.prepare('DELETE FROM diary_auto_runs').run();life.automaticDiary.tick();await new Promise(r=>setTimeout(r,0));life.automaticDiary.save({...life.automaticDiary.options(),enabled:false});release(JSON.stringify({content:'不应提交',sourceIds:['video']}));await new Promise(r=>setTimeout(r,0));expect(life.diaries()).toHaveLength(0);expect(life.automaticDiary.status().last).toMatchObject({day:today,status:'cancelled'});
 }finally{await life.close();db.close();rmSync(root,{recursive:true,force:true});}
});
it('restores emotional state and pauses diary automation for current and schema12 archives',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-life-archive-')),p=paths(join(root,'source')),q=paths(join(root,'current')),old=paths(join(root,'legacy'));preparePaths(p);const db=openDatabase(p.database);
 db.prepare("INSERT INTO activity_records VALUES('watch','bilibili.watched','v','鲸鱼',?)").run(new Date().toISOString());db.prepare("INSERT INTO emotional_states VALUES('owner','开心',0.5,'看鲸鱼很开心','鲸鱼','activity','watch',?)").run(new Date().toISOString());db.prepare("INSERT INTO diary_options VALUES(1,1,23,'Asia/Shanghai',?,'revision')").run(new Date().toISOString());db.close();
 try{const file=join(root,'backup.json');await exportArchive(p,file,{scopes:['life']});await restoreArchive(q,file);const restored=openDatabase(q.database);expect(restored.prepare('SELECT mood FROM emotional_states').get()?.mood).toBe('开心');expect(restored.prepare('SELECT enabled FROM diary_options').get()?.enabled).toBe(0);restored.close();
 const outer=JSON.parse(readFileSync(file,'utf8'));const payload=JSON.parse(Buffer.from(outer.files[0].content,'base64').toString());payload.schema=12;delete payload.tables.emotional_states;delete payload.tables.diary_options;const bytes=Buffer.from(JSON.stringify(payload));outer.files[0].content=bytes.toString('base64');outer.files[0].size=bytes.length;outer.files[0].sha256=createHash('sha256').update(bytes).digest('hex');const legacy=join(root,'old.json');writeFileSync(legacy,JSON.stringify(outer));await restoreArchive(old,legacy);const oldDb=openDatabase(old.database);expect(oldDb.prepare('SELECT enabled FROM diary_options').get()?.enabled).toBe(0);expect(oldDb.prepare('SELECT count(*) n FROM emotional_states').get()?.n).toBe(0);oldDb.close();
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('uses a persisted emotional appraisal in the next actual chat request without blocking the first reply',async()=>{
 const {fixtureModel}=await import('../fixtures/model.mjs');const {startRuntime}=await import('../../apps/runtime/src/lifecycle.js');const {requestRuntime}=await import('../../apps/runtime/src/connection.js');
 const root=mkdtempSync(join(tmpdir(),'bff-emotion-chat-')),p=paths(root),fixture=await fixtureModel();const runtime=await startRuntime(p);
 try{const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
 await call('/v1/models','POST',{id:'fixture',label:'fixture',provider:'openai',baseURL:fixture.url,model:'fixture-model'});await call('/v1/model-routes','PUT',{chat:'fixture'});
 fixture.controls.emotionResponse=JSON.stringify({changed:true,mood:'开心',intensity:0.5,reason:'今天的夸奖让我很开心',quote:'你今天真棒'});
 const chat=async(text:string)=>{const c=await call<{id:string}>('/v1/conversations','POST',{});const msg=await call<{id:string}>(`/v1/conversations/${c.id}/messages`,'POST',{content:text,requestId:text});for(let i=0;i<200;i++){const m=await call<{status:string}>(`/v1/messages/${msg.id}`);if(m.status==='completed')return;await new Promise(r=>setTimeout(r,25));}throw new Error('reply timeout');};
 await chat('你今天真棒');let mood='';for(let i=0;i<200;i++){mood=(await call<{mood:{mood:string}}>('/v1/life')).mood.mood;if(mood==='开心')break;await new Promise(r=>setTimeout(r,25));}expect(mood).toBe('开心');fixture.controls.emotionResponse='{"changed":false}';await chat('SECOND_MOOD_CONTEXT_CHECK');
 const request=fixture.requests.find(r=>r.body.messages.some((m:{role:string;content:unknown})=>m.role==='user'&&JSON.stringify(m.content).includes('SECOND_MOOD_CONTEXT_CHECK')));expect(request).toBeDefined();expect(JSON.stringify(request!.body.messages.filter((m:{role:string})=>m.role==='system'))).toContain('今天的夸奖让我很开心');
 }finally{await runtime.stop();await fixture.close();rmSync(root,{recursive:true,force:true});}
},20000);
