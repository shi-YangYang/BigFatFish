import {expect,it} from 'vitest';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
it('CLI shared JSON reader preserves split Chinese and supports explicit media budget only',async()=>{
 async function read(limit:number,large:boolean){const module=pathToFileURL(resolve('dist/cli/src/input.js')).href;const child=spawn(process.execPath,['--input-type=module','-e',`import {readInput} from ${JSON.stringify(module)};try{console.log(JSON.stringify(await readInput(${limit})));}catch(e){console.log(e.message);process.exitCode=1;}`],{stdio:['pipe','pipe','pipe']});let out='';child.stdout.setEncoding('utf8');child.stdout.on('data',s=>out+=s);const bytes=Buffer.from(JSON.stringify({text:'海洋'+(large?'鱼'.repeat(30000):'')})),at=bytes.indexOf(Buffer.from('海'));child.stdin.write(bytes.subarray(0,at+1));await delay(10);child.stdin.end(bytes.subarray(at+1));await new Promise(r=>child.on('close',r));return out;}
 expect(JSON.parse(await read(65536,false)).text).toBe('海洋');expect(await read(65536,true)).toContain('INPUT_TOO_LARGE');expect(JSON.parse(await read(3_000_000,true)).text.length).toBe(30002);
});
