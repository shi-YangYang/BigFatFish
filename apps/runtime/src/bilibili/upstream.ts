import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync, lstatSync, readFileSync, chmodSync } from 'node:fs';
import { join, resolve, sep, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRegular, privateFile, type DataPaths } from '../paths.js';
import { windowsAcl } from '../windows-acl.js';
import { InputError } from '../ai/types.js';
import type { EngineImage } from '../ai/engine.js';
const built=new URL('../../../plugins/bilibili/',import.meta.url),source=new URL('../../../../plugins/bilibili/',import.meta.url);
export const pluginURL=existsSync(built)?built:source;
export async function loadBilibili(url=pluginURL){return import(new URL('index.mjs',url).href);}
export type Credentials={sessdata:string;bili_jct:string;buvid3:string};
export interface Evidence {title:string;url:string;bvid:string;subtitles:string;frames:number;sample:string;warnings:string[];metadataCached:boolean;observedAt:string}
function directory(path:string){assertRegular(path,true);mkdirSync(path,{recursive:true,mode:0o700});if(process.platform==='win32')windowsAcl('restrict',[{path,directory:true}]);else chmodSync(path,0o700);}
export class Upstream {
  url=pluginURL;private root:string;private state:string;
  constructor(p:DataPaths,private test?:{preload:string;env:NodeJS.ProcessEnv;timeoutMs?:number}) {
    this.root=join(p.runtime,'bilibili');this.state=join(p.data,'bilibili');directory(this.root);directory(this.state);
    // Process groups have bounded lifetimes; orphan owner exits when its Runtime parent dies.
    for(const entry of readdirSync(this.root)){const file=join(this.root,entry);assertRegular(file,true);rmSync(file,{recursive:true,force:true});}
  }
  ffmpeg(){const name=process.platform==='win32'?'ffmpeg.exe':'ffmpeg';return (process.env.PATH??'').split(delimiter).map(p=>join(p,name)).some(p=>existsSync(p));}
  async withWorkspace<T>(credentials:Credentials|null,signal:AbortSignal,action:(dir:string,run:(args:string[])=>Promise<{output:string;code:number|null}>)=>Promise<T>):Promise<T>{
    signal.throwIfAborted();const dir=mkdtempSync(join(this.root,'run-'));directory(dir);directory(join(dir,'.bili-ai'));
    const file=join(dir,'.bili-ai','credentials.json');privateFile(file);writeFileSync(file,JSON.stringify(credentials??{sessdata:'',bili_jct:'',buvid3:''}));
    try{return await action(dir,args=>this.execute(args,dir,signal));}finally{rmSync(dir,{recursive:true,force:true});}
  }
  private execute(args:string[],dir:string,signal:AbortSignal){
    if(!['search','comments','subtitles','video','watch-video','debrief'].includes(args[0]??''))throw new InputError('BILI_READ_ONLY',403);
    const env:NodeJS.ProcessEnv={};for(const k of ['PATH','SystemRoot','WINDIR','LANG'])if(process.env[k])env[k]=process.env[k];
    Object.assign(env,{BFF_BILI_DATA_DIR:dir,BFF_BILI_STATE_DIR:this.state,TMPDIR:dir,TMP:dir,TEMP:dir,NODE_OPTIONS:`--import=${new URL('network.mjs',this.url).href}`});
    if(this.test){Object.assign(env,this.test.env);env.NODE_OPTIONS=`--import=${this.test.preload} ${env.NODE_OPTIONS}`;}
    return new Promise<{output:string;code:number|null}>((resolvePromise,reject)=>{
      const child=spawn(process.execPath,[fileURLToPath(new URL('runner.mjs',this.url)),...args],{cwd:dir,env,detached:process.platform!=='win32',windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output='',failure:string|undefined;
      const kill=()=>{if(!child.pid)return;if(process.platform==='win32'){spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}else{try{process.kill(-child.pid,'SIGKILL');}catch{/* already exited */}}};
      const cancel=()=>{failure='CANCELLED';kill();};signal.addEventListener('abort',cancel,{once:true});
      const timer=setTimeout(()=>{failure='BILI_TIMEOUT';kill();},this.test?.timeoutMs??180000);
      const data=(chunk:Buffer)=>{if(output.length+chunk.length>262144){failure='BILI_OUTPUT_TOO_LARGE';kill();}else output+=chunk.toString('utf8');};
      child.stdout.on('data',data);child.stderr.on('data',data);
      const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);};
      child.on('error',()=>{done();reject(new InputError('BILI_PROCESS_FAILED',409));});
      child.on('close',code=>{done();if(failure)reject(new InputError(failure,409));else resolvePromise({output,code});});
      if(signal.aborted)cancel();
    });
  }
  async search(query:string,credentials:Credentials|null,signal:AbortSignal){return this.withWorkspace(credentials,signal,async(_dir,run)=>{const r=await run(['search',query,'1']);if(r.code!==0||!r.output.includes('code=0'))throw new InputError('BILI_SEARCH_FAILED',409);const items=[...r.output.matchAll(/^\[\d+\] (.+)\n\s+BV=(BV[0-9A-Za-z]{10})\s+UP=(.*?)\s+播放=/gm)].map(m=>({title:m[1]!,bvid:m[2]!,author:m[3]!}));return {text:r.output.slice(0,24000),items};});}
  async read(bvid:string,kind:'video'|'comments'|'debrief',credentials:Credentials|null,signal:AbortSignal){return this.withWorkspace(credentials,signal,async(_dir,run)=>{const r=await run([kind,bvid,...(kind==='debrief'?['--no-frames']:kind==='comments'?['--json']:[])]);if(r.code!==0)throw new InputError('BILI_READ_FAILED',409);return {text:r.output.slice(0,24000),scope:kind==='debrief'?'metadata-and-commentary':'read-only',warning:'资料读取不表示已观看或理解画面'};});}
  async watch(bvid:string,credentials:Credentials|null,signal:AbortSignal):Promise<{evidence:Evidence;images:EngineImage[]}>{
    return this.withWorkspace(credentials,signal,async(dir,run)=>{
      const subs=await run(['subtitles',bvid,'--out',join(dir,'subs'),'--print','0']);
      const frames=this.ffmpeg()?await run(['watch-video',bvid,'3x3',join(dir,'frames'),'--uniform']):{code:2,output:''};
      signal.throwIfAborted();const warnings:string[]=[];let subtitles='';const images:EngineImage[]=[];
      const checked=(path:string,max:number)=>{const full=resolve(path);if(!full.startsWith(dir+sep))throw new InputError('BILI_UNSAFE_RESULT');const stat=lstatSync(full);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max||stat.size===0)throw new InputError('BILI_INVALID_RESULT');return readFileSync(full);};
      if(existsSync(join(dir,'subs')))for(const file of readdirSync(join(dir,'subs')).filter(f=>f.endsWith('.json'))){
        const raw=JSON.parse(checked(join(dir,'subs',file),1048576).toString());
        if(!Array.isArray(raw.body)||raw.body.some((v:Record<string,unknown>)=>typeof v.content!=='string'||typeof v.from!=='number'||typeof v.to!=='number'||v.from<0||v.to<v.from))throw new InputError('BILI_INVALID_SUBTITLES');
        subtitles=raw.body.map((v:{from:number;content:string})=>`[${v.from}s] ${v.content}`).join('\n');
        if(subtitles.length>24000){subtitles=subtitles.slice(0,24000);warnings.push('SUBTITLES_TRUNCATED');}break;
      }
      if(!subtitles)warnings.push(subs.code===0?'NO_SUBTITLES':'SUBTITLES_FAILED');
      const output=frames.output;const sheet=output.match(/^SHEET:\s*(.+)$/m)?.[1]?.trim();
      if(sheet){const bytes=checked(sheet,4*1024*1024);if(bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new InputError('BILI_INVALID_IMAGE');images.push({type:'image',mimeType:'image/jpeg',data:bytes.toString('base64')});}
      if(!images.length)warnings.push(this.ffmpeg()?'NO_FRAMES':'FFMPEG_MISSING');
      if(frames.code!==0&&images.length)warnings.push('FRAMES_PARTIAL');
      if((subs.output+output).includes('BFF_STALE_METADATA'))warnings.push('STALE_METADATA');
      const title=(subs.output+'\n'+output).match(/^标题:\s*(.+)$/m)?.[1]?.trim();
      if(!title||title.length>500||(!subtitles&&!images.length))throw new InputError('NO_WATCH_EVIDENCE',409);
      return {evidence:{title,bvid,url:`https://www.bilibili.com/video/${bvid}/`,subtitles,frames:images.length?9:0,sample:output.match(/^时间点\s*:\s*(.+)$/m)?.[1]??'',warnings,metadataCached:(subs.output+output).includes('BFF_CACHED_METADATA'),observedAt:new Date().toISOString()},images};
    });
  }
}
