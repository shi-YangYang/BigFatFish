import {readFileSync} from 'node:fs';
import { createRuntimeClient } from '../runtime/client.js';
import type {DataPaths} from '../../../runtime/src/paths.js';
import {readInput} from '../io/input.js';
export async function pluginCommand(p:DataPaths,args:string[]) {
 const { request } = createRuntimeClient(p);
 const [, action, id] = args;
 if(action==='list')return request('/v1/plugins');
 if(['inspect','install','update'].includes(action??'')&&id)return request(`/v1/plugins/${action}`,'POST',JSON.parse(readFileSync(id,'utf8')));
 if(!id||!/^[a-z][a-z0-9-]{1,63}$/.test(id))throw new Error('INVALID_ARGUMENTS');
 if(action==='remove')return request(`/v1/plugins/${id}`,'DELETE');
 if(['enable','disable','call'].includes(action??''))return request(`/v1/plugins/${id}/${action}`,'POST',action==='disable'?{}:await readInput());
 throw new Error('INVALID_ARGUMENTS');}
