import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ComponentPlatform, DOCKER_ARCHIVES, IMAGE, SOURCE_COMMIT, VERSION, WINDOWS_SHA, WINDOWS_URL, dockerArchiveUrl, overlayWindowsShell, verifyBundle } from '../../apps/runtime/src/channels/managed/platform.js';
import type { ManagedState } from '../../apps/runtime/src/channels/managed/types.js';
const directories:string[]=[];
const make=()=>{const root=mkdtempSync(join(tmpdir(),'bff-vendored-napcat-'));directories.push(root);return root;};
const hash=(data:string)=>createHash('sha256').update(data).digest('hex');
function bundle(root:string){
 const directory=join(root,'bundle'),files:Record<string,string>={};
 for(const [key,value] of Object.entries({'shell/napcat.mjs':"console.log('local source build fixture');",'shell/static/index.html':'fixture', 'shell/native/test.node':'native fixture', 'shell/worker/test.mjs':'export {};','shell/chunk-fixture.js':'export {};','shell/package.json':'{"type":"module"}', 'shell/node_modules/express/package.json':'{"name":"express"}', 'shell/node_modules/ws/package.json':'{"name":"ws"}'})){
  mkdirSync(join(directory,key,'..'),{recursive:true});writeFileSync(join(directory,key),value);files[key]=hash(value);
 }
 writeFileSync(join(directory,'manifest.json'),JSON.stringify({schema:1,version:VERSION,commit:SOURCE_COMMIT,buildKey:'fixture',files}));return directory;
}
const state:ManagedState={id:'a'.repeat(24),webToken:'b'.repeat(64),botToken:'c'.repeat(64),webPort:56099,botPort:53001,installed:true};
const id=`sha256:${'d'.repeat(64)}`;
function platform(root:string){const directory=join(root,'component');mkdirSync(directory);return new ComponentPlatform(directory,{...state},bundle(root));}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
it('verifies local output and rejects changed files',()=>{
 const root=make(),dir=bundle(root);expect(verifyBundle(dir).commit).toBe(SOURCE_COMMIT);
 writeFileSync(join(dir,'shell/napcat.mjs'),'tampered');expect(()=>verifyBundle(dir)).toThrow('QQ_COMPONENT_BUILD_INVALID');
});
it('Windows bootstrap imports the locally built shell without replacing user work or bootstrap',()=>{
 const root=make(),dir=bundle(root),windows=join(root,'windows');mkdirSync(windows);mkdirSync(join(root,'work/config'),{recursive:true});
 writeFileSync(join(root,'work/config/webui.json'),'preserve user');const bootstrap=readFileSync('third_party/napcat/packages/napcat-develop/index.js','utf8');writeFileSync(join(windows,'index.js'),bootstrap);
 overlayWindowsShell(dir,windows);
 expect(readFileSync(join(windows,'napcat/napcat.mjs'),'utf8')).toBe("console.log('local source build fixture');");
 expect(readFileSync(join(windows,'index.js'),'utf8')).toBe(bootstrap);
 expect(execFileSync(process.execPath,[join(windows,'index.js')],{encoding:'utf8'})).toBe('local source build fixture\n');expect(readFileSync(join(root,'work/config/webui.json'),'utf8')).toBe('preserve user');
 expect(existsSync(join(windows,'napcat/config'))).toBe(false);
 expect(WINDOWS_URL).toBe('https://github.com/XingYunStar/NapCatQQ/releases/download/v4.18.42/NapCat.Shell.Windows.Node.zip');
 expect(WINDOWS_SHA).toBe('77397ac38d66f46383e48f08f35d5f9d37ec575c22069f62d6c600e73b4521ed');
});
it('rejects a symlink or junction Windows parent before changing external shell files',()=>{
 const root=make(),dir=bundle(root),outside=join(root,'outside'),windows=join(root,'windows');mkdirSync(join(outside,'napcat'),{recursive:true});
 writeFileSync(join(outside,'napcat/napcat.mjs'),'external original');symlinkSync(outside,windows,process.platform==='win32'?'junction':'dir');
 expect(()=>overlayWindowsShell(dir,windows)).toThrow('UNSAFE_DATA_PATH');
 expect(readFileSync(join(outside,'napcat/napcat.mjs'),'utf8')).toBe('external original');expect(existsSync(join(outside,'napcat-staging'))).toBe(false);
});
it('pins both architecture archives and fails checksum before loading an untrusted download',async()=>{
 expect(dockerArchiveUrl('x64')).toContain('napcat-docker-v4.18.42-amd64.tar');expect(dockerArchiveUrl('arm64')).toContain('napcat-docker-v4.18.42-arm64.tar');
 expect(DOCKER_ARCHIVES.x64.sha256).toBe('85e3fd02b58fd836a0177734b6ff77a896000bcfcf209b3b200d7e8b8452df7c');
 expect(DOCKER_ARCHIVES.arm64.sha256).toBe('0d14594844e9135c760e710754a8778d98649de2ca837fce5a61b69b7d39954d');
 const p=platform(make());Object.defineProperty(p,'native',{value:false});vi.spyOn(p,'check').mockResolvedValue();
 const calls:string[][]=[];vi.spyOn(p as unknown as {docker:(args:string[])=>Promise<string>},'docker').mockImplementation(async(args:string[])=>{calls.push(args);throw new Error('no local image');});
 const download=vi.fn().mockResolvedValue(new Response('untrusted archive'));vi.stubGlobal('fetch',download);
 await expect(p.install(new AbortController().signal)).rejects.toThrow('QQ_COMPONENT_CHECKSUM');
 expect(download.mock.calls[0]?.[0]).toBe(dockerArchiveUrl(process.arch));expect(calls.some(args=>args[0]==='load'||args[0]==='pull')).toBe(false);
 expect(readdirSync(p.directory).some(name=>name.endsWith('.tar'))).toBe(false);
});
it('does not download or create a container when local build is absent',async()=>{
 const root=make(),p=new ComponentPlatform(root,{...state},join(root,'missing'));const check=vi.spyOn(p,'check').mockResolvedValue();
 await expect(p.start()).rejects.toThrow('QQ_COMPONENT_BUILD_INVALID');expect(check).not.toHaveBeenCalled();
});
it.skipIf(process.platform==='win32')('executes Docker CLI using the local digest, all compiled chunks, read-only mounts and exact ownership',async()=>{
 const root=make(),p=platform(root),bin=join(root,'bin'),log=join(root,'docker.jsonl');mkdirSync(bin);
 const executable=join(bin,'docker');
 const architecture=process.arch==='arm64'?'arm64':'amd64';
 writeFileSync(executable,`#!${process.execPath}\nconst fs=require('node:fs');let a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');if(a[0]==='--host')a=a.slice(2);if(a[0]==='context')console.log(JSON.stringify([{Endpoints:{docker:{Host:'unix:///fixture/docker.sock'}}}]));else if(a[0]==='info')console.log('linux');else if(a[0]==='image')console.log(JSON.stringify([{Id:${JSON.stringify(id)},Os:'linux',Architecture:${JSON.stringify(architecture)}}]));else if(a[0]==='ps')console.log('');else if(a[0]==='run')console.log('f'.repeat(64));else process.exit(17);\n`);chmodSync(executable,0o755);vi.stubEnv('PATH',`${bin}:${process.env.PATH}`);
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await p.install(new AbortController().signal);await expect(p.start(undefined,'10001')).resolves.toBe('request-quick-login');
 const calls=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line) as string[]);const run=calls.find(args=>args.includes('run'))!;
 expect(calls.some(args=>args.includes('pull'))).toBe(false);expect(fetcher).not.toHaveBeenCalled();expect(run.at(-1)).toBe(id);expect(run).toContain('--pull=never');
 expect(run.some(arg=>arg.startsWith('ACCOUNT='))).toBe(false);
 expect(run).toContain('127.0.0.1:53001:3001');expect(run).toContain('no-new-privileges');expect(run).toContain('--restart=no');
 expect(run).toContain(`type=bind,source=${join(p.bundle,'shell/napcat.mjs')},target=/app/napcat/napcat.mjs,readonly`);
 expect(run).toContain(`type=bind,source=${join(p.bundle,'shell/chunk-fixture.js')},target=/app/napcat/chunk-fixture.js,readonly`);
 expect(run).toContain(`type=bind,source=${join(p.directory,'work/config')},target=/app/napcat/config`);
 expect(calls.some(args=>args.includes(IMAGE))).toBe(true);
});
it('rejects an unrelated same-name container even if its labels match',async()=>{
 const p=platform(make());Object.defineProperty(p,'native',{value:false});vi.spyOn(p,'check').mockResolvedValue();
 const docker=vi.spyOn(p as unknown as {docker:(args:string[])=>Promise<string>},'docker').mockImplementation(async(args:string[])=>{
  if(args[0]==='image')return JSON.stringify([{Id:id,Os:'linux',Architecture:process.arch==='arm64'?'arm64':'amd64'}]);
  if(args[0]==='ps')return 'bigfatfish-qq-'+state.id;
  if(args[0]==='inspect')return JSON.stringify([{Config:{Image:'attacker/napcat:latest',Labels:{'org.bigfatfish.qq':state.id,'org.bigfatfish.root':p.directory}}}]);
  throw new Error('must not mutate');
 });
 await expect(p.start()).rejects.toThrow('QQ_COMPONENT_OWNERSHIP');expect(docker.mock.calls.some(([args])=>(args as string[])[0]==='rm')).toBe(false);
});
it('reuses a stopped compatible container across the first scan, and replaces only an incompatible owned deployment',async()=>{
 const p=platform(make());Object.defineProperty(p,'native',{value:false});vi.spyOn(p,'check').mockResolvedValue();
 const containerId='f'.repeat(64),calls:string[][]=[];let exists=false,running=false;
 let availableImage=id,containerImage=id,reportedContainerId=containerId,failRemove=false,failRun=false;
 let env:string[]=[],build='fixture',mounts:{Type:string;Target:string;Source:string;ReadOnly:boolean}[]=[];
 vi.spyOn(p as unknown as {docker:(args:string[])=>Promise<string>},'docker').mockImplementation(async(args:string[])=>{
  calls.push(args);const [op]=args;
  if(op==='image')return JSON.stringify([{Id:availableImage,Os:'linux',Architecture:process.arch==='arm64'?'arm64':'amd64'}]);
  if(op==='ps')return exists?'bigfatfish-qq-'+state.id:'';
  if(op==='inspect')return JSON.stringify([{Id:reportedContainerId,Image:containerImage,Config:{Image:containerImage,Env:env,Labels:{'org.bigfatfish.qq':state.id,'org.bigfatfish.root':p.directory,'org.bigfatfish.bundle':build}},State:{Running:running},
   HostConfig:{NetworkMode:'default',PidsLimit:256,RestartPolicy:{Name:'no'},SecurityOpt:['no-new-privileges'],Mounts:mounts,PortBindings:{'6099/tcp':[{HostIp:'127.0.0.1',HostPort:String(state.webPort)}],'3001/tcp':[{HostIp:'127.0.0.1',HostPort:String(state.botPort)}]}}}]);
  if(op==='run'){
   mounts=args.flatMap((x,i)=>x==='--mount'?[args[i+1]!]:[]).map(x=>({Type:'bind',Target:x.match(/,target=([^,]+)/)![1]!,Source:x.match(/,source=([^,]+)/)![1]!,ReadOnly:x.endsWith(',readonly')}));
   env=args.flatMap((x,i)=>x==='-e'?[args[i+1]!]:[]);running=exists=true;containerImage=availableImage;
   if(failRun){running=false;reportedContainerId='2'.repeat(64);build='fixture';throw new Error('port busy');}return reportedContainerId;
  }else if(op==='stop'){expect(args.at(-1)).toBe(containerId);running=false;}
  else if(op==='start'){expect(args[1]).toBe(reportedContainerId);running=true;}
  else if(op==='rm'){expect(running).toBe(false);expect(args).toEqual(['rm',containerId]);if(failRemove)throw new Error('rm failed');exists=false;}
  else if(op!=='exec')throw new Error('unexpected '+op);
  return '';
 });
 await p.start();await p.stop();
 await expect(p.start(undefined,'10001')).resolves.toBe('request-quick-login');
 expect(calls.filter(x=>x[0]==='start')).toHaveLength(1);expect(calls.filter(x=>x[0]==='run')).toHaveLength(1);
 expect(calls.some(x=>x[0]==='rm')).toBe(false);
 const terminate=calls.find(x=>x[0]==='exec');
 expect(terminate?.slice(0,4)).toEqual(['exec','--user',`${process.getuid?.()??1000}:${process.getgid?.()??1000}`,containerId]);
 expect(terminate?.at(-1)).toContain('= /opt/QQ/qq');
 // A legacy container already asking for the same account must not receive a second login request.
 env.push('ACCOUNT=10001');build='';
 await p.stop();await expect(p.start(undefined,'10001')).resolves.toBeUndefined();
 expect(calls.filter(x=>x[0]==='run')).toHaveLength(1);
 // A changed bundle cannot leave obsolete per-file source mounts in use.
 build='previous-bundle';await p.stop();await p.start(undefined,'10001');
 expect(calls.filter(x=>x[0]==='run')).toHaveLength(2);expect(calls.filter(x=>x[0]==='rm')).toHaveLength(1);
 // Even with matching labels, an obsolete image requires a private record binding both exact IDs.
 await p.stop();availableImage='sha256:'+'e'.repeat(64);
 const file=join(p.directory,'container.json'),original=readFileSync(file,'utf8');rmSync(file);
 await expect(p.start()).rejects.toThrow('QQ_COMPONENT_OWNERSHIP');
 writeFileSync(file,original,{mode:0o600});reportedContainerId='0'.repeat(64);
 await expect(p.start()).rejects.toThrow('QQ_COMPONENT_OWNERSHIP');
 reportedContainerId=containerId;await p.start();
 expect(calls.filter(x=>x[0]==='rm')).toHaveLength(2);
 expect(JSON.parse(readFileSync(file,'utf8')).image).toBe(availableImage);
 // A failed removal keeps its receipt. A successful removal followed by a failed port bind must
 // leave the replacement discoverable through the normal trusted-current-image migration path.
 failRemove=true;await expect(p.start()).rejects.toThrow('rm failed');expect(existsSync(file)).toBe(true);
 failRemove=false;failRun=true;await expect(p.start()).rejects.toThrow('port busy');expect(existsSync(file)).toBe(false);
 failRun=false;await p.start();expect(JSON.parse(readFileSync(file,'utf8')).container).toBe(reportedContainerId);
});
