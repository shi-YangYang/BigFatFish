import { it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import type { BrowserContext } from 'playwright-core';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { paths } from '../../apps/runtime/src/paths.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import type { ActivityTask } from '../../apps/runtime/src/tasks/queue.js';
import * as mcp from '../../apps/runtime/src/douyin/mcp.js';
import { activityCommand } from '../../apps/cli/src/activities.js';
import * as cliInput from '../../apps/cli/src/input.js';

it('direct writes keep exact wire checks, idempotency, cancellation and account/plugin boundaries without approvals', async () => {
  const root=mkdtempSync(join(tmpdir(),'bff-direct-')),p=paths(root),id='1234567890123456789';
  let context:BrowserContext,submissions=0,receipt=true,hold=false,waiting=false,release=()=>{},wrongTarget=false,duplicate=false;
  const spy=vi.spyOn(mcp,'callMcp').mockImplementation(async options=>{
    const page=await context.newPage();
    try {
      await page.goto('https://www.douyin.com/');
      if(hold){waiting=true;await new Promise<void>(r=>{release=r;});}
      options.signal.throwIfAborted();await options.guard?.();
      const body=options.tool==='douyin_comment'?new URLSearchParams({aweme_id:id,text:String(options.args.text),reply_id:''}).toString():`aweme_id=${wrongTarget?'9999999999999999999':id}&type=1`;
      const endpoint=options.tool==='douyin_comment'?'/aweme/v1/web/comment/publish/':'/aweme/v1/web/commit/item/digg/';
      await page.evaluate(async({endpoint,body,duplicate})=>{await fetch(endpoint,{method:'POST',body}).then(response=>response.text()).catch(()=>{});if(duplicate)await fetch(endpoint,{method:'POST',body}).then(response=>response.text()).catch(()=>{});},{endpoint,body,duplicate});
      return {ok:true};
    } finally {await page.close().catch(()=>{});}
  });
  const runtime=await startRuntime(p,0,{douyin:async c=>{
    context=c;
    await c.addCookies([{name:'uid_tt',value:'12345',domain:'.douyin.com',path:'/'},{name:'sessionid',value:'fixture',domain:'.douyin.com',path:'/'}]);
    await c.route('**/*',async route=>{
      if(route.request().method()==='POST'){
        submissions++;const args=Object.fromEntries(new URLSearchParams(route.request().postData()??''));
        await route.fulfill({json:receipt?{status_code:0,...(args.text?{comment:{cid:'fixture-comment',aweme_id:id,text:args.text,reply_id:''}}:{})}:{status_code:9}});
      }else await route.fulfill({contentType:'text/html',body:'<img data-e2e="user-avatar">'});
    });
  }});
  const call=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
  const wait=async(id:string)=>{
    let task:ActivityTask|undefined;
    await expect.poll(async()=>{task=(await call<{tasks:ActivityTask[]}>('/v1/activities')).tasks.find(t=>t.id===id);return task&& !['queued','running'].includes(task.status);},{timeout:10000}).toBe(true);
    return task!;
  };
  const write=(requestId:string,args={aweme_id:id},tool='douyin_like')=>call<ActivityTask>('/v1/douyin/write','POST',{tool,args,requestId});
  try{
    await call('/v1/douyin','PUT',{enabled:true,headless:true,accountId:'12345',executablePath:'',pythonPath:'python3',revision:''});
    const config=await call<{revision:string}>('/v1/douyin');
    const db=new DatabaseSync(p.database);
    db.prepare("INSERT INTO approvals(id,plugin,payload,digest,revision,expires_at,status,created_at) VALUES('legacy','douyin','{}','x','x',9999999999999,'pending','now')").run();
    for(const [url,method] of [['/v1/douyin/approvals','GET'],['/v1/douyin/approvals','POST'],['/v1/douyin/approvals/legacy/decide','POST'],['/v1/douyin/approvals/legacy/revoke','POST']])await expect(call(url!,method!,{})).rejects.toThrow('DOUYIN_APPROVAL_REMOVED');
    expect(submissions).toBe(0);
    const first=await write('first');expect((await wait(first.id)).status).toBe('completed');expect(submissions).toBe(1);
    expect((await write('first')).id).toBe(first.id);expect(submissions).toBe(1);
    await expect(write('first',{aweme_id:'9999999999999999999'})).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(call('/v1/douyin/write','POST',{tool:'douyin_like',args:{aweme_id:id}})).rejects.toThrow('INVALID_REQUEST');
    await expect(write('unsupported',{aweme_id:id,nickname:'fixture',peer_id:'123'} as {aweme_id:string},'douyin_share_video')).rejects.toThrow('ACTION_PROTOCOL_UNSUPPORTED');
    const comment=await write('comment',{aweme_id:id,text:'测试评论'} as {aweme_id:string},'douyin_comment');expect((await wait(comment.id)).status).toBe('completed');expect(submissions).toBe(2);
    wrongTarget=true;expect((await wait((await write('wrong')).id)).status).toBe('revoked');expect(submissions).toBe(2);wrongTarget=false;
    duplicate=true;expect((await wait((await write('duplicate-wire')).id)).status).toBe('unknown');expect(submissions).toBe(3);duplicate=false;
    receipt=false;expect((await wait((await write('unknown')).id)).status).toBe('unknown');expect(submissions).toBe(4);receipt=true;
    hold=true;waiting=false;const cancel=await write('cancel');await expect.poll(()=>waiting).toBe(true);
    const queued=await write('queued');await call(`/v1/activities/${queued.id}/cancel`,'POST');expect((await wait(queued.id)).status).toBe('cancelled');
    await call(`/v1/activities/${cancel.id}/cancel`,'POST');hold=false;release();expect((await wait(cancel.id)).status).toBe('cancelled');expect(submissions).toBe(4);
    hold=true;waiting=false;const changed=await write('account');await expect.poll(()=>waiting).toBe(true);
    await context!.addCookies([{name:'uid_tt',value:'67890',domain:'.douyin.com',path:'/'}]);hold=false;release();expect((await wait(changed.id)).status).toBe('revoked');expect(submissions).toBe(4);
    await context!.addCookies([{name:'uid_tt',value:'12345',domain:'.douyin.com',path:'/'}]);
    hold=true;waiting=false;const pause=await write('pause');await expect.poll(()=>waiting).toBe(true);
    const paused=call('/v1/activities/pause','POST',{paused:true});await expect.poll(async()=> (await call<{paused:boolean}>('/v1/activities')).paused).toBe(true);hold=false;release();await paused;expect((await wait(pause.id)).status).toBe('cancelled');expect(submissions).toBe(4);
    await expect(write('paused')).rejects.toThrow('DOUYIN_DISABLED');await call('/v1/activities/pause','POST',{paused:false});
    hold=true;waiting=false;const disabling=await write('disable');await expect.poll(()=>waiting).toBe(true);
    const disable=call('/v1/douyin','PUT',{enabled:false,headless:true,accountId:'12345',executablePath:'',pythonPath:'python3',revision:config.revision});
    await expect.poll(async()=> (await call<{tasks:ActivityTask[]}>('/v1/activities')).tasks.find(t=>t.id===disabling.id)?.status==='cancelled'||context!.pages().length===0).toBe(true);
    hold=false;release();await disable;expect((await wait(disabling.id)).status).toBe('cancelled');expect(submissions).toBe(4);
    expect(db.prepare('SELECT COUNT(*) AS n FROM approvals').get()?.n).toBe(1);expect(db.prepare("SELECT status FROM approvals WHERE id='legacy'").get()?.status).toBe('pending');db.close();
    const disabledConfig=await call<{revision:string}>('/v1/douyin');
    await call('/v1/douyin','PUT',{enabled:true,headless:true,accountId:'12345',executablePath:'',pythonPath:'python3',revision:disabledConfig.revision});
    const inputSpy=vi.spyOn(cliInput,'readInput').mockResolvedValue({tool:'douyin_like',args:{aweme_id:id},requestId:'cli'});
    let cliTask:ActivityTask|undefined;
    try{
      await activityCommand(p,['douyin','write'],value=>{cliTask=value as ActivityTask;});
      expect((await wait(cliTask!.id)).status).toBe('completed');expect(submissions).toBe(5);
      await activityCommand(p,['douyin','write'],value=>{expect((value as ActivityTask).id).toBe(cliTask!.id);});expect(submissions).toBe(5);
      for(const old of ['approvals','propose','decide','revoke'])await expect(activityCommand(p,['douyin',old,'legacy'],()=>{})).rejects.toThrow('DOUYIN_APPROVAL_REMOVED');
    }finally{inputSpy.mockRestore();}

  }finally{hold=false;release();await runtime.stop();spy.mockRestore();rmSync(root,{recursive:true,force:true});}
},40000);
