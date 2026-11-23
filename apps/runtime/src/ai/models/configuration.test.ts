import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { paths, preparePaths } from '../../storage/paths.js';
import { openDatabase, migrate, migrations } from '../../storage/database.js';
import { Configuration } from './configuration.js';
let cleanup = () => {};
afterEach(()=>cleanup());
it('migrates version 1, encrypts model secrets, validates routes and keeps persona versions',()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff config ')));preparePaths(p);
 const v1=new DatabaseSync(p.database);migrate(v1,[migrations[0]!]);v1.prepare('INSERT INTO settings VALUES(?,?)').run('old','kept');v1.close();
 const db=openDatabase(p.database);cleanup=()=>{db.close();rmSync(p.root,{recursive:true,force:true});};
 const config=new Configuration(db,p);
 const model={id:'local',label:'本地',provider:'openai',baseURL:'http://127.0.0.1:9999/v1',model:'test',contextWindow:8192,maxTokens:512,timeoutMs:30000,vision:false,apiKey:'fixture-secret-123'};
 expect(config.saveModel(model).hasKey).toBe(true);expect(JSON.stringify(config.models())).not.toContain(model.apiKey);expect(db.prepare('SELECT secret FROM models').get()!.secret).not.toContain(model.apiKey);
 expect(config.model('local').key).toBe(model.apiKey);expect(config.model('local').config).not.toHaveProperty('apiKey');
 const draft={...model,apiKey:undefined};
 config.saveModel({...draft,model:'another'});expect(config.model('local').key).toBe(model.apiKey);
 for(const patch of [{baseURL:'http://127.0.0.1:9999/v2'},{provider:'deepseek'}]){
  expect(()=>config.saveModel({...draft,...patch})).toThrow('MODEL_KEY_REENTRY_REQUIRED');
 }
 expect(config.model('local').config.baseURL).toBe(model.baseURL);
 expect(config.saveModel({...draft,baseURL:'http://127.0.0.1:9999/v2',apiKey:''}).hasKey).toBe(false);
 expect(()=>config.saveModel({...model,baseURL:'https://user:password@example.com'})).toThrow('INVALID_MODEL_URL');
 expect(()=>config.saveModel({...model,baseURL:'http://example.com'})).toThrow('INVALID_MODEL_URL');
 expect(()=>config.saveRoutes({chat:'missing'})).toThrow('MODEL_NOT_CONFIGURED');expect(config.saveRoutes({chat:'local'})).toEqual({chat:'local'});
 const original=config.persona();expect(config.savePersona({...original,name:'测试鱼'}).version).toBe(2);expect(()=>config.savePersona(original)).toThrow('PERSONA_VERSION_CONFLICT');expect(config.history()).toHaveLength(2);
 expect(db.prepare("SELECT value FROM settings WHERE key='old'").get()?.value).toBe('kept');
 expect(readFileSync(join(p.config,'master.key')).length).toBe(32);if(process.platform!=='win32')expect(statSync(join(p.config,'master.key')).mode&0o077).toBe(0);
});

it('remembers purposes across replacements and legacy shared routes without changing routes or conversations', () => {
  const p = paths(mkdtempSync(join(tmpdir(), 'bff model purposes '))); preparePaths(p);
  const db = openDatabase(p.database); cleanup = () => { db.close(); rmSync(p.root, {recursive:true, force:true}); };
  const config = new Configuration(db, p);
  const draft = (id:string) => ({ id, model:id, provider:'openai', baseURL:'http://127.0.0.1:99/v1' });
  for (const id of ['shared','voice','new-voice','legacy','conversation']) config.saveModel(draft(id));
  config.saveModel({...draft('asr-config'), purpose:'asr'});
  db.prepare("INSERT INTO settings(key,value) VALUES('model_routes',?)").run(JSON.stringify({vision:'shared',asr:'shared',tts:'voice'}));
  db.prepare("INSERT INTO conversations(id,title,model_id,created_at) VALUES('kept','旧对话','conversation','2026-01-01')").run();
  expect(config.models().find(m => m.id === 'legacy')?.purposes).toBeUndefined();
  expect(config.models().find(m => m.id === 'conversation')?.purposes).toEqual(['chat']);
  expect(config.models().find(m => m.id === 'shared')?.purposes).toEqual(['chat','asr']);
  expect(config.saveRoutes({chat:'shared',asr:'asr-config',tts:'new-voice'})).toEqual({chat:'shared',asr:'asr-config',tts:'new-voice'});
  config.saveRoutes({chat:'shared'});
  config.saveModel(draft('voice')); // old clients do not send purpose
  const reopened = new Configuration(db, p);
  expect(Object.fromEntries(reopened.models().map(m => [m.id,m.purposes]))).toMatchObject({
    shared:['chat','asr'], voice:['tts'], 'new-voice':['tts'], 'asr-config':['asr'], conversation:['chat'],
  });
  expect(reopened.routes()).toEqual({chat:'shared'});
  expect(db.prepare("SELECT title FROM conversations WHERE id='kept'").get()?.title).toBe('旧对话');
});
