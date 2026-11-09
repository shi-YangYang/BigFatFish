import {mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
mkdirSync('dist/runtime/plugin-catalog',{recursive:true});
rmSync('dist/runtime/plugin-catalog/qq.bff-plugin',{force:true});
for(const id of ['bilibili','douyin']){
 const manifest={protocol:1,id,name:{bilibili:'B站',douyin:'抖音'}[id],version:'0.1.0',author:'BigFatFish contributors',license:'MIT; upstream notices included',source:`BigFatFish bundled plugins/${id}`,runtime:'^0.1.0',platforms:['linux','darwin','win32'],kind:'platform',permissions:[`activity.${id}`],entry:id==='douyin'?'browser-host.mjs':'index.mjs',dependencies:id==='bilibili'?['qrcode']:['playwright-core'],extensions:['Activity'],configSchema:{type:'object',properties:{}},tools:[]};
 const files=[];function walk(dir,prefix=''){for(const name of readdirSync(dir)){if(name.startsWith('.')||name==='__pycache__')continue;const full=join(dir,name),stat=lstatSync(full);if(stat.isSymbolicLink())throw new Error('Link');if(stat.isDirectory())walk(full,prefix+name+'/');else{const bytes=readFileSync(full);files.push({path:prefix+name,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});}}}walk(`plugins/${id}`);if(id==='douyin')walk('services/douyin','services/douyin/');
 writeFileSync(`dist/runtime/plugin-catalog/${id}.bff-plugin`,JSON.stringify({format:'bigfatfish-plugin',manifest,files}));
}
