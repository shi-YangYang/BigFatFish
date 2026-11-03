import {readFileSync} from 'node:fs';
import {readConnection,requestRuntime} from '../../runtime/src/connection.js';
import type {DataPaths} from '../../runtime/src/paths.js';
import {readInput} from './maintenance.js';
export async function pluginCommand(p:DataPaths,args:string[]){const c=readConnection(p),[,action,id]=args;
 if(action==='list')return requestRuntime(c,'/v1/plugins');
 if(['inspect','install','update'].includes(action??'')&&id)return requestRuntime(c,`/v1/plugins/${action}`,'POST',JSON.parse(readFileSync(id,'utf8')));
 if(!id||!/^[a-z][a-z0-9-]{1,63}$/.test(id))throw new Error('INVALID_ARGUMENTS');
 if(action==='remove')return requestRuntime(c,`/v1/plugins/${id}`,'DELETE');
 if(['enable','disable','call'].includes(action??''))return requestRuntime(c,`/v1/plugins/${id}/${action}`,'POST',action==='disable'?{}:await readInput());
 throw new Error('INVALID_ARGUMENTS');}
export async function mediaCommand(p:DataPaths,args:string[]){if(!['transcribe','synthesize'].includes(args[1]??''))throw new Error('INVALID_ARGUMENTS');return requestRuntime(readConnection(p),`/v1/media/${args[1]}`,'POST',await readInput(3_000_000));}
