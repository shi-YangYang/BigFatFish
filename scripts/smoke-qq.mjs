import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { onebotFixture } from '../tests/fixtures/onebot.ts';
import { fixtureModel } from '../tests/fixtures/model.mjs';
const root=mkdtempSync(join(tmpdir(),'bff-qq-smoke-')),bot=await onebotFixture(),model=await fixtureModel();
async function cli(args,input){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['dist/cli/src/main.js',...args,'--data-dir',root,'--json'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('close',code=>code===0?resolve(JSON.parse(out)):reject(new Error(out||err)));child.stdin.end(input===undefined?'':JSON.stringify(input));});}
try{
 await cli(['start']);await cli(['models','set'],{id:'test',label:'本地测试模型',provider:'openai',baseURL:model.url,model:'fixture-model',contextWindow:32768,maxTokens:1024,timeoutMs:20000,vision:false});await cli(['routes','set'],{chat:'test'});
 const status=await cli(['channels','status']);await cli(['channels','configure'],{revision:status.revision,url:bot.url,token:bot.controls.token,accountId:'10001',ownerId:'20002',groups:['30003'],enabled:true,replyEnabled:true,proactiveEnabled:true});
 for(let i=0;i<40;i++){if((await cli(['channels','status'])).health.state==='online')break;await delay(100);}
 const approval=await cli(['permissions','propose'],{target:{kind:'private',id:'20002'},segments:[{type:'text',data:{text:'桌面审批测试消息'}}]});
 if(process.argv.includes('--desktop')){
  writeFileSync('/tmp/bff-p3-smoke.json',JSON.stringify({root,approvalId:approval.id}));console.log(JSON.stringify({root,status:'ready-for-desktop',approvalId:approval.id}));
  await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
 }else{
  await cli(['permissions','decide',approval.id],{decision:'approve',digest:approval.digest});await delay(200);if((await cli(['permissions','list'])).find(a=>a.id===approval.id)?.status!=='sent')throw new Error('APPROVAL_NOT_SENT');
  await cli(['channels','stop']);if((await cli(['channels','status'])).health.state!=='stopped')throw new Error('NOT_STOPPED');console.log('PASS: built CLI/Runtime/plugin configure, health, approval, send, stop');
 }
}finally{await cli(['stop']).catch(()=>{});await bot.close();await model.close();rmSync(root,{recursive:true,force:true});}
