import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { BrowserContext } from 'playwright-core';
import type { ChatService } from '../ai/chat.js';
import { paths } from '../paths.js';
import type { TaskQueue } from '../tasks/queue.js';
import { Douyin } from './service.js';
import * as tools from './mcp.js';

const config={enabled:true,executablePath:'',pythonPath:'python3',headless:false,accountId:'101'};
const accepted={ok:true,loggedIn:true,uid:'101',evidence:{avatar:true}};
const dispose:Array<()=>void>=[];
afterEach(()=>{vi.restoreAllMocks();for(const fn of dispose.splice(0))fn();});

function fixture(initial:Record<string,unknown>|null=config,profile=true){
 const root=mkdtempSync(join(tmpdir(),'bff-douyin-resume-')),p=paths(root),dir=join(p.data,'douyin-browser');
 if(profile){mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'Local State'),'{}');}
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE plugin_config(id TEXT PRIMARY KEY, config TEXT, revision TEXT)');
 if(initial)db.prepare('INSERT INTO plugin_config VALUES (?,?,?)').run('douyin',JSON.stringify(initial),'a');
 dispose.push(()=>{db.close();rmSync(root,{recursive:true,force:true});});
 const queue={paused:false,abort:async()=>{}};const probe=vi.spyOn(tools,'callMcp').mockResolvedValue(accepted);
 function open(){
  const d=new Douyin(db,{} as ChatService,queue as TaskQueue,p);
  const start=vi.spyOn(d.browser,'start').mockImplementation(async()=>{d.browser.context={pages:()=>[]} as unknown as BrowserContext;});
  vi.spyOn(d.browser,'account').mockResolvedValue({id:'101',loggedIn:true});
  return {d,start};
 }
 return {open,queue,probe};
}
const settled=async(d:Douyin)=>vi.waitFor(()=>{expect(['restoring','connecting']).not.toContain(d.status().connection.phase);});

it('restores a previous verified interactive connection on a new service using only one read and no visible browser',async()=>{
 const {open,probe}=fixture(null),first=open();
 await first.d.connect({...config,accountId:'',revision:''});await settled(first.d);
 expect(first.d.status().config.accountId).toBe('101');expect(first.start.mock.calls[0]?.[0].headless).toBe(false);
 await first.d.close();probe.mockClear();
 const next=open();expect(next.d.restoreConnection()).toBeUndefined();next.d.restoreConnection();
 await settled(next.d);
 expect(next.start.mock.calls[0]?.[0].headless).toBe(true);
 expect(next.d.status()).toMatchObject({connection:{phase:'online'},accountState:'verified',browser:{state:'closed'}});
 expect(probe.mock.calls.map(([args])=>args.tool)).toEqual(['douyin_check_credential']);
 await next.d.disconnect();const off=open();off.d.restoreConnection();await settled(off.d);expect(off.start).not.toHaveBeenCalled();
});
it.each([
 ['expired',{ok:true,loggedIn:false,needLogin:true,evidence:{loginPrompt:true}},'login-required','waiting'],
 ['verification',{ok:false,needCaptcha:true},'login-required','verification'],
 ['phone confirmation',{ok:true,loggedIn:false,state:'scanned_need_confirm'},'login-required','confirmation'],
 ['blank page',{ok:true,loggedIn:false,needLogin:true,evidence:{loginPrompt:false}},'error','DOUYIN_SESSION_UNAVAILABLE'],
 ['transport',{ok:false},'error','DOUYIN_SESSION_UNAVAILABLE'],
 ['cookie only',{ok:true,loggedIn:true,evidence:{cookie:true,avatar:false}},'error','DOUYIN_SESSION_UNAVAILABLE'],
 ['changed account',{...accepted,uid:'202'},'error','DOUYIN_ACCOUNT_CHANGED'],
] as const)('keeps the saved profile and requests no QR or writes for %s',async(_name,raw,phase,detail)=>{
 const {open,probe}=fixture();probe.mockResolvedValue(raw);const {d}=open();const before=d.status().revision;
 d.restoreConnection();await settled(d);const after=d.status();
 expect(after.connection).toMatchObject(phase==='error'?{phase,error:detail}:{phase,loginState:detail});expect(after.revision).toBe(before);
 expect(after.config.accountId).toBe('101');expect(after.browser.state).toBe('closed');expect(probe.mock.calls.map(([args])=>args.tool)).toEqual(['douyin_check_credential']);
});
it.each(['new','never verified','missing profile','paused'] as const)('does not start a browser for %s',async(reason)=>{
 const {open,queue,probe}=fixture(reason==='new'?null:reason==='never verified'?{...config,restoreOnStart:false}:config,reason!=='missing profile');
 queue.paused=reason==='paused';const {d,start}=open();d.restoreConnection();await settled(d);expect(start).not.toHaveBeenCalled();expect(probe).not.toHaveBeenCalled();
});
it('disconnect cancels restoration even when a stale verification succeeds later',async()=>{
 const {open,probe}=fixture(),{d}=open();let finish!:(v:typeof accepted)=>void;
 probe.mockImplementation(async()=>new Promise(resolve=>{finish=resolve;}));
 d.restoreConnection();await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
 const disconnected=d.disconnect();finish(accepted);await disconnected;
 expect(d.status()).toMatchObject({connection:{phase:'idle'},accountState:'unverified',config:{enabled:false}});expect(probe).toHaveBeenCalledTimes(1);
});
