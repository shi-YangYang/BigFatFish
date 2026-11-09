import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { startWebSocketPolicy } from './websocket-policy.mjs';
import { join } from 'node:path';

let context;
let stopping=false;
let webSockets;
const notify=message=>{if(process.connected)process.send(message,()=>{});};
async function close(){
 if(stopping)return;stopping=true;
 await context?.close().catch(()=>{});
 await webSockets?.close();
 process.exit();
}
process.on('disconnect',()=>void close());
process.on('SIGTERM',()=>void close());
process.once('message',async options=>{
 try{
  webSockets=await startWebSocketPolicy(()=>notify({webSocketDenied:true}),()=>void close());
  if(stopping){await webSockets.close();return;}
  context=await chromium.launchPersistentContext(options.profile,{
   executablePath:options.executablePath,headless:options.headless,
   viewport:{width:1280,height:900},locale:'zh-CN',serviceWorkers:'block',
   args:['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
    '--autoplay-policy=no-user-gesture-required',...webSockets.args],
  });
  if(stopping){await context.close();return;}
  const [debugPort]=readFileSync(join(options.profile,'DevToolsActivePort'),'utf8').split('\n');
  notify({port:Number(debugPort)});
  context.on('close',()=>void close());
 }catch{notify({error:'BROWSER_LAUNCH_FAILED'});await close();}
});
