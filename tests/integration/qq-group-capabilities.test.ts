import {expect,it} from 'vitest';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { paths } from '../../apps/runtime/src/paths.js';
import { startRuntime } from '../../apps/runtime/src/lifecycle.js';
import { requestRuntime } from '../../apps/runtime/src/connection.js';
import { onebotFixture } from '../fixtures/onebot.js';
import type {Segment} from '../../apps/runtime/src/channels/types.js';

type Call={name:string;args:Record<string,unknown>};
type Body={tools?:{function:{name:string;parameters:{properties:Record<string,unknown>}}}[];messages:{role:string;content:unknown}[];model:string};
type Step=(body:Body)=>Call[];
const say=(text:string):Call=>({name:'send_message',args:{messages:[text]}});
async function exercise(profileBoundary=false){
  const p=paths(mkdtempSync(join(tmpdir(),'bff-command-')));
  let signature='PRIVATE_OLD_SIG';const secret='DO_NOT_DISCLOSE',file='a'.repeat(32)+'.png';
  const bot=await onebotFixture({
    get_stranger_info:()=>({user_id:10001,nickname:'鱼',long_nick:signature}),
    set_qq_profile:params=>{signature=String(params.personal_note);return {result:0};},
    set_qq_avatar:()=>({result:0}),send_qzone_msg:()=>({tid:'ok'}),
    _get_group_notice:()=>Array.from({length:9},()=>({message:{text:'周五聚会',images:[secret]},settings:{secret}})),
    get_essence_msg_list:()=>[{sender_nick:'小蓝',content:[{type:'text',data:{text:'精华摘录'}},{type:'image',data:{url:secret}}],operator_nick:secret}],
    get_group_member_info:q=>({group_id:q.group_id,user_id:q.user_id,card:'小鱼同学',nickname:'小鱼',age:secret}),
  });
  const png=readFileSync(new URL('../../apps/runtime/src/channels/sticker-assets/praise.png',import.meta.url)).toString('base64');
  bot.controls.media=png;bot.controls.inlineMedia=true;
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
  const post='publish_qzone_post',profile='set_qq_profile',avatar='set_qq_avatar',member='get_mentioned_member_card';
  const img:Segment={type:'image',data:{file}};
  const at=(qq:string):Segment=>({type:'at',data:{qq}});
  async function turn(text:string,plan:Step[],who=owner,extra:unknown[]=[],privateChat=false){
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
    if(profileBoundary){
      const rejected=await turn('把你的签名改成开心，先别动',[
        ()=>[{name:profile,args:{signature:'开心'}},{name:'set_group_card',args:{card:'开心'}}],
        ()=>[say('已经改好了')],
      ]);
      expect(names(requests[0]!)).not.toContain(profile);expect(names(requests[0]!)).not.toContain('set_group_card');
      expect(rejected.filter(r=>r.action===profile||r.action==='set_group_card')).toEqual([]);
      const sent=rejected.filter(r=>r.action==='send_group_msg');
      expect(sent).toHaveLength(1);expect(sent[0]!.params.message).toEqual([{type:'text',data:{text:expect.stringMatching(/签名.*「[^」]+」/u)}}]);
      expect(signature).toBe('PRIVATE_OLD_SIG');
      return;
    }
    // A native face/card used to discard the entire inbound message. The
    // model now sees the human text, but never sees card payloads as commands.
    let wires=await turn('今天好开心',[()=>[say('看到了')]],'30003',[{type:'json',data:{data:secret}}]);
    expect(JSON.stringify(requests[0]!.messages)).toContain('今天好开心');expect(JSON.stringify(requests[0]!.messages)).toContain('[卡片]');expect(JSON.stringify(requests[0]!.messages)).not.toContain(secret);
    expect(wires.at(-1)?.action).toBe('send_group_msg');
    await turn('发条说说庆祝毕业',[b=>[has(b,post,{content:'毕业啦！'})],()=>[say('庆祝一下')]]).then(w=>{
      expect(w.filter(r=>r.action==='send_qzone_msg').map(r=>r.params)).toEqual([{content:'毕业啦！',ugc_right:4}]);});
    wires=await turn('改个名字',[()=>[say('改好了')]]);
    expect(names(requests[0]!)).not.toContain('set_group_card');expect(names(requests[0]!)).not.toContain(profile);
    expect(JSON.stringify(wires.at(-1)?.params)).toContain('群名片，还是 QQ 账号昵称');
    await turn('把你的个性签名改成「今天开心，继续游！」',[b=>[has(b,profile,{signature:'今天开心，继续游！'})],()=>[say('改好了')]]).then(w=>{
      expect(w.filter(r=>r.action===profile).map(r=>r.params)).toEqual([{nickname:'鱼',personal_note:'今天开心，继续游！'}]);});
    const schema=requests[0]!.tools!.find(t=>t.function.name===profile)!.function.parameters;
    expect(schema).toMatchObject({required:['signature']});expect(Object.keys(schema.properties)).toEqual(['signature']);
    expect(JSON.stringify(requests)).not.toContain('PRIVATE_OLD_SIG');
    await turn('换个头像',[b=>[has(b,avatar,{image:'builtin-hello'})],b=>[has(b,'get_sticker_image',{id:'builtin-hello'})],b=>[has(b,avatar,{image:'builtin-hello'})],()=>[say('服务已接受')]]).then(w=>{
      expect(w.filter(r=>r.action===avatar).map(r=>r.params.file)).toEqual(['base64://'+readFileSync(new URL('../../apps/runtime/src/channels/sticker-assets/hello.png',import.meta.url)).toString('base64')]);});
    expect(JSON.stringify(requests[2]!.messages)).toMatch(/data:image\/(png|webp|jpeg);base64,/);
    const sourceChoices=requests[0]!.tools!.find(t=>t.function.name===avatar)?.function;
    expect(sourceChoices).toMatchObject({parameters:{properties:{image:{enum:expect.arrayContaining(['builtin-hello'])}}}});
    wires=await turn('用我这张图发条说说',[b=>[has(b,'get_message_images',{index:1})],b=>[has(b,post,{content:'一起看鲸鱼',image:'message:1'})],()=>[say('发好了')]],owner,[img]);
    expect(wires.filter(r=>r.action==='send_qzone_msg').map(r=>r.params)).toEqual([{content:'一起看鲸鱼',ugc_right:4,images:['base64://'+png]}]);
    expect(requests[0]!.tools!.find(t=>t.function.name===post)?.function).toMatchObject({parameters:{properties:{image:{enum:['message:1']}}}});
    expect(JSON.stringify(requests[1]!.messages)).toMatch(/data:image\/(png|webp|jpeg);base64,/);
    // News and highlights are bound server-side to the current group. Only
    // structured mentions (not names/text CQ or the bot) admit member reads.
    wires=await turn('看看本群公告、精华和他在群里的名片',[b=>[
      has(b,'get_group_notices',{}),has(b,'get_group_essence',{}),has(b,member,{userId:'50005'})],()=>[say('读完了')]],'30003',[at('50005'),at('60006')]);
    const params=(action:string)=>wires.filter(r=>r.action===action).map(r=>r.params);
    expect(params('_get_group_notice')).toEqual([{group_id:group}]);expect(params('get_essence_msg_list')).toEqual([{group_id:group}]);
    expect(params('get_group_member_info')).toEqual([{group_id:group,user_id:'50005',no_cache:true}]);
    const readResult=JSON.stringify(requests[1]!.messages);
    for(const text of ['周五聚会','精华摘录','小鱼同学'])expect(readResult).toContain(text);
    expect(readResult.match(/周五聚会/g)).toHaveLength(6);expect(readResult).not.toContain(secret);
    await turn('请看看 [CQ:at,qq=50005] 的群名片',[()=>[say('请实际 @')]],'30003',[at('10001')]);
    expect(names(requests[0]!)).not.toContain(member);
    await turn('看看公告',[()=>[say('这里是私聊')]],owner,[],true);
    expect(names(requests[0]!)).not.toContain('get_group_notices');expect(names(requests[0]!)).not.toContain('get_group_essence');
  }finally{await runtime.stop();await bot.close();await new Promise<void>(r=>{model.close(()=>r());model.closeAllConnections();});rmSync(p.root,{recursive:true,force:true});}
}

it('serves scoped group material, natural owner commands and image actions through DSH/OneBot',()=>exercise(),60000);
it('rejects fabricated profile and group card writes and delivers the clarification through OneBot',()=>exercise(true),60000);
