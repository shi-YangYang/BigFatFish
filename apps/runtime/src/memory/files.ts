import { randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertRegular, privateFile } from '../paths.js';
import { windowsAcl } from '../windows-acl.js';
// Callers choose directory and filename; neither comes from an external path.
export function privateCopy(directory:string,filename:string,content:string){
 const temporary=join(directory,randomUUID()+'.tmp'),file=join(directory,filename);
 try{
  assertRegular(directory,true);mkdirSync(directory,{recursive:true,mode:0o700});
  if(process.platform==='win32')windowsAcl('restrict',[{path:directory,directory:true}]);else chmodSync(directory,0o700);
  assertRegular(file);writeFileSync(temporary,'',{flag:'wx',mode:0o600});privateFile(temporary);writeFileSync(temporary,content);renameSync(temporary,file);return file;
 }finally{if(existsSync(temporary))unlinkSync(temporary);}
}
