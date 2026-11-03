import {expect,it} from 'vitest';
import {mkdtempSync,readFileSync,rmSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {paths} from '../../apps/runtime/src/paths.js';
import {startRuntime} from '../../apps/runtime/src/lifecycle.js';
import {requestRuntime} from '../../apps/runtime/src/connection.js';
import {hash,type Bundle} from '../../apps/runtime/src/plugins/package.js';
import {exportArchive,restoreArchive} from '../../apps/runtime/src/maintenance/archive.js';
import {fixtureModel} from '../fixtures/model.mjs';
import type {ChatMessage} from '../../apps/runtime/src/ai/types.js';
it('independent directory SDK lifecycle, real DSH tool result, revocation, update rollback, backup safe restore',async()=>{
 const external=mkdtempSync(join(tmpdir(),'external-plugin-')),p=paths(mkdtempSync(join(tmpdir(),'bff-p7-'))),model=await fixtureModel();let runtime=await startRuntime(p);
 try{
  for(const name of ['manifest.json','index.mjs'])copyFileSync('examples/hello-fish/'+name,join(external,name));copyFileSync('plugins/sdk/host.mjs',join(external,'host.mjs'));
  execFileSync(process.execPath,[resolve('scripts/pack-plugin.mjs'),external,join(external,'bundle.bff-plugin')]);const bundle=JSON.parse(readFileSync(join(external,'bundle.bff-plugin'),'utf8')) as Bundle;
  const call=<T>(route:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,route,method,body);
  await call('/v1/plugins/install','POST',bundle);await expect(call('/v1/plugins/hello-fish/call','POST',{name:'greet',args:{name:'主人'}})).rejects.toThrow('PLUGIN_DISABLED');
  await expect(call('/v1/plugins/hello-fish/enable','POST',{granted:['tools.execute']})).rejects.toThrow('PLUGIN_PERMISSION_REQUIRED');
  await call('/v1/plugins/hello-fish/enable','POST',{granted:bundle.manifest.permissions,config:{}});
  expect(await call('/v1/plugins/hello-fish/call','POST',{name:'greet',args:{name:'主人'}})).toEqual({greeting:'你好，主人，鱼正在使用独立插件。'});
  await expect(call('/v1/plugins/hello-fish/call','POST',{name:'greet',args:{name:5}})).rejects.toThrow('PLUGIN_ARGUMENT_INVALID');
  await call('/v1/models','POST',{id:'fixture',label:'本地协议夹具',provider:'openai',baseURL:model.url,model:'fixture-model',contextWindow:8192,maxTokens:512,timeoutMs:20000,vision:false});await call('/v1/model-routes','PUT',{chat:'fixture'});model.controls.tool=true;
  const conversation=await call<{id:string}>('/v1/conversations','POST',{}),message=await call<ChatMessage>(`/v1/conversations/${conversation.id}/messages`,'POST',{content:'请调用问候工具',requestId:'tool-real'});
  let result=message;for(let i=0;i<200&&['queued','running'].includes(result.status);i++){await delay(100);result=await call('/v1/messages/'+message.id);}
  expect(result.status,result.error??'').toBe('completed');expect(result.content).toContain('实际DSH');expect(result.content).toContain('独立插件');expect(await call(`/v1/conversations/${conversation.id}/tools`)).toEqual(expect.arrayContaining([expect.objectContaining({state:'completed'})]));
  const updated=structuredClone(bundle);updated.manifest.version='1.0.1';await call('/v1/plugins/update','POST',updated);expect((await call<{enabled:boolean}[]>('/v1/plugins')).find(x=>x.enabled)).toBeTruthy();
  const bad=structuredClone(updated);bad.manifest.version='1.0.2';bad.files=bad.files.map(f=>f.path==='index.mjs'?{path:f.path,data:Buffer.from('process.exit(1)').toString('base64'),sha256:hash('process.exit(1)')}:f);
  await expect(call('/v1/plugins/update','POST',bad)).rejects.toThrow();expect(await call('/v1/plugins/hello-fish/call','POST',{name:'greet',args:{name:'回退'}})).toEqual({greeting:'你好，回退，鱼正在使用独立插件。'});
  const evil=structuredClone(bundle);evil.files[0]!.path='../escape';await expect(call('/v1/plugins/update','POST',evil)).rejects.toThrow('PLUGIN_ARCHIVE_PATH');
  const expanded=structuredClone(updated);expanded.manifest.version='1.0.3';expanded.manifest.permissions.push('storage.write');await call('/v1/plugins/update','POST',expanded);await expect(call('/v1/plugins/hello-fish/call','POST',{name:'greet',args:{name:'拒绝'}})).rejects.toThrow('PLUGIN_DISABLED');
  await runtime.stop();const archive=join(external,'fish.bff');await exportArchive(p,archive);restoreArchive(p,archive);runtime=await startRuntime(p);const restored=await call<{installed:boolean;enabled:boolean;granted:string[]}[]>('/v1/plugins');expect(restored[0]).toMatchObject({installed:false,enabled:false,granted:[]});await call('/v1/plugins/install','POST',bundle);await call('/v1/plugins/hello-fish/enable','POST',{granted:bundle.manifest.permissions,config:{}});await call('/v1/plugins/hello-fish','DELETE');expect((await call<{installed:boolean}[]>('/v1/plugins'))[0]!.installed).toBe(false);
 }finally{await runtime.stop();await model.close();rmSync(external,{recursive:true,force:true});rmSync(p.root,{recursive:true,force:true});}
},90000);
