import { expect, it } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DSHAdapter } from './dsh.js';
import { defaultPersona } from './configuration.js';
import { paths, preparePaths } from '../paths.js';
it.skipIf(process.platform==='win32' || process.getuid?.()===0)('releases all resources when an actual read-only profile directory rejects a write',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff profile failure ')));preparePaths(p);const home=join(p.data,'engine','owned');mkdirSync(join(home,'workspace'),{recursive:true});chmodSync(home,0o500);
 const before=process.getActiveResourcesInfo().filter(v=>v==='TCPServerWrap').length;const adapter=new DSHAdapter(p);
 try{
  await expect(adapter.run({conversationId:'owned',sessionId:'failed-test',resume:false,prompt:'not sent',persona:defaultPersona,model:{id:'fixture',label:'fixture',provider:'openai',baseURL:'http://127.0.0.1:1/v1',model:'fixture',contextWindow:8192,maxTokens:512,timeoutMs:1000,vision:false},key:'',signal:new AbortController().signal,onText:()=>{},onSessionReady:()=>{}})).rejects.toThrow('ENGINE_REQUEST_FAILED');
  expect(readdirSync(home)).toEqual(['workspace']);expect(process.getActiveResourcesInfo().filter(v=>v==='TCPServerWrap').length).toBe(before);
 }finally{await adapter.close();chmodSync(home,0o700);rmSync(p.root,{recursive:true,force:true});}
});
