import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { fixtureModel } from '../fixtures/model.mjs';
import { paths, preparePaths } from '../../apps/runtime/src/paths.js';
import { openDatabase } from '../../apps/runtime/src/storage/database.js';
import { Configuration, defaultPersona } from '../../apps/runtime/src/ai/configuration.js';
import { DSHAdapter } from '../../apps/runtime/src/ai/dsh.js';
it('normalizes old specialized routes and removes old limits without losing keys or model identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'bff defaults ')), p = paths(root); preparePaths(p); const db = openDatabase(p.database), config = new Configuration(db,p);
  try {
    const model = {id:'chat',label:'old',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'test',contextWindow:8192,maxTokens:512,timeoutMs:1500,vision:false,apiKey:'fixture'};
    config.saveModel(model); config.saveModel({...model,id:'other'});
    expect(config.model('chat').config).not.toHaveProperty('maxTokens'); expect(config.model('chat').config).not.toHaveProperty('vision');
    expect(config.saveRoutes({chat:'chat',vision:'other',reasoning:'other',memory:'other',asr:'other',tts:'other'})).toEqual({chat:'chat',asr:'other',tts:'other'});
    expect(config.saveRoutes({tts:'other'})).toEqual({tts:'other'});
    expect(config.saveRoutes({memory:'chat',asr:'other'})).toEqual({chat:'chat',asr:'other'});
    config.saveModel({id:'chat',provider:'openai',baseURL:model.baseURL,model:'test'}); expect(config.model('chat').key).toBe('fixture');
  } finally { db.close(); rmSync(root,{recursive:true,force:true}); }
});
it('resumes a legacy DeepSeek session and clears its persisted explicit output cap through the public hook', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bff legacy cap ')), p = paths(root); preparePaths(p);
  const fixture = await fixtureModel(), conversationId = 'legacy', sessionId = randomUUID(), home = join(p.data,'engine',conversationId), cwd = join(home,'workspace'); mkdirSync(cwd,{recursive:true});
  const profile = join(home,'seed.json'); writeFileSync(profile,JSON.stringify([{id:'llm-deepseek',config:{baseURL:fixture.url.replace('/v1','/anthropic'),apiKeyEnv:'BFF_MODEL_API_KEY'}}]));
  const old = new DeepSeekHarness({profile:'sdk-minimal',patches:[profile],dshHome:home,cwd,processCwd:cwd,provider:'deepseek-official',model:'deepseek-v4-flash',maxTokens:512,env:{...process.env,BFF_MODEL_API_KEY:'fixture'}});
  const engine = new DSHAdapter(p);
  try {
    await old.run('remember legacy marker',{sessionId}); await old.close();
    expect(fixture.requests.find(req=>req.url.includes('messages'))?.body.max_tokens).toBe(512);
    const before = fixture.requests.length;
    const result = await engine.run({conversationId,sessionId,resume:true,model:{id:'ds',label:'DS',provider:'deepseek',baseURL:fixture.url.replace('/v1','/anthropic'),model:'deepseek-v4-flash'},key:'fixture',persona:defaultPersona,prompt:'continue',signal:AbortSignal.timeout(20000),onText:()=>{},onSessionReady:()=>{}});
    expect(result).toContain('回复');
    const request = fixture.requests.slice(before).find(req=>req.url.includes('messages'))!;
    expect(request.body.max_tokens).toBeGreaterThan(512); expect(JSON.stringify(request.body.messages)).toContain('remember legacy marker');
  } finally { await old.close(); await engine.close(); await fixture.close(); rmSync(root,{recursive:true,force:true}); }
},60000);
