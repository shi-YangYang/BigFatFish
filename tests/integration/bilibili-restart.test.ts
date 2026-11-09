import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../apps/runtime/src/paths.js';
import { readConnection, requestRuntime } from '../../apps/runtime/src/connection.js';
it.skipIf(process.platform==='win32')('removes temporary credentials after a real Runtime crash, stops workers and recovers the actual interrupted task',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff bili crash ')),p=paths(root);let child:ChildProcess|undefined;
 const start=async()=>{child=spawn(process.execPath,[resolve('tests/fixtures/bilibili-runtime.mjs'),root],{stdio:['ignore','pipe','pipe']});await new Promise<void>((ok,no)=>{child!.stdout!.once('data',()=>ok());child!.once('error',no);child!.once('exit',c=>{if(c!==0)no(Error('fixture exited '+c));});});return readConnection(p);};
 const stop=async(signal:NodeJS.Signals)=>{const c=child!;await new Promise<void>(r=>{c.once('exit',()=>r());c.kill(signal);});child=undefined;};
 try{
  let connection=await start();await requestRuntime(connection,'/v1/bilibili','PUT',{enabled:true,revision:''});
  const task=await requestRuntime<{id:string}>(connection,'/v1/bilibili/tasks','POST',{bvid:'BV1234567890',requestId:'crash'});
  let workspace='';for(let i=0;i<50;i++){workspace=readdirSync(join(p.runtime,'bilibili'))[0]??'';if(workspace)break;await delay(50);}
  const credentials=join(p.runtime,'bilibili',workspace,'.bili-ai','credentials.json');expect(existsSync(credentials)).toBe(true);await delay(300);await stop('SIGKILL');
  for(let i=0;i<60&&existsSync(credentials);i++)await delay(50);expect(existsSync(credentials)).toBe(false);
  connection=await start();expect(await requestRuntime(connection,'/v1/bilibili/tasks/'+task.id)).toMatchObject({status:'interrupted',error:'RUNTIME_RESTARTED'});expect(readdirSync(join(p.runtime,'bilibili'))).toEqual([]);await stop('SIGTERM');
 }finally{if(child)await stop('SIGKILL');rmSync(root,{recursive:true,force:true});}
});
