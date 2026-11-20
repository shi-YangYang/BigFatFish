import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]??''),out=process.argv[3];if(!out)throw new Error('Usage: node pack-plugin.mjs DIRECTORY OUTPUT');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'))),files=[];
function walk(dir,prefix=''){for(const name of readdirSync(dir)){if(resolve(dir,name)===resolve(out)||name==='manifest.json'||name==='node_modules'||name.startsWith('.'))continue;const path=join(dir,name),relative=prefix+name,stat=lstatSync(path);if(stat.isSymbolicLink())throw new Error('Links not allowed');if(stat.isDirectory())walk(path,relative+'/');else if(stat.isFile()){const bytes=readFileSync(path);files.push({path:relative,sha256:createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')});}}}walk(root);writeFileSync(out,JSON.stringify({format:'bigfatfish-plugin',manifest,files}));
