import {expect,it} from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { QQClient } from '../../../apps/runtime/src/channels/onebot/client.js';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../../apps/runtime/src/storage/paths.js';
import { startRuntime } from '../../../apps/runtime/src/host/lifecycle.js';
import { requestRuntime } from '../../../apps/runtime/src/host/connection.js';
import { onebotFixture } from '../../fixtures/platforms/onebot.js';
import type {Segment} from '../../../apps/runtime/src/channels/types.js';

type Call={name:string;args:Record<string,unknown>};
type Body={tools?:{function:{name:string}}[];messages:{role:string;content:unknown}[];model:string};
type Step=(body:Body)=>Call[];
const say=(text:string):Call=>({name:'send_message',args:{messages:[text]}});
it('carries only an explicit owner group command to OneBot; settles images and account writes before replying',async()=>{
  const p=paths(mkdtempSync(join(tmpdir(),'bff-command-')));
  let nickname='鱼',missingReceipt=false;
  const bot=await onebotFixture({
    get_stranger_info:()=>({user_id:10001,nickname,long_nick:'PRIVATE_SIGNATURE'}),
    set_qq_profile:params=>{nickname=String(params.nickname);return {result:0};},
    send_qzone_msg:()=>missingReceipt?{}:{tid:'qzone-1'},
  });
  const requests:Body[]=[];let steps:Step[]=[];
  const model=createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw) as Body;
    res.writeHead(200,{'content-type':'text/event-stream'});
    const emit=(delta:unknown,finish_reason:string|null=null)=>res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n');
    emit({role:'assistant'});
    if(body.tools?.length){
      requests.push(body);const calls=steps.shift()?.(body)??[say('意外的额外请求')];
      emit({tool_calls:calls.map((c,i)=>({index:i,id:'call-'+requests.length+'-'+i,type:'function',function:{name:c.name,arguments:JSON.stringify(c.args)}}))});emit({},'tool_calls');
    }else{emit({content:'{"items":[],"changed":false}'});emit({},'stop');}
    res.end('data: [DONE]\n\n');
  });
  await new Promise<void>(r=>model.listen(0,'127.0.0.1',r));
  const runtime=await startRuntime(p),api=<T>(url:string,method='GET',body?:unknown)=>requestRuntime<T>(runtime.connection,url,method,body);
  let id=0;const group='40004',owner='20002',names=(b:Body)=>b.tools!.map(t=>t.function.name);
  const has=(body:Body,tool:string,args:Record<string,unknown>):Call=>names(body).includes(tool)?{name:tool,args}:say('本轮没有这个操作');
  const post='publish_qzone_post',profile='set_qq_profile';
  async function turn(text:string,plan:Step[],who=owner,extra:Segment[]=[],privateChat=false){
    const msg=String(++id);requests.length=0;steps=[...plan];const offset=bot.requests.length;
    bot.event({post_type:'message',message_type:privateChat?'private':'group',self_id:'10001',user_id:who,...(privateChat?{}:{group_id:group}),message_id:msg,message:[...extra,{type:'text',data:{text}}]});
    const key='10001:'+(privateChat?'private:'+who:'group:'+group)+':'+msg;
    for(let n=0;n<900;n++){const rows=await api<{id:string;status:string}[]>('/v1/channels/qq/deliveries'),done=rows.find(r=>r.id===key&&!['queued','generating','sending'].includes(r.status));
      if(done){expect(done.status).toBe('sent');return bot.requests.slice(offset);}await delay(20);}
    throw new Error('FIXTURE_TIMEOUT');
  }
  try{
    await api('/v1/models','POST',{id:'fixture',provider:'openai',baseURL:'http://127.0.0.1:'+(model.address() as {port:number}).port+'/v1',model:'fixture'});
    await api('/v1/model-routes','PUT',{chat:'fixture'});await api('/v1/channels/qq/sticker-options','PUT',{networkEnabled:false,revision:'initial'});
    await api('/v1/channels/qq','PUT',{url:bot.url,accountId:'10001',ownerId:owner,groups:[group],enabled:true,replyEnabled:true,proactiveEnabled:false,token:'fixture-token',revision:''});
    for(let i=0;i<100;i++){if((await api<{health:{state:string}}>('/v1/channels/qq')).health.state==='online')break;await delay(20);}
    let wires=await turn('大肥鱼发个说说',[b=>[has(b,post,{content:'早安！'})],()=>[say('发好了')]]);
    expect(wires.filter(r=>r.action==='send_qzone_msg').map(r=>r.params)).toEqual([{content:'早安！',ugc_right:4}]);
    expect(names(requests[0]!)).toContain(profile);expect(names(requests[0]!)).not.toContain('get_qzone_posts');expect(names(requests[0]!)).not.toContain('get_qq_profile');
    wires=await turn('大肥鱼把你的 QQ 昵称改成小蓝',[b=>[has(b,profile,{nickname:'小蓝'}),say('提前报喜')],()=>[say('改好了')]]);
    expect(wires.filter(r=>r.action===profile).map(r=>r.params)).toEqual([{nickname:'小蓝',personal_note:'PRIVATE_SIGNATURE'}]);
    expect(requests).toHaveLength(2);expect(JSON.stringify(requests)).not.toContain('PRIVATE_SIGNATURE');
    expect(wires.filter(r=>r.action==='send_group_msg').map(r=>r.params.message)).toEqual([[{type:'text',data:{text:'改好了'}}]]);
    wires=await turn('把QQ昵称改成小紫',[b=>[has(b,profile,{nickname:'小紫',signature:'越界签名'})],()=>[say('不能乱改')]]);
    expect(wires.some(r=>r.action===profile)).toBe(false);
    missingReceipt=true;
    wires=await turn('大肥鱼你发一个说说呗',[b=>[has(b,post,{content:'晚安！'})],b=>[say(JSON.stringify(b.messages.at(-1)).includes('尚未确认')?'结果待核实':'没有权限')]]);
    expect(wires.filter(r=>r.action==='send_qzone_msg')).toHaveLength(1);expect(JSON.stringify(requests.at(-1)!.messages.at(-1))).toContain('尚未确认');expect(wires.at(-1)?.params.message).toEqual([{type:'text',data:{text:'没有拿到可确认的操作结果，我不会重复操作。'}}]);
    for(const [who,text,parts] of [['30003','大肥鱼发个说说',[]],[owner,'不要发说说',[]],[owner,'如果我说“大肥鱼发个说说”呢？',[]],[owner,'小明说：大肥鱼发个说说',[]],[owner,'大肥鱼发个说说',[{type:'reply',data:{id:'1'}}]]] as const){
      const modelCanAct=who===owner&&!parts.length;
      wires=await turn(text,[b=>[modelCanAct?say('不发布。'):has(b,post,{content:'不应发布'})]],who,[...parts]);
      expect(names(requests[0]!).includes(post)).toBe(modelCanAct);expect(wires.some(r=>r.action==='send_qzone_msg')).toBe(false);
    }
    const opts=await api<Record<string,unknown>>('/v1/channels/qq/self-options');
    await api('/v1/channels/qq/self-options','PUT',{...opts,posts:false,profile:true});
    const db=new DatabaseSync(p.database,{readOnly:true});
    const assertUnavailable=async(text:string,tool:string,notice:string)=>{
      const captured=await turn(text,[()=>[say(notice)]]);
      expect(names(requests[0]!)).not.toContain(tool);expect(requests).toHaveLength(1);expect(JSON.stringify(requests[0]!.messages)).toContain(tool===post?'发说说的开关已关闭':'当前连接不支持');
      expect(captured.filter(r=>r.action==='send_qzone_msg'||r.action===profile)).toHaveLength(0);
      expect(captured.filter(r=>r.action==='send_group_msg').map(r=>r.params.message)).toEqual([[{type:'text',data:{text:notice}}]]);
      const request=createHash('sha256').update('10001:group:'+group+':'+id).digest('hex');
      expect(db.prepare("SELECT content FROM messages WHERE role='assistant' AND status='completed' AND request_id=?").get(request)?.content).toBe(notice);
    };
    try{
      await assertUnavailable('大肥鱼发个说说',post,'说说没发，发说说的开关已关闭。');
      // Emulate an adapter that handles messaging but has no account actions.
      const descriptor=Object.getOwnPropertyDescriptor(QQClient.prototype,'action')!;
      Object.defineProperty(QQClient.prototype,'action',{...descriptor,value:undefined});
      try{await assertUnavailable('大肥鱼把你的 QQ 昵称改成小白',profile,'昵称没改，当前 QQ 连接不支持修改昵称。');}
      finally{Object.defineProperty(QQClient.prototype,'action',descriptor);}
    }finally{db.close();}
    wires=await turn('隔离闲聊，今天真高兴',[()=>[say('提前文字'),{name:'get_sticker_image',args:{id:'builtin-hello'}}],()=>[{name:'send_sticker',args:{id:'builtin-hello'}}]]);
    expect(requests).toHaveLength(2);expect(/data:image\/(png|jpeg|webp);base64,/.test(JSON.stringify(requests[1]))).toBe(true);expect(wires.filter(r=>r.action==='send_group_msg').map(r=>r.params.message)).toEqual([[{type:'image',data:{file:expect.stringMatching(/^base64:\/\//)}}]]);
    wires=await turn('把你的QQ昵称改成小蓝',[b=>[has(b,profile,{nickname:'小蓝'})],()=>[say('已经是小蓝')]],owner,[],true);expect(names(requests[0]!)).toContain('get_qq_profile');expect(wires.some(r=>r.action==='send_private_msg')).toBe(true);
  }finally{await runtime.stop();await bot.close();await new Promise<void>(r=>{model.close(()=>r());model.closeAllConnections();});rmSync(p.root,{recursive:true,force:true});}
},60000);
