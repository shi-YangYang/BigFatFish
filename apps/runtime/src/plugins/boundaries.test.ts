import {expect,it} from 'vitest';
import {mkdtempSync,readFileSync,rmSync,symlinkSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {paths,preparePaths} from '../paths.js';
import {openDatabase} from '../storage/database.js';
import {Plugins} from './service.js';
import {PluginProcess} from './process.js';
import {validateBundle,hash,type Bundle} from './package.js';
const pack=(code:string,version='1.0.0'):Bundle=>({format:'bigfatfish-plugin',manifest:{...JSON.parse(readFileSync('examples/hello-fish/manifest.json','utf8')),version,permissions:['tools.execute','storage.write','storage.read','media.synthesize']},files:[['index.mjs',code],['host.mjs',readFileSync('plugins/sdk/host.mjs','utf8')]].map(([path,code])=>({path:path!,data:Buffer.from(code!).toString('base64'),sha256:hash(code!)}))});
it('rejects hostile archive/schema/permissions and symlink installation roots',async()=>{const p=paths(mkdtempSync(join(tmpdir(),'bff-plugin-bounds-')));preparePaths(p);const db=openDatabase(p.database),plugins=new Plugins(db,p);try{const valid=pack('');for(const change of [(b:Bundle)=>b.manifest.permissions.push('root'),(b:Bundle)=>{b.manifest.runtime='^2.0.0';},(b:Bundle)=>{b.files[0]!.sha256='bad';},(b:Bundle)=>{b.files[0]!.path='/tmp/a';},(b:Bundle)=>{b.files[0]!.path='node_modules/injected.mjs';}]){const b=structuredClone(valid);change(b);expect(()=>validateBundle(b)).toThrow();}mkdirSync(join(p.data,'other'));symlinkSync(join(p.data,'other'),join(p.data,'plugins'),'dir');await expect(plugins.install(valid)).rejects.toThrow('UNSAFE_DATA_PATH');}finally{await plugins.close();db.close();rmSync(p.root,{recursive:true,force:true});}});
it('rollback preserves old storage; cancellation/completion aborts owned host work; non-owner gets no tools',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-plugin-cancel-')));preparePaths(p);const db=openDatabase(p.database),plugins=new Plugins(db,p);
 const code="import {servePlugin} from './host.mjs';servePlugin({tools:{greet:async(a,c)=>{if(a.name==='slow')return c.host('media.synthesize',{});if(a.name==='error'){void c.host('media.synthesize',{}).catch(()=>{});throw new Error();}if(a.name==='early'){void c.host('media.synthesize',{}).catch(()=>{});return 'early';}return await c.host('storage.get',{key:'value'});}}});";
 try{const b=pack(code);await plugins.install(b);await plugins.enable('hello-fish',b.manifest.permissions,{});expect(plugins.tools('qq-owner:1','owner')).toEqual([]);expect(plugins.tools('local-owner','group')).toEqual([]);
 const bad=pack("import {servePlugin} from './host.mjs';servePlugin({initialize:async(a,c)=>{await c.host('storage.set',{key:'value',value:'candidate pollution'});throw new Error();},tools:{}});",'1.0.1');await expect(plugins.install(bad,true)).rejects.toThrow();expect(await plugins.call('hello-fish','greet',{name:'read'})).toBeNull();
 let began=0,aborted=0;plugins.capability=async(_method,_args,signal)=>{began++;return new Promise((resolve)=>{signal.addEventListener('abort',()=>{aborted++;resolve('aborted');},{once:true});});};
 const control=new AbortController();const slow=plugins.call('hello-fish','greet',{name:'slow'},control.signal);const rejected=expect(slow).rejects.toThrow();for(let i=0;i<100&&began===0;i++)await delay(10);expect(began).toBe(1);control.abort();await rejected;expect(aborted).toBe(1);
 await plugins.enable('hello-fish',b.manifest.permissions,{});expect(await plugins.call('hello-fish','greet',{name:'early'})).toBe('early');for(let i=0;i<100&&aborted<2;i++)await delay(10);expect(aborted).toBe(2);await expect(plugins.call('hello-fish','greet',{name:'error'})).rejects.toThrow('PLUGIN_CALL_FAILED');expect(aborted).toBe(3);
 }finally{await plugins.close();db.close();rmSync(p.root,{recursive:true,force:true});}
});
it('decodes split UTF-8 plugin output without corrupting Chinese',async()=>{const p=paths(mkdtempSync(join(tmpdir(),'bff-plugin-utf8-')));preparePaths(p);const db=openDatabase(p.database),plugins=new Plugins(db,p);try{const code="import {createInterface} from 'node:readline';createInterface({input:process.stdin}).on('line',line=>{const b=JSON.parse(line);const result=Buffer.from(JSON.stringify({id:b.id,result:b.method==='tool'?'海洋生物':{state:'ready'}})+'\\n');const at=result.indexOf(Buffer.from('海'));if(at<0)process.stdout.write(result);else{process.stdout.write(result.subarray(0,at+1));setTimeout(()=>process.stdout.write(result.subarray(at+1)),10);}});";const b=pack(code);await plugins.install(b);await plugins.enable('hello-fish',b.manifest.permissions,{});expect(await plugins.call('hello-fish','greet',{name:'test'})).toBe('海洋生物');}finally{await plugins.close();db.close();rmSync(p.root,{recursive:true,force:true});}});
it('revokes event host operations before delayed dispose during disable/update/remove',async()=>{
 const p=paths(mkdtempSync(join(tmpdir(),'bff-plugin-revoke-')));preparePaths(p);const db=openDatabase(p.database),plugins=new Plugins(db,p);
 const b=pack("import {servePlugin} from './host.mjs';servePlugin({event:async(a,c)=>c.host('media.synthesize',{}),dispose:async()=>new Promise(r=>setTimeout(r,700)),tools:{}});");b.manifest.permissions.push('events.subscribe');
 try{await plugins.install(b);let began=0,aborted=0;plugins.capability=async(_m,_a,signal)=>{began++;return new Promise(resolve=>signal.addEventListener('abort',()=>{aborted++;resolve('aborted');},{once:true}));};
  for(const action of ['disable','update','remove']){await plugins.enable('hello-fish',b.manifest.permissions,{});const event=plugins.event('message',{});const count=began+1;for(let i=0;i<100&&began<count;i++)await delay(10);expect(began).toBe(count);let finished=false;const operation=(action==='disable'?plugins.disable('hello-fish'):action==='remove'?plugins.remove('hello-fish'):plugins.install({...b,manifest:{...b.manifest,version:'1.0.1'}},true)).then(()=>{finished=true;});
   try{await delay(80);expect(aborted).toBe(count);expect(finished).toBe(false);}finally{await operation;await event;}
  }
 }finally{await plugins.close();db.close();rmSync(p.root,{recursive:true,force:true});}
});

it('revokes initialization host work before dispose and denies host calls during cleanup',async()=>{
 const root=mkdtempSync(join(tmpdir(),'bff-plugin-init-revoke-'));writeFileSync(join(root,'host.mjs'),readFileSync('plugins/sdk/host.mjs'));
 writeFileSync(join(root,'index.mjs'),"import {servePlugin} from './host.mjs';let context;servePlugin({initialize:async(a,c)=>{context=c;return c.host('media.synthesize',{});},dispose:async()=>{await new Promise(r=>setTimeout(r,300));await context.host('media.synthesize',{}).catch(()=>{});}});");
 let began=0,aborted=0,exited=false;const child=new PluginProcess(root,'index.mjs',async(_m,_a,signal)=>{began++;return new Promise(resolve=>signal.addEventListener('abort',()=>{aborted++;resolve({});},{once:true}));},()=>{exited=true;});
 try{const initializing=child.call('initialize',{});for(let i=0;i<100&&!began;i++)await delay(10);expect(began).toBe(1);const stopping=child.dispose();expect(aborted).toBe(1);expect(exited).toBe(false);await Promise.allSettled([initializing,stopping]);expect(exited).toBe(true);expect(began).toBe(1);}finally{await child.stop();rmSync(root,{recursive:true,force:true});}
});
