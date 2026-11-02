// This owner stays asynchronous while the original CLI waits for its workers.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
process.umask(0o077);
const parent=process.ppid;
const child=spawn(process.execPath,[fileURLToPath(new URL('./upstream/tools/bili.mjs',import.meta.url)),...process.argv.slice(2)],{stdio:'inherit'});
const timer=setInterval(()=>{try{process.kill(parent,0);}catch{rmSync(join(process.env.BFF_BILI_DATA_DIR,'.bili-ai','credentials.json'),{force:true});if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});try{process.kill(-process.pid,'SIGKILL');}catch{child.kill('SIGKILL');process.exit(1);}}},1000);
child.on('error',()=>{clearInterval(timer);process.exit(1);});
child.on('exit',code=>{clearInterval(timer);process.exit(code??1);});
