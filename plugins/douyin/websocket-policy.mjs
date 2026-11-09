import { createServer } from 'node:http';

// PW 1.58 does not route worker WebSockets, and CDP Fetch/blocked URLs do
// not intercept their handshakes. Reject before a target connection exists.
// This owned, loopback-only server NEVER connects upstream or retains payloads.
export async function startWebSocketPolicy(onDenied,onFailure){
 const sockets=new Set();
 const rejectSocket=(_request,socket)=>{
  onDenied();
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
 };
 const server=createServer((_request,response)=>{
  onDenied();response.writeHead(403,{'connection':'close','content-length':'0'}).end();
 });
 server.on('connect',rejectSocket);
 server.on('upgrade',rejectSocket);
 server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});
 server.on('clientError',(_error,socket)=>socket.destroy());
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});
 });
 server.on('error',onFailure);
 const port=server.address().port;
 // Chromium maps both WS and WSS to the nonempty "other" (socks=) list.
 // One rejecting HTTP proxy, NO direct fallback, including loopback/link-local.
 // HTTP/HTTPS reads retain direct networking, not inherited system proxies.
 // https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md
 return {
  args:[`--proxy-server=http=direct://;https=direct://;socks=http://127.0.0.1:${port}`,'--proxy-bypass-list=<-loopback>'],
  async close(){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));},
 };
}
