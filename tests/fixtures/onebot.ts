import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
export async function onebotFixture(){
 const controls={online:true,account:'10001',token:'fixture-token',send:'ok',healthDelay:0,media:'',inlineMedia:false};const requests:{action:string;params:Record<string,unknown>;echo:string}[]=[];
 let loginGate:{entered:()=>void;wait:Promise<void>}|undefined;
 let mediaGate:{entered:()=>void;wait:Promise<void>}|undefined;
 const releases=new Set<()=>void>();
 const pauseNextLogin=()=>{let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),wait=new Promise<void>(r=>{release=()=>{releases.delete(release);r();};});releases.add(release);loginGate={entered,wait};return {reached,release};};
 const pauseNextMedia=()=>{let entered!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{entered=r;}),wait=new Promise<void>(r=>{release=()=>{releases.delete(release);r();};});releases.add(release);mediaGate={entered,wait};return {reached,release};};
 const server=createServer(),wss=new WebSocketServer({noServer:true});const clients=new Set<WebSocket>();
 server.on('upgrade',(req,socket,head)=>{if(req.headers.authorization!==`Bearer ${controls.token}`){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 wss.on('connection',ws=>{clients.add(ws);ws.on('close',()=>clients.delete(ws));ws.on('message',raw=>{const r=JSON.parse(raw.toString());requests.push(r);const reply=(data:unknown,status='ok',retcode=0,echo=r.echo)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({status,retcode,data,echo}));};
  if(r.action==='get_login_info'){const gate=loginGate;loginGate=undefined;if(gate){gate.entered();void gate.wait.then(()=>reply({user_id:controls.account}));}else setTimeout(()=>reply({user_id:controls.account}),controls.healthDelay);}
  else if(r.action==='get_status')reply({online:controls.online,good:true});
  else if(r.action==='get_version_info')reply({app_name:'protocol-fixture'});
  else if(r.action==='get_image'||r.action==='get_file'||r.action==='get_record'){
   // NapCat only returns image bytes when enableLocalFile2Url is set; wav conversion supplies its own bytes.
   const result={file:'/napcat/cache/image',url:'http://127.0.0.1/never-download',file_size:String(Buffer.byteLength(controls.media,'base64')),file_name:'fixture',...(controls.inlineMedia||r.action==='get_record'?{base64:controls.media}:{})};
   const gate=mediaGate;mediaGate=undefined;if(gate){gate.entered();void gate.wait.then(()=>reply(result));}else reply(result);
  }
  else if(r.action==='upload_private_file'||r.action==='upload_group_file')reply({file_id:'fixture-file-id'});
  else if(r.action.startsWith('send_')){if(controls.send==='silent')return;if(controls.send==='disconnect'){ws.close();return;}if(controls.send==='malformed')reply({message_id:'not-an-id'});else if(controls.send==='async')reply(null,'async',1);else if(controls.send==='reject')reply(null,'failed',100);else {reply({message_id:123},'ok',0,'wrong-echo');reply({message_id:String(requests.length)});}}
 });});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`ws://127.0.0.1:${(server.address() as {port:number}).port}`,controls,requests,clients,pauseNextLogin,pauseNextMedia,event:(value:unknown)=>{for(const c of clients)c.send(JSON.stringify(value));},disconnect:()=>{for(const c of clients)c.close();},close:async()=>{for(const release of releases)release();for(const c of clients)c.terminate();await new Promise<void>(r=>wss.close(()=>r()));await new Promise<void>(r=>server.close(()=>r()));}};
}
