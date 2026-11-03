import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
export const manifest = Object.freeze({ id:'qq', name:'QQ', version:'0.1.0', source:'BigFatFish built-in', license:'MIT', platforms:['darwin','win32','linux'], permissions:['messages.receive','messages.reply','messages.proactive.approval'], dependency:'External NapCat / OneBot 11 forward WebSocket', configSchema:{type:'object',required:['url','accountId','ownerId','groups'],properties:{url:{type:'string'},accountId:{type:'string'},ownerId:{type:'string'},groups:{type:'array',items:{type:'string'}},enabled:{type:'boolean'},replyEnabled:{type:'boolean'},proactiveEnabled:{type:'boolean'}}} });
export class QQPlugin {
  pending = new Map(); state = {state:'stopped'}; attempt = 0; generation = 0;
  initialize(host) { this.host = host; }
  health() { return {...this.state}; }
  update(state,error) { this.state={state,...(error?{error}:{})};this.host?.status(this.health()); }
  start(config) { this.stop();this.config=config;this.active=true;this.connect(this.generation); }
  connect(generation) {
    if(!this.active || generation!==this.generation)return;
    this.update(this.attempt?'reconnecting':'connecting');
    let socket;
    try {socket=new WebSocket(this.config.url,{headers:this.config.token?{Authorization:`Bearer ${this.config.token}`}:{},maxPayload:3_000_000,handshakeTimeout:5000,followRedirects:false});}
    catch(error) {
      // A bad channel transport configuration must remain repairable through the
      // local Runtime. Do not retry synchronous initialization failures.
      this.active=false;
      this.update('error',['ERR_INVALID_CHAR','ERR_HTTP_INVALID_HEADER_VALUE'].includes(error.code)?'INVALID_TOKEN':'CONNECTION_INIT_FAILED');
      return;
    }
    this.socket=socket;
    socket.on('open',()=>{void this.probe(generation,socket);});
    socket.on('message',raw=>{
      if(generation!==this.generation || socket!==this.socket)return;
      let value;try{value=JSON.parse(raw.toString());}catch{return;}
      if(!value || typeof value!=='object')return;
      if(typeof value.echo==='string'){
        const p=this.pending.get(value.echo);if(!p)return;this.pending.delete(value.echo);clearTimeout(p.timer);
        if(value.status==='ok'&&value.retcode===0)p.resolve(value.data);
        else p.reject(new Error(value.status==='async'||value.retcode===1?'SEND_UNKNOWN':'ACTION_REJECTED'));
      }else if(this.state.state==='online')this.host.event(value);
    });
    socket.on('unexpected-response',(_req,res)=>{res.resume();if(res.statusCode===401||res.statusCode===403){this.active=false;this.update('error','TOKEN_REJECTED');}socket.terminate();});
    socket.on('error',()=>{});
    socket.on('close',()=>{
      if(generation!==this.generation || socket!==this.socket)return;
      this.rejectPending();clearTimeout(this.probeTimer);
      if(!this.active)return;
      this.update('reconnecting','CONNECTION_LOST');
      this.retry=setTimeout(()=>this.connect(generation),Math.min(30000,500*2**Math.min(this.attempt++,6)));
    });
  }
  async probe(generation,socket) {
    try {
      const login=await this.request('get_login_info',{}),status=await this.request('get_status',{});
      if(generation!==this.generation||socket!==this.socket)return;
      const id=typeof login?.user_id==='string'?login.user_id:Number.isSafeInteger(login?.user_id)?String(login.user_id):'';
      if(id!==this.config.accountId){this.active=false;this.update('error','ACCOUNT_MISMATCH');socket.close();return;}
      if(status?.online!==true){this.update('not_logged_in','LOGIN_REQUIRED');}
      else {this.attempt=0;this.update('online');}
      // Version is diagnostic; it cannot make an unauthenticated account online.
      if(!this.version){try{const info=await this.request('get_version_info',{});if(typeof info?.app_name==='string')this.version=info.app_name.slice(0,80);}catch{ /* Optional diagnostic. */ }}
    }catch(error){
      if(generation!==this.generation||socket!==this.socket||socket.readyState!==WebSocket.OPEN)return;
      if(error.message==='SEND_UNKNOWN'||error.message==='NOT_CONNECTED'){this.update('reconnecting','HEALTH_CHECK_FAILED');socket.terminate();return;}
      this.update('not_logged_in','HEALTH_CHECK_FAILED');
    }
    if(this.active&&generation===this.generation&&socket===this.socket&&socket.readyState===WebSocket.OPEN)this.probeTimer=setTimeout(()=>void this.probe(generation,socket),5000);
  }
  request(action,params,timeoutMs=5000) {
    if(this.socket?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('NOT_CONNECTED'));
    const echo=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(echo);reject(new Error('SEND_UNKNOWN'));},timeoutMs);
      this.pending.set(echo,{resolve,reject,timer});
      this.socket.send(JSON.stringify({action,params,echo}),error=>{if(error){clearTimeout(timer);this.pending.delete(echo);reject(new Error('SEND_UNKNOWN'));}});
    });
  }
  async send(kind,id,message,guard) {
    const generation=this.generation;
    try {
      const login=await this.request('get_login_info',{}),status=await this.request('get_status',{});
      const self=typeof login?.user_id==='string'?login.user_id:Number.isSafeInteger(login?.user_id)?String(login.user_id):'';
      if(generation!==this.generation||self!==this.config.accountId||status?.online!==true)throw new Error('NOT_CONNECTED');
      if(this.state.state!=='online')throw new Error('NOT_CONNECTED');
      // Last synchronous step before external I/O, after every asynchronous check.
      guard();
    }catch(error){throw new Error('SEND_NOT_STARTED',{cause:error});}
    if(message.length===1&&message[0].type==='file'){const part=message[0];const result=await this.request(kind==='group'?'upload_group_file':'upload_private_file',{[kind==='group'?'group_id':'user_id']:id,file:part.data.file,name:part.data.name},30000);if(typeof result?.file_id!=='string'||!result.file_id)throw new Error('SEND_UNKNOWN');return {messageId:result.file_id};}
    const result=await this.request(kind==='group'?'send_group_msg':'send_private_msg',{[kind==='group'?'group_id':'user_id']:id,message});
    const mid=typeof result?.message_id==='string'?result.message_id:Number.isSafeInteger(result?.message_id)?String(result.message_id):'';
    if(!/^-?[0-9]{1,64}$/.test(mid))throw new Error('SEND_UNKNOWN');
    return {messageId:mid};
  }
  async media(kind,file,guard){
    if(!/^[a-fA-F0-9]{32}(\.[a-zA-Z0-9]{1,8})?$/.test(file))throw new Error('MEDIA_REFERENCE_UNSUPPORTED');
    const generation=this.generation;const login=await this.request('get_login_info',{}),status=await this.request('get_status',{});
    if(generation!==this.generation||String(login?.user_id)!==this.config.accountId||status?.online!==true)throw new Error('NOT_CONNECTED');guard();
    const result=await this.request(kind==='record'?'get_record':'get_file',kind==='record'?{file,out_format:'wav'}:{file},30000);
    guard();if(generation!==this.generation||typeof result?.base64!=='string'||result.base64.length>2_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64))throw new Error('MEDIA_BYTES_UNAVAILABLE');return result.base64;
  }
  rejectPending() { for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('SEND_UNKNOWN'));}this.pending.clear(); }
  stop() {this.active=false;this.generation++;clearTimeout(this.retry);clearTimeout(this.probeTimer);this.rejectPending();this.socket?.terminate();this.socket=undefined;this.version=undefined;this.update('stopped');}
  dispose() {this.stop();this.host=undefined;}
}
