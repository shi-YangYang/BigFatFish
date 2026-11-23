import { execFile,spawn,type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,openSync,closeSync,writeSync,cpSync,lstatSync,readdirSync,createReadStream } from 'node:fs';
import { join,resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { InputError } from '../../ai/types.js';
import { stableId } from '../protocol.js';
import { windowsAcl } from '../../permissions/windows-acl.js';
import { assertRegular,privateFile } from '../../storage/paths.js';
import type { ManagedState } from './types.js';
const exec=promisify(execFile);
export const VERSION='4.18.42';
export const IMAGE='mlikiowa/napcat-docker@sha256:696e9574a0f6fb2f86cbecba8a32048f2a5823117dc9b13c6c02637ad890fa8b';
export const WINDOWS_SHA='77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed';
export const WINDOWS_URL=`https://github.com/XingYunStar/NapCatQQ/releases/download/v${VERSION}/NapCat.Shell.Windows.Node.zip`;
export const SOURCE_COMMIT='9335843246e3b7a17944861f3ac8731a259732c2';
export const DOCKER_ARCHIVES={
 x64:{name:'amd64',bytes:612216320,sha256:'85e3fd02b58fd836a0177734b6ff77a896000bcfcf209b3b200d7e8b8452df7c'},
 arm64:{name:'arm64',bytes:597573632,sha256:'0d14594844e9135c760e710754a8778d98649de2ca837fce5a61b69b7d39954d'},
} as const;
const archiveFor=(arch:NodeJS.Architecture)=>{if(arch!=='x64'&&arch!=='arm64')throw new InputError('QQ_PLATFORM_UNSUPPORTED');return DOCKER_ARCHIVES[arch];};
export const dockerArchiveUrl=(arch:NodeJS.Architecture)=>`https://github.com/XingYunStar/NapCatQQ/releases/download/v${VERSION}/napcat-docker-v${VERSION}-${archiveFor(arch).name}.tar`;
interface BundleManifest {schema:number;version:string;commit:string;buildKey:string;files:Record<string,string>}
/** Verify packaged local output, including native resources and production dependencies. */
export function verifyBundle(directory:string):BundleManifest {
 try{
  const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')) as BundleManifest;
  if(manifest.schema!==1||manifest.version!==VERSION||manifest.commit!==SOURCE_COMMIT||!manifest.files?.['shell/napcat.mjs'])throw new Error();
  const actual:string[]=[];
  const walk=(relative:string)=>{for(const name of readdirSync(join(directory,relative))){const key=relative?`${relative}/${name}`:name,path=join(directory,key),stat=lstatSync(path);if(stat.isDirectory())walk(key);else if(stat.isFile())actual.push(key);else throw new Error();}};
  if(!lstatSync(directory).isDirectory()||lstatSync(directory).isSymbolicLink())throw new Error();walk('');
  if(actual.filter(key=>key!=='manifest.json').sort().join('\n')!==Object.keys(manifest.files).sort().join('\n'))throw new Error();
  for(const [key,hash] of Object.entries(manifest.files)){
   if(!/^[a-zA-Z0-9_@.+/-]+$/.test(key)||key.split('/').some(part=>!part||part==='..')||!/^[a-f0-9]{64}$/.test(hash))throw new Error();
   if(createHash('sha256').update(readFileSync(join(directory,key))).digest('hex')!==hash)throw new Error();
  }
  for(const key of ['shell/napcat.mjs','shell/static/index.html','shell/node_modules/express/package.json','shell/node_modules/ws/package.json'])if(!manifest.files[key])throw new Error();
  return manifest;
 }catch{throw new InputError('QQ_COMPONENT_BUILD_INVALID',409);}
}
export function overlayWindowsShell(bundle:string,directory:string){
 assertRegular(directory,true);verifyBundle(bundle);
 // This directory holds only program files; config, plugins and QQ data stay in work/ and qq/.
 const destination=join(directory,'napcat'),staging=join(directory,'napcat-staging');
 assertRegular(destination,true);assertRegular(staging,true);
 rmSync(staging,{recursive:true,force:true});cpSync(join(bundle,'shell'),staging,{recursive:true});
 rmSync(destination,{recursive:true,force:true});renameSync(staging,destination);
}
async function checksum(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
async function download(url:string,path:string,expected:string,limit:number,signal:AbortSignal){
 const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(1800000)])});
 if(!response.ok||!response.body)throw new InputError('QQ_COMPONENT_DOWNLOAD');
 const hash=createHash('sha256');let count=0;privateFile(path);const fd=openSync(path,'w'),reader=response.body.getReader();
 try{for(;;){const {done,value:chunk}=await reader.read();if(done)break;count+=chunk.length;if(count>limit)throw new InputError('QQ_COMPONENT_DOWNLOAD');hash.update(chunk);let offset=0;while(offset<chunk.length)offset+=writeSync(fd,chunk,offset);}if(hash.digest('hex')!==expected)throw new InputError('QQ_COMPONENT_CHECKSUM');}
 finally{closeSync(fd);await reader.cancel();}
}
export function privateDirectory(path:string){assertRegular(path,true);mkdirSync(path,{recursive:true,mode:0o700});if(process.platform==='win32')windowsAcl('restrict',[{path,directory:true}]);}
export function writePrivate(path:string,value:unknown){privateFile(path);writeFileSync(path,JSON.stringify(value));}
function commandEnvironment(){const result:NodeJS.ProcessEnv={};for(const key of ['PATH','HOME','USERPROFILE','SystemRoot','WINDIR','LOCALAPPDATA','APPDATA','TEMP','TMP','DOCKER_CONFIG'])if(process.env[key])result[key]=process.env[key];return result;}
interface BindMount {Source:string;Target:string;ReadOnly?:boolean}
interface DockerComponent {
 Id:string;Image:string;State:{Running:boolean};Config:{Env?:string[];Labels:Record<string,string>};
 HostConfig:{Mounts?:Array<BindMount&{Type:string}>;Binds?:string[];PortBindings?:Record<string,Array<{HostIp:string;HostPort:string}>>;
   Privileged?:boolean;PidMode?:string;NetworkMode:string;PidsLimit:number;SecurityOpt?:string[];RestartPolicy:{Name:string}};
}
function compatible(old:DockerComponent,image:string,state:ManagedState,mounts:BindMount[],buildKey:string){
 const h=old.HostConfig,bindings=h?.PortBindings,actual=h?.Mounts,bundle=old.Config.Labels['org.bigfatfish.bundle'];
 const port=(key:string,value:number)=>bindings?.[key]?.length===1&&bindings[key][0]?.HostIp==='127.0.0.1'&&bindings[key][0]?.HostPort===String(value);
 return old.Image===image&&(!bundle||bundle===buildKey)&&!h?.Privileged&&!h.PidMode&&['default','bridge'].includes(h?.NetworkMode)&&
  h.PidsLimit===256&&h.SecurityOpt?.includes('no-new-privileges')&&h.RestartPolicy?.Name==='no'&&
  !!bindings&&Object.keys(bindings).length===2&&port('6099/tcp',state.webPort)&&port('3001/tcp',state.botPort)&&
  !h.Binds?.length&&actual?.length===mounts.length&&mounts.every(m=>actual.some(a=>a.Type==='bind'&&a.Source===m.Source&&a.Target===m.Target&&!!a.ReadOnly===!!m.ReadOnly));
}
export class ComponentPlatform {
 readonly native=process.platform==='win32';readonly supported=this.native?process.arch==='x64':['darwin','linux'].includes(process.platform)&&['arm64','x64'].includes(process.arch);
 private child?:ChildProcess;private dockerHost='';private image=IMAGE;
 constructor(readonly directory:string,private state:ManagedState,readonly bundle=fileURLToPath(new URL('./napcat',import.meta.url))){}
 private async docker(args:string[],timeout=15000,signal?:AbortSignal){
  try{return (await exec('docker',[...(this.dockerHost?['--host',this.dockerHost]:[]),...args],{env:commandEnvironment(),encoding:'utf8',timeout,maxBuffer:2_000_000,windowsHide:true,signal})).stdout;}
  catch(error){if(signal?.aborted)throw new InputError('CANCELLED');if(['run','start'].includes(args[0]??'')&&/port is already allocated|address already in use|ports are not available/i.test(String((error as {stderr?:string}).stderr)))throw new InputError('QQ_COMPONENT_PORT_BUSY',409);throw new InputError((error as NodeJS.ErrnoException).code==='ENOENT'?'QQ_DOCKER_MISSING':'QQ_DOCKER_FAILED',409);}
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
 private async inspectImage(reference:string){
  try{const data=JSON.parse(await this.docker(['image','inspect',reference]))[0];
   if(!/^sha256:[a-f0-9]{64}$/.test(data?.Id)||data?.Os!=='linux'||data?.Architecture!==archiveFor(process.arch).name)return undefined;
   return data.Id as string;
  }catch{return undefined;}
 }
 private async ensureImage(signal:AbortSignal){
  signal.throwIfAborted();const selected=archiveFor(process.arch),record=join(this.directory,'image.json');assertRegular(record);
  // The old digest is a trusted migration source, never an arbitrary same-name tag.
  const legacy=await this.inspectImage(IMAGE);
  if(legacy){this.image=legacy;return;}
  if(existsSync(record)){
   const saved=JSON.parse(readFileSync(record,'utf8')) as {id:string;archiveSha256:string};
   if(saved.archiveSha256===selected.sha256&&/^sha256:[a-f0-9]{64}$/.test(saved.id)&&await this.inspectImage(saved.id)===saved.id){this.image=saved.id;return;}
  }
  const archive=join(this.directory,`napcat-${selected.name}.tar`);assertRegular(archive);
  try{
   if(!existsSync(archive)||await checksum(archive)!==selected.sha256)await download(dockerArchiveUrl(process.arch),archive,selected.sha256,selected.bytes,signal);
   // Docker save exports a content-addressed config. Derive the ID only after archive verification.
   const manifest=JSON.parse((await exec('tar',['-xOf',archive,'manifest.json'],{encoding:'utf8',maxBuffer:100000,signal})).stdout) as {Config:string}[];
   const config=manifest.length===1?manifest[0]?.Config:'';
   const match=/^(?:blobs\/sha256\/)?([a-f0-9]{64})(?:\.json)?$/.exec(config??'');
   if(!match)throw new InputError('QQ_COMPONENT_INSTALL_INVALID');
   const id=`sha256:${match[1]}`;
   await this.docker(['load','--input',archive],1800000,signal);
   if(await this.inspectImage(id)!==id)throw new InputError('QQ_COMPONENT_INSTALL_INVALID');
   writePrivate(record,{id,archiveSha256:selected.sha256});this.image=id;
  }finally{rmSync(archive,{force:true});}
 }
 async install(signal:AbortSignal){
  verifyBundle(this.bundle);await this.check();
  if(!this.native){await this.ensureImage(signal);return;}
  const archive=join(this.directory,'napcat.zip'),dest=join(this.directory,'windows'),staging=join(this.directory,'windows-staging');
  if(existsSync(dest)){
   if(!existsSync(join(dest,'node.exe'))||!existsSync(join(dest,'index.js')))throw new InputError('QQ_COMPONENT_INSTALL_INVALID');
   overlayWindowsShell(this.bundle,dest);return;
  }
  try{
   await download(WINDOWS_URL,archive,WINDOWS_SHA,150_000_000,signal);
   const script=readFileSync(new URL('./unzip.ps1',import.meta.url),'utf8');
   if(existsSync(staging))rmSync(staging,{recursive:true});privateDirectory(staging);
   const powershell=join(process.env.SystemRoot!,'System32','WindowsPowerShell','v1.0','powershell.exe');
   await exec(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{env:{...commandEnvironment(),BFF_ZIP:archive,BFF_DEST:staging},timeout:120000,signal,windowsHide:true,maxBuffer:1000});
   if(!existsSync(join(staging,'node.exe'))||!existsSync(join(staging,'index.js')))throw new InputError('QQ_COMPONENT_INSTALL_INVALID');
   overlayWindowsShell(this.bundle,staging);renameSync(staging,dest);
  }finally{rmSync(archive,{force:true});rmSync(staging,{recursive:true,force:true});}
 }
 private get name(){return `bigfatfish-qq-${this.state.id}`;}
 // Docker config/image IDs can change on upgrade. Pin the exact instance locally rather than
 // trusting a container's name or its self-reported labels when its image is no longer current.
 private get containerRecord(){return join(this.directory,'container.json');}
 private rememberContainer(container:string,image:string){
  if(!/^[0-9a-f]{64}$/.test(container)||!/^sha256:[0-9a-f]{64}$/.test(image))throw new InputError('QQ_COMPONENT_OWNERSHIP',409);
  const file=this.containerRecord,tmp=file+'.tmp';assertRegular(file);
  writePrivate(tmp,{component:this.state.id,root:resolve(this.directory),container,image});renameSync(tmp,file);
 }
 private hasContainerRecord(container:string,image:string){
  const reject=()=>new InputError('QQ_COMPONENT_OWNERSHIP',409);
  const file=this.containerRecord;assertRegular(file);
  if(!existsSync(file))return false;
  if(process.platform!=='win32'&&(lstatSync(file).mode&0o077)!==0)throw reject();
  const record=(()=>{try{return JSON.parse(readFileSync(file,'utf8'));}catch{throw reject();}})();
  if(record?.component!==this.state.id||record.root!==resolve(this.directory)||record.container!==container||record.image!==image)throw reject();
  return true;
 }
 private async owned(){
  const names=(await this.docker(['ps','-a','--filter',`name=^/${this.name}$`,'--format','{{.Names}}'])).trim();if(!names)return undefined;
  const data=JSON.parse(await this.docker(['inspect',this.name]))[0];
  const reject=()=>new InputError('QQ_COMPONENT_OWNERSHIP',409);
  if(data?.Config?.Labels?.['org.bigfatfish.qq']!==this.state.id||data.Config.Labels['org.bigfatfish.root']!==resolve(this.directory)||
     !/^[0-9a-f]{64}$/.test(data.Id??'')||!/^sha256:[0-9a-f]{64}$/.test(data.Image??''))throw reject();
  if(!this.hasContainerRecord(data.Id,data.Image)){
   // Migration for installs predating the record requires the currently trusted image, too.
   if(data.Image!==this.image||![IMAGE,this.image].includes(data.Config.Image))throw reject();
   this.rememberContainer(data.Id,data.Image);
  }
  return data as DockerComponent;
 }
 private async stopOwned(container:DockerComponent){
  if(!container.State.Running)return;
  // The pinned image's PID 1 is bash, not QQ. Signal only its exact QQ child in a private PID
  // namespace, as the account running QQ, so a normal restart gives the client time to close.
  if(container.HostConfig&&!container.HostConfig.Privileged&&!container.HostConfig.PidMode){
   const numericId=(key:string)=>{
    const entries=container.Config.Env?.filter(item=>item.startsWith(key+'='));
    const value=entries?.length===1?entries[0]!.slice(key.length+1):'';
    return /^(0|[1-9]\d{0,9})$/.test(value)&&Number(value)<0xffffffff?value:undefined;
   };
   const uid=numericId('NAPCAT_UID'),gid=numericId('NAPCAT_GID');
   if(uid!==undefined&&gid!==undefined)await this.docker(['exec','--user',uid+':'+gid,container.Id,'/bin/sh','-c',[
    'for p in $(cat /proc/1/task/1/children); do',
    ' [ "$(readlink /proc/$p/exe)" = /opt/QQ/qq ] || continue',
    ' kill -TERM "$p" || break',
    ' for i in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$p" 2>/dev/null || break; sleep 0.25; done',
    ' break','done',
   ].join('\n')],4000).catch(()=>{}); // PID 1 can exit while docker exec is completing.
  }
  await this.docker(['stop','--time','4',container.Id]);
 }
 async start(signal:AbortSignal=new AbortController().signal,restartAccount?:string):Promise<void|'request-quick-login'>{
  const account=restartAccount===undefined?undefined:stableId(restartAccount);
  const manifest=verifyBundle(this.bundle);await this.check();
  if(this.native){
   if(this.child)throw new InputError('QQ_COMPONENT_BUSY',409);
   const directory=join(this.directory,'windows');
   overlayWindowsShell(this.bundle,directory);
   assertRegular(directory,true);const executable=join(directory,'node.exe'),entry=join(directory,'index.js');assertRegular(executable);assertRegular(entry);
   const quote=(value:string)=>'"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';
   const launch=Buffer.from(JSON.stringify({executable,command:[quote(executable),quote(entry),...(account?['-q',account]:[])].join(' '),cwd:directory})).toString('base64');
   const script=readFileSync(new URL('./windows-job.ps1',import.meta.url),'utf8');
   this.child=spawn(join(process.env.SystemRoot!,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cwd:directory,windowsHide:true,env:{...commandEnvironment(),BIGFATFISH_QQ_WINDOWS_LAUNCH:launch,NAPCAT_QQ_DATA_DIR:join(this.directory,'qq'),NAPCAT_WORKDIR:join(this.directory,'work')},stdio:['pipe','ignore','ignore']});
   const child=this.child;await new Promise<void>((resolve,reject)=>{child.once('spawn',resolve);child.once('error',()=>{this.child=undefined;reject(new InputError('QQ_COMPONENT_START_FAILED'));});});
   child.once('exit',()=>{if(this.child===child)this.child=undefined;});return;
  }
  await this.ensureImage(signal);
  const s=this.state,shell=join(this.bundle,'shell');
  const mounts:BindMount[]=[
   {Source:join(this.directory,'qq'),Target:'/app/.config/QQ'}, {Source:join(this.directory,'work/config'),Target:'/app/napcat/config'},
   {Source:join(this.directory,'work/plugins'),Target:'/app/napcat/plugins'},
   ...readdirSync(shell).filter(name=>name.endsWith('.mjs')||name.endsWith('.js')||['native','static','worker','node_modules','package.json'].includes(name)).map(name=>({Source:join(shell,name),Target:'/app/napcat/'+name,ReadOnly:true})),
  ];
  const old=await this.owned(),legacyAccount=old?.Config.Env?.find(item=>item.startsWith('ACCOUNT='))?.slice(8);
  if(old){
   await this.stopOwned(old);signal.throwIfAborted();
   if((!legacyAccount||legacyAccount===account)&&compatible(old,this.image,s,mounts,manifest.buildKey)){
    await this.docker(['start',old.Id],15000,signal);
    return !legacyAccount&&account?'request-quick-login':undefined;
   }
   // A new image, different bundle mounts or an obsolete fixed account requires replacement.
   await this.docker(['rm',old.Id]);
   if(this.hasContainerRecord(old.Id,old.Image))rmSync(this.containerRecord,{force:true});
  }
  const created=await this.docker(['run','-d','--pull=never','--name',this.name,'--restart=no','--log-driver','none','-e',`NAPCAT_UID=${process.getuid?.()??1000}`,'-e',`NAPCAT_GID=${process.getgid?.()??1000}`,'--label',`org.bigfatfish.qq=${s.id}`,'--label',`org.bigfatfish.root=${resolve(this.directory)}`,'--label',`org.bigfatfish.bundle=${manifest.buildKey}`,'--security-opt','no-new-privileges','--pids-limit','256',
   '-p',`127.0.0.1:${s.webPort}:6099`,'-p',`127.0.0.1:${s.botPort}:3001`,
   ...mounts.flatMap(m=>['--mount',`type=bind,source=${m.Source},target=${m.Target}${m.ReadOnly?',readonly':''}`]),this.image],15000,signal);
  this.rememberContainer(created.trim(),this.image);
  return account?'request-quick-login':undefined;
 }
 async stop(){
  if(this.native){const child=this.child;if(!child||child.exitCode!==null||!child.pid)return;
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new InputError('QQ_COMPONENT_STOP_FAILED')),10000);child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill();});this.child=undefined;
  }else{await this.check();const record=join(this.directory,'image.json');assertRegular(record);if(existsSync(record)){const saved=JSON.parse(readFileSync(record,'utf8'));if(saved.archiveSha256===archiveFor(process.arch).sha256&&/^sha256:[a-f0-9]{64}$/.test(saved.id))this.image=saved.id;}else this.image=await this.inspectImage(IMAGE)??IMAGE;const owned=await this.owned();if(owned)await this.stopOwned(owned);}
 }
}
