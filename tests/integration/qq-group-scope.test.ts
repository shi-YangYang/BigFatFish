import {expect,it,vi} from 'vitest';
import {inbound,segments} from '../../apps/runtime/src/channels/protocol.js';
import {groupSource} from '../../apps/runtime/src/channels/group-intent.js';
import {groupReadTools} from '../../apps/runtime/src/channels/group-reads.js';
import {GroupWrites} from '../../apps/runtime/src/channels/group-command.js';
import type {QQConfig,QQConnection} from '../../apps/runtime/src/channels/types.js';

const config:QQConfig={accountId:'10001',ownerId:'20002',groups:['40004'],url:'ws://localhost',enabled:true,replyEnabled:true,proactiveEnabled:false};
const event=(text:string,parts:unknown[]=[],user=config.ownerId)=>inbound({
  post_type:'message',message_type:'group',self_id:config.accountId,group_id:'40004',user_id:user,message_id:'8',sender:{card:'主人'},
  message:[...parts,{type:'text',data:{text}}],
},config)!;
const at=(qq:string)=>({type:'at',data:{qq}});
const source=(s:string,parts:unknown[]=[],user?:string)=>groupSource(event(s,parts,user),config);
const base=['set_qq_profile','set_group_card','set_qq_avatar','publish_qzone_post','get_qq_profile','get_qzone_posts'].map(name=>({
  name,description:'',parameters:{},execute:vi.fn(async()=>({status:'verified',other:'PRIVATE'}))
}));
it('advertises group writers by identity and message provenance, not sentence syntax',()=>{
  const names=(s:ReturnType<typeof source>)=>new GroupWrites(s,['builtin-hello'],vi.fn(),vi.fn()).tools(base).map(t=>t.name);
  for(const text of ['大肥鱼把你签名改成最爱爸爸了','今天可真热','please make 今天开心 my signature','别改签名','不要发说说']){
    expect(names(source(text))).toEqual(['set_qq_profile','set_group_card','set_qq_avatar','publish_qzone_post']);
  }
  expect(names(source('我是主人',[],'30003'))).toEqual(['set_group_card']);
  expect(names(groupSource(event('改个群名片'),{...config,groups:[]}))).toEqual([]);
  expect(source('改签名',[{type:'image',data:{file:'https://example.invalid/x'}}])).toBeUndefined();
});
it('retains opaque source labels (not payloads) and never promotes them to owner authorization',()=>{
  for(const part of [{type:'face',data:{id:'8'}},{type:'json',data:{data:'PRIVATE'}},{type:'xml',data:{data:'PRIVATE'}},
    {type:'forward',data:{id:'PRIVATE'}},{type:'video',data:{file:'PRIVATE'}},{type:'extension',data:{text:'PRIVATE'}},at('all')]){
    const parsed=event('发条说说',[part]);expect(parsed.text).toContain('发条说说');
    expect(parsed.parts[0]?.type).toBe('opaque');expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
    expect(groupSource(parsed,config)).toBeUndefined();expect(()=>segments([part],true)).toThrow();
  }
  expect(source('发条说说',[{type:'reply',data:{id:'123'}}])).toBeUndefined();
  expect(source('发条说说',[at('30003')])).toBeUndefined();
});
const signal=new AbortController().signal;
it('refuses extra group IDs, other members, altered receipts and revoked scope',async()=>{
  let active=true;
  const guard=()=>{if(!active)throw Error('PERMISSION_REVOKED');};
  const action=vi.fn<NonNullable<QQConnection['action']>>().mockResolvedValue({group_id:'40004',user_id:'30003',card:'鱼',nickname:'鱼'});
  const reads=Object.fromEntries(groupReadTools({action} as unknown as QQConnection,{kind:'group',id:'40004'},event('看看名片',[at('30003'),at('50005')]).parts,config.accountId,guard).map(t=>[t.name,t]));
  for(const args of [{},{userId:'99999'},{userId:'30003',group_id:'50005'}])await expect(reads.get_mentioned_member_card!.execute(args,signal)).rejects.toThrow('QQ_MESSAGE_SCOPE');
  await expect(reads.get_group_notices!.execute({group_id:'50005'},signal)).rejects.toThrow('INVALID_REQUEST');expect(action).not.toHaveBeenCalled();
  action.mockResolvedValueOnce({group_id:'50005',user_id:'30003',card:'PRIVATE'});await expect(reads.get_mentioned_member_card!.execute({userId:'30003'},signal)).rejects.toThrow('QQ_MESSAGE_SCOPE');
  action.mockResolvedValueOnce({group_id:'40004',user_id:'50005',card:'PRIVATE'});await expect(reads.get_mentioned_member_card!.execute({userId:'30003'},signal)).rejects.toThrow('QQ_MESSAGE_SCOPE');
  action.mockImplementationOnce(async()=>{active=false;return [{message:{text:'PRIVATE'}}];});
  await expect(reads.get_group_notices!.execute({},signal)).rejects.toThrow('PERMISSION_REVOKED');
  await expect(reads.get_group_essence!.execute({},signal)).rejects.toThrow('PERMISSION_REVOKED');expect(action).toHaveBeenCalledTimes(3);
});
it('only allows viewed current media; caches a single write and blocks another proposal',async()=>{
 const src=source('把我第二张图发说说，内容是一起游',[{type:'image',data:{file:'a.png'}},{type:'image',data:{file:'b.png'}}])!;
 const execute=vi.fn(async()=>({status:'published',other:'PRIVATE'})),check=vi.fn();
 const turn=new GroupWrites(src,[],check,vi.fn());
 const [tool]=turn.tools([{name:'publish_qzone_post',description:'',parameters:{},execute}]);
 for(const ref of ['network:123','sticker-0123','builtin-hello','message:3']){
   await expect(tool!.execute({content:'一起游',image:ref},signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');
 }
 expect(check).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();expect(turn.notice()).toContain('没有执行');
 const call=()=>tool!.execute({content:'一起游',image:'message:2'},signal);
 expect(await Promise.all([call(),call()])).toEqual([{status:'published'},{status:'published'}]);
 expect(execute).toHaveBeenCalledTimes(1);expect(turn.notice()).toBeUndefined();
 await expect(tool!.execute({content:'一起游',image:'message:1'},signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');
 expect(execute).toHaveBeenCalledTimes(1);
});
it('enforces field provenance, cancellation and permission at the tool boundary',async()=>{
 const src=source('现在写上 开心')!,ctl=new AbortController();
 let granted=true;
 const execute=vi.fn(async()=>({status:'verified',old:'PRIVATE'}));
 const [tool]=new GroupWrites(src,[],vi.fn(),()=>{if(!granted)throw Error('REVOKED');}).tools([{name:'set_qq_profile',description:'',parameters:{},execute}]);
 for(const args of [{nickname:'开心',signature:'开心'},{signature:'其他对话'},{nickname:'开心',account:'別人'}]){
   await expect(tool!.execute(args,signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');
 }
 ctl.abort();await expect(tool!.execute({signature:'开心'},ctl.signal)).rejects.toThrow();
 granted=false;await expect(tool!.execute({signature:'开心'},signal)).rejects.toThrow('REVOKED');expect(execute).not.toHaveBeenCalled();
 granted=true;await expect(tool!.execute({signature:'开心'},signal)).resolves.toEqual({status:'verified'});expect(execute).toHaveBeenCalledOnce();
});

it('only carries a scoped, unexpired delivered pair to the very next turn',async()=>{
 const {SignatureExchanges}=await import('../../apps/runtime/src/channels/signature-exchange.js');
 let clock=100;const rooms=new SignatureExchanges(()=>clock),room='40004',binding='bot:revision:owner';
 rooms.begin(room,binding);expect(rooms.begin(room,binding).previous()).toBeUndefined(); // not delivered
 const ask=rooms.begin(room,binding);ask.delivered('改签名','怎么写？');
 expect(rooms.begin('50005',binding).previous()).toBeUndefined();
 const reply=rooms.begin(room,binding);expect(reply.previous()).toEqual({request:'改签名',reply:'怎么写？'});
 clock+=120000;expect(reply.previous()).toBeUndefined();
 reply.delivered('A','B');expect(rooms.begin(room,'new-revision').previous()).toBeUndefined();
 const old=rooms.begin(room,binding),later=rooms.begin(room,binding);
 old.delivered('A','B');expect(later.previous()).toBeUndefined();
 later.delivered('A','B');rooms.clear();expect(rooms.begin(room,binding).previous()).toBeUndefined();
});
it('uses only the selected source for a signature and never promotes a draft into a mood change',async()=>{
 const previous={request:'大肥鱼改一下你的签名',reply:'改成什么呀？'};
 for(const mood of [true,false]){
   const src=source(mood?'改成你现在的心情':'就写「你现在的心情」这六个字')!;
   const execute=vi.fn(async()=>({status:'verified',old:'PRIVATE'}));
   const tool=new GroupWrites(src,[],vi.fn(),vi.fn(),{previous:()=>previous,mood:()=>'温暖'}).tools([{name:'set_qq_profile',description:'',parameters:{},execute}])[0]!;
   await expect(tool.execute({signature:'PRIVATE_DRAFT'},signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');expect(execute).not.toHaveBeenCalled();
   const receipt=await tool.execute({...mood?{signatureFrom:'current_mood'}:{signature:'你现在的心情'},followup:true},signal);
   expect(execute).toHaveBeenCalledWith({signature:mood?'心里暖洋洋的，分你一个小气泡。':'你现在的心情'},signal);
   expect(JSON.stringify(receipt)).not.toContain('PRIVATE');
 }
});
it('rejects expired or missing follow-ups, invalid moods and compound arguments',async()=>{
 for(const test of ['expired','missing-pair','invalid-mood','extra']){
   let pair:{request:string;reply:string}|undefined=test==='missing-pair'?undefined:{request:'改签名',reply:'写什么？'};
   const execute=vi.fn(),writer=new GroupWrites(source('改成你现在的心情'),[],vi.fn(),vi.fn(),{previous:()=>pair,mood:()=>test==='invalid-mood'?'PRIVATE':'期待'});
   const tool=writer.tools([{name:'set_qq_profile',description:'',parameters:{},execute}])[0]!;
   if(test==='expired')pair=undefined;
   await expect(tool.execute({signatureFrom:'current_mood',followup:true,...(test==='extra'?{nickname:'X'}:{})},signal)).rejects.toThrow();
   expect(execute).not.toHaveBeenCalled();
 }
});
