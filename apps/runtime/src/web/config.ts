import {acquireInstance} from '../instance.js';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { preparePaths, privateFile, assertRegular, type DataPaths } from '../paths.js';
export interface WebConfig { origin:string; host:string; port:number; cert:string; key:string; salt:string; hash:string; sessionMs:number }
// Local operator only. The separate web config lives outside movable config/data and is never exported.
export function configureWeb(p:DataPaths,input:Record<string,unknown>){
 const origin=new URL(String(input.origin));
 if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('WEB_HTTPS_REQUIRED');
 const password=String(input.password??'');if(password.length<16||password.length>1024)throw new Error('WEB_PASSWORD_LENGTH');
 const cert=String(input.cert??''),key=String(input.key??'');for(const file of [cert,key]){assertRegular(file);readFileSync(file);}
 const salt=randomBytes(32).toString('hex');const c:WebConfig={origin:origin.origin,host:String(input.host??'127.0.0.1'),port:Number(origin.port||443),cert,key,salt,hash:scryptSync(password,salt,64).toString('hex'),sessionMs:3600000};
 preparePaths(p);let release;try{release=acquireInstance(join(p.runtime,'web-instance.sqlite'));}catch{throw new Error('WEB_STOP_REQUIRED');}try{const file=join(p.runtime,'web-config.json');privateFile(file);writeFileSync(file,JSON.stringify(c));return {configured:true,origin:c.origin};}finally{release();}
}
export function webConfig(p:DataPaths):WebConfig{const file=join(p.runtime,'web-config.json');assertRegular(file);const c=JSON.parse(readFileSync(file,'utf8')) as WebConfig;if(!c.origin.startsWith('https://')||!c.hash||!c.key)throw new Error('WEB_CONFIG_INVALID');return c;}
export function checkPassword(c:WebConfig,value:unknown){if(typeof value!=='string'||value.length>1024)return false;const actual=scryptSync(value,c.salt,64),expected=Buffer.from(c.hash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
