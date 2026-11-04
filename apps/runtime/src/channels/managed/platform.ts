import { execFile,spawn,type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,openSync,closeSync,writeSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { promisify } from 'node:util';
import { InputError } from '../../ai/types.js';
import { windowsAcl } from '../../windows-acl.js';
import { assertRegular,privateFile } from '../../paths.js';
import type { ManagedState } from './types.js';
const exec=promisify(execFile);
export const VERSION='4.18.42';
export const IMAGE='mlikiowa/napcat-docker@sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b';
export const WINDOWS_SHA='77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed';
export const WINDOWS_URL=`https://github.com/NapNeko/NapCatQQ/releases/download/v${VERSION}/NapCat.Shell.Windows.Node.zip`;
export function privateDirectory(path:string){assertRegular(path,true);mkdirSync(path,{recursive:true,mode:0o700});if(process.platform==='win32')windowsAcl('restrict',[{path,directory:true}]);}
export function writePrivate(path:string,value:unknown){privateFile(path);writeFileSync(path,JSON.stringify(value));}
function commandEnvironment(){const result:NodeJS.ProcessEnv={};for(const key of ['PATH','HOME','USERPROFILE','SystemRoot','WINDIR','LOCALAPPDATA','APPDATA','TEMP','TMP','DOCKER_CONFIG'])if(process.env[key])result[key]=process.env[key];return result;}
export class ComponentPlatform {
 readonly native=process.platform==='win32';readonly supported=this.native?process.arch==='x64':['darwin','linux'].includes(process.platform)&&['arm64','x64'].includes(process.arch);
 private child?:ChildProcess;private dockerHost='';
 constructor(readonly directory:string,private state:ManagedState){}
 private async docker(args:string[],timeout=15000,signal?:AbortSignal){
  try{return (await exec('docker',[...(this.dockerHost?['--host',this.dockerHost]:[]),...args],{env:commandEnvironment(),encoding:'utf8',timeout,maxBuffer:2_000_000,windowsHide:true,signal})).stdout;}
  catch(error){if(signal?.aborted)throw new InputError('CANCELLED');throw new InputError((error as NodeJS.ErrnoException).code==='ENOENT'?'QQ_DOCKER_MISSING':'QQ_DOCKER_FAILED',409);}
 }
 async check(){
  if(!this.supported)throw new InputError('QQ_PLATFORM_UNSUPPORTED',409);
  if(this.native)return;
  // Resolve the selected context once, then explicitly bind every command to its local endpoint.
  const context=JSON.parse(await this.docker(['context','inspect'])) as {Endpoints:{docker:{Host:string}}}[];
  const host=context[0]?.Endpoints?.docker?.Host;
  if(typeof host!=='string'||!(/^(unix:\/\/\/|npipe:\/\/\.\/pipe\/)/.test(host)))throw new InputError('QQ_DOCKER_LOCAL_REQUIRED',409);
  this.dockerHost=host;
  if((await this.docker(['info','--format','{{.OSType}}'])).trim()!=='linux')throw new InputError('QQ_DOCKER_LINUX_REQUIRED',409);
 }
 async install(signal:AbortSignal){
  await this.check();
  if(!this.native){await this.docker(['pull',IMAGE],1800000,signal);return;}
  const archive=join(this.directory,'napcat.zip'),dest=join(this.directory,'windows'),staging=join(this.directory,'windows-staging');
  if(existsSync(dest)){if(existsSync(join(dest,'node.exe'))&&existsSync(join(dest,'index.js')))return;throw new InputError('QQ_COMPONENT_INSTALL_INVALID');}
  const response=await fetch(WINDOWS_URL,{signal:AbortSignal.any([signal,AbortSignal.timeout(600000)])});
  if(!response.ok||!response.body)throw new InputError('QQ_COMPONENT_DOWNLOAD');
  const hash=createHash('sha256');let count=0;privateFile(archive);const fd=openSync(archive,'w');
  const reader=response.body.getReader();
  try{for(;;){const {done,value:chunk}=await reader.read();if(done)break;count+=chunk.length;if(count>150_000_000)throw new InputError('QQ_COMPONENT_DOWNLOAD');hash.update(chunk);let offset=0;while(offset<chunk.length)offset+=writeSync(fd,chunk,offset);}if(hash.digest('hex')!==WINDOWS_SHA)throw new InputError('QQ_COMPONENT_CHECKSUM');}finally{closeSync(fd);await reader.cancel();}
  const script=readFileSync(new URL('./unzip.ps1',import.meta.url),'utf8');
  try{
   if(existsSync(staging))rmSync(staging,{recursive:true});privateDirectory(staging);
   const powershell=join(process.env.SystemRoot!,'System32','WindowsPowerShell','v1.0','powershell.exe');
   await exec(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...commandEnvironment(),BFF_ZIP:archive,BFF_DEST:staging},timeout:120000,signal,windowsHide:true,maxBuffer:1000});
   if(!existsSync(join(staging,'node.exe'))||!existsSync(join(staging,'index.js')))throw new InputError('QQ_COMPONENT_INSTALL_INVALID');
   renameSync(staging,dest);
  }catch{throw new InputError('QQ_COMPONENT_INSTALL_INVALID');}finally{rmSync(archive,{force:true});}
 }
 private get name(){return `bigfatfish-qq-${this.state.id}`;}
 private async owned(){
  const names=(await this.docker(['ps','-a','--filter',`name=^/${this.name}$`,'--format','{{.Names}}'])).trim();if(!names)return false;
  const data=JSON.parse(await this.docker(['inspect',this.name]))[0];
  if(data?.Config?.Labels?.['org.bigfatfish.qq']!==this.state.id||data?.Config?.Labels?.['org.bigfatfish.root']!==resolve(this.directory)||data?.Config?.Image!==IMAGE)throw new InputError('QQ_COMPONENT_OWNERSHIP',409);
  return true;
 }
 async start(){
  await this.check();
  if(this.native){
   if(this.child)throw new InputError('QQ_COMPONENT_BUSY',409);
   const directory=join(this.directory,'windows');
   assertRegular(directory,true);const executable=join(directory,'node.exe'),entry=join(directory,'index.js');assertRegular(executable);assertRegular(entry);
   const quote=(value:string)=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';
   const launch=Buffer.from(JSON.stringify({executable,command:`${quote(executable)} ${quote(entry)}`,cwd:directory})).toString('base64');
   const script=readFileSync(new URL('./windows-job.ps1',import.meta.url),'utf8');
   this.child=spawn(join(process.env.SystemRoot!,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:directory,windowsHide:true,env:{...commandEnvironment(),BIGFATFISH_QQ_WINDOWS_LAUNCH:launch,NAPCAT_QQ_DATA_DIR:join(this.directory,'qq'),NAPCAT_WORKDIR:join(this.directory,'work')},stdio:['pipe','ignore','ignore']});
   const child=this.child;await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>{this.child=undefined;reject(new InputError('QQ_COMPONENT_START_FAILED'));});});
   child.once('exit',()=>{if(this.child===child)this.child=undefined;});return;
  }
  if(await this.owned())await this.docker(['rm','-f',this.name]);
  const s=this.state;
  await this.docker(['run','-d','--name',this.name,'--restart=no','--log-driver','none','-e',`NAPCAT_UID=${process.getuid?.()??1000}`,'-e',`NAPCAT_GID=${process.getgid?.()??1000}`,'--label',`org.bigfatfish.qq=${s.id}`,'--label',`org.bigfatfish.root=${resolve(this.directory)}`,'--security-opt','no-new-privileges','--pids-limit','256',
   '-p',`127.0.0.1:${s.webPort}:6099`,'-p',`127.0.0.1:${s.botPort}:3001`,
   '--mount',`type=bind,source=${join(this.directory,'qq')},target=/app/.config/QQ`,
   '--mount',`type=bind,source=${join(this.directory,'work','config')},target=/app/napcat/config`,
   '--mount',`type=bind,source=${join(this.directory,'work','plugins')},target=/app/napcat/plugins`,IMAGE]);
 }
 async stop(){
  if(this.native){const child=this.child;if(!child||child.exitCode!==null||!child.pid)return;
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new InputError('QQ_COMPONENT_STOP_FAILED')),10000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();});this.child=undefined;
  }else{await this.check();if(await this.owned())await this.docker(['rm','-f',this.name]);}
 }
}
