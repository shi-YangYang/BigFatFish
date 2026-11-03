import {updateCommand} from './update.js';
import { configureWeb, webConfig } from '../../runtime/src/web/config.js';
import { createWeb } from '../../runtime/src/web/server.js';
import type { DataPaths } from '../../runtime/src/paths.js';
import { readInput } from './maintenance.js';
import { start, stop } from './process.js';
export async function webCommand(p:DataPaths,args:string[]){
 if(args[1]==='configure')return configureWeb(p,await readInput());
 if(args[1]!=='serve')throw new Error('INVALID_ARGUMENTS');
 const c=webConfig(p);await start(p,0);const app=await createWeb(p,c,{start:()=>start(p,0),stop:()=>stop(p),update:action=>updateCommand(p,['update',action])});
 const close=()=>void app.close();process.once('SIGTERM',close);process.once('SIGINT',close);
 try{await app.listen({host:c.host,port:c.port});}catch(e){await app.close();throw e;}return {origin:c.origin,state:'listening'};
}
