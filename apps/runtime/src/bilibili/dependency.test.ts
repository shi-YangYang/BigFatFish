import { it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paths } from '../paths.js';
import { requestRuntime } from '../connection.js';
vi.mock('./upstream.js',async original=>({...await original<typeof import('./upstream.js')>(),loadBilibili:async()=>{throw Error('missing qrcode');}}));
it('keeps Runtime and local configuration available when the B站 dependency fails to load',async()=>{
 const {startRuntime}=await import('../lifecycle.js');const p=paths(mkdtempSync(join(tmpdir(),'bff bili dependency '))),runtime=await startRuntime(p);
 try{const s=await requestRuntime<{health:{state:string;error:string}}>(runtime.connection,'/v1/bilibili');expect(s.health).toMatchObject({state:'unavailable',error:'BILI_DEPENDENCY_MISSING'});expect(await requestRuntime(runtime.connection,'/v1/persona')).toHaveProperty('name');await expect(requestRuntime(runtime.connection,'/v1/bilibili/search','POST',{query:'fish'})).rejects.toThrow('BILI_DEPENDENCY_MISSING');}finally{await runtime.stop();rmSync(p.root,{recursive:true,force:true});}
});
