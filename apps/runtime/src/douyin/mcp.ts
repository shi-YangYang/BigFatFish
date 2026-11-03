import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { asset } from './browser.js';
import { InputError, object } from '../ai/types.js';
export const READ_TOOLS=['douyin_search','douyin_feed','douyin_video','douyin_comments','douyin_check_credential','douyin_login_qr','douyin_login_poll'] as const;
export const WRITE_TOOLS=['douyin_like','douyin_comment','douyin_chat_send','douyin_share_video','douyin_publish'] as const;
export async function callMcp(options:{python:string;home:string;endpoint:string;tool:string;args:Record<string,unknown>;signal:AbortSignal;guard?:()=>Promise<void>}){
 if(![...READ_TOOLS,...WRITE_TOOLS].includes(options.tool as never))throw new InputError('TOOL_NOT_ALLOWED',403);
 mkdirSync(options.home,{recursive:true,mode:0o700});const token=randomBytes(32).toString('hex');
 const server=createServer((req,res)=>{if(req.method!=='POST'||req.url!=='/submit'||req.headers.authorization!==`Bearer ${token}`){res.writeHead(403).end();return;}void Promise.resolve().then(()=>{options.signal.throwIfAborted();if(!options.guard)throw new Error();return options.guard();}).then(()=>res.end('{}'),()=>res.writeHead(403).end());});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address() as {port:number};const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,PYTHONUTF8:'1',PYTHONUNBUFFERED:'1',DSH_DOUYIN_HOME:options.home,DOUYIN_CDP_URL:options.endpoint,DOUYIN_CDP_STRICT:'1',DOUYIN_MCP_TOOLS:[...READ_TOOLS,...WRITE_TOOLS].join(','),DOUYIN_ALLOW_WRITES:'1',BFF_GUARD_URL:`http://127.0.0.1:${address.port}/submit`,BFF_GUARD_TOKEN:token};
 const child=spawn(options.python,[asset('services/douyin/mcp_server.py')],{cwd:options.home,env,stdio:['pipe','pipe','pipe']});child.stderr.resume();let seq=0,bytes=0;const pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void}>();let ended=false;
 const exited=new Promise<void>(r=>{child.once('exit',()=>{ended=true;for(const p of pending.values())p.reject(new InputError('DOUYIN_MCP_EXITED',409));r();});child.once('error',()=>{ended=true;for(const p of pending.values())p.reject(new InputError('PYTHON_DEPENDENCY_MISSING',409));r();});});
 child.stdin.on('error',()=>{for(const p of pending.values())p.reject(new InputError('DOUYIN_MCP_EXITED',409));});
 const lines=createInterface({input:child.stdout});lines.on('line',line=>{bytes+=line.length;if(bytes>4_000_000){child.kill('SIGKILL');return;}try{const b=object(JSON.parse(line));if(typeof b.id==='number'){const p=pending.get(b.id);pending.delete(b.id);if(b.error)p?.reject(new InputError('MCP_PROTOCOL_ERROR',409));else p?.resolve(b.result);}}catch{child.kill('SIGKILL');}});
 const send=(method:string,params:unknown)=>{if(ended)return Promise.reject(new InputError('PYTHON_DEPENDENCY_MISSING',409));return new Promise<unknown>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});};
 const abort=()=>child.kill('SIGKILL');options.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,150000);
 try{options.signal.throwIfAborted();const init=object(await send('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'BigFatFish',version:'0.1.0'}}));if(!init.protocolVersion)throw new InputError('MCP_PROTOCOL_ERROR');child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const list=object(await send('tools/list',{}));if(!Array.isArray(list.tools)||list.tools.some(t=>![...READ_TOOLS,...WRITE_TOOLS].includes(object(t).name as never))||!list.tools.some(t=>object(t).name===options.tool))throw new InputError('MCP_TOOL_MISMATCH');const result=object(await send('tools/call',{name:options.tool,arguments:options.args}));if(result.isError||!Array.isArray(result.content))throw new InputError('MCP_TOOL_FAILED',409);const texts=result.content.map(object).filter(c=>c.type==='text');if(texts.length!==1||typeof texts[0]!.text!=='string')throw new InputError('MCP_RESULT_INVALID');options.signal.throwIfAborted();return object(JSON.parse(texts[0]!.text));}
 finally{clearTimeout(timer);options.signal.removeEventListener('abort',abort);lines.close();if(!ended)child.kill('SIGKILL');await exited;await new Promise<void>(r=>server.close(()=>r()));}
}
