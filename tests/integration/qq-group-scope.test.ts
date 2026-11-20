import {expect,it,vi} from 'vitest';
import {inbound,segments} from '../../apps/runtime/src/channels/protocol.js';
import {ownerDecision} from '../../apps/runtime/src/channels/group-intent.js';
import {groupReadTools} from '../../apps/runtime/src/channels/group-reads.js';
import {scopedGroupTool} from '../../apps/runtime/src/channels/group-command.js';
import type {QQConfig,QQConnection} from '../../apps/runtime/src/channels/types.js';

const config:QQConfig={accountId:'10001',ownerId:'20002',groups:['40004'],url:'ws://localhost',enabled:true,replyEnabled:true,proactiveEnabled:false};
const event=(text:string,parts:unknown[]=[],user=config.ownerId)=>inbound({
  post_type:'message',message_type:'group',self_id:config.accountId,group_id:'40004',user_id:user,message_id:'8',sender:{card:'主人'},
  message:[...parts,{type:'text',data:{text}}],
},config)!;
const decision=(text:string,parts:unknown[]=[],user?:string)=>ownerDecision(event(text,parts,user),config);
const image=(file:string)=>({type:'image',data:{file}});
const one=image('a.png'),two=image('b.png'),at=(qq:string)=>({type:'at',data:{qq}});
it('distinguishes direct commands and selected image sources from conversation about them',()=>{
  for(const [text,purpose] of [['发条说说庆祝一下','庆祝一下'],['发条说说庆祝毕业','庆祝毕业'],['发个说说记录今天的好消息','记录今天的好消息']]){
    expect(decision(text!).command).toEqual({tool:'publish_qzone_post',purpose});
  }
  expect(decision('以后你的QQ昵称就叫小蓝').command).toEqual({tool:'set_qq_profile',field:'nickname',value:'小蓝'});
  expect(decision('你的QQ昵称改成小蓝').command).toEqual({tool:'set_qq_profile',field:'nickname',value:'小蓝'});
  expect(decision('把你的签名改成「今天开心，继续游！」').command).toEqual({tool:'set_qq_profile',field:'signature',value:'今天开心，继续游！'});
  expect(decision('把你的QQ头像换成第二张图',[one,two]).command).toEqual({tool:'set_qq_avatar',image:'message:2'});
  expect(decision('用第二张图发条说说，内容是一起游吧',[one,two]).command).toEqual({tool:'publish_qzone_post',image:'message:2',value:'一起游吧'});
  expect(decision('用内置素材发个说说记录今天的好消息').command).toEqual({tool:'publish_qzone_post',image:'builtin',purpose:'记录今天的好消息'});
  for(const [text,parts] of [['换个头像',[one,two]],['用这张图发说说',[one,two]],['用我这张图发条说说',[]],['用上次收藏的图发条说说',[]],['用我这张图做头像',[image('https://example.invalid/x')]]] as const){
    expect(decision(text,[...parts])).toMatchObject({clarify:expect.stringContaining('哪张图')});expect(decision(text,[...parts]).command).toBeUndefined();
  }
  for(const text of ['别人说发条说说庆祝一下','如果我说换个头像呢？','发说说庆祝毕业还是算了','转述：把你的QQ昵称改成小蓝','把签名改成小蓝可以吗？','把QQ昵称改成小蓝你觉得如何','把QQ昵称改成小蓝吧','把你的群名片改成小蓝']){
    expect(decision(text).command).toBeUndefined();
  }
  expect(decision('改一下名字').clarify).toMatch(/群名片.*QQ 账号昵称/);
  expect(decision('换个头像',[],'30003').command).toBeUndefined();
  expect(ownerDecision(event('发个说说'),{...config,groups:[]}).command).toBeUndefined();
});
it('requires a single literal profile value before granting an account write',()=>{
  for(const [label,field] of [['签名','signature'],['QQ昵称','nickname']] as const){
    const prefix='把你的'+label+'改成';
    expect(decision(prefix+'小蓝').command).toEqual({tool:'set_qq_profile',field,value:'小蓝'});
    for(const tail of ['开心，别真的改','开心，先别动','开心，开玩笑的','开心，继续游','开心；明天再说','开心 先等等','「开心」，先等等','开心别真的改','开心先别动','开心开玩笑的']){
      const result=decision(prefix+tail);
      expect(result.command,tail).toBeUndefined();
      expect(result.clarify,tail).toContain('「');
    }
    expect(decision(prefix+'「开心，继续游！」。').command).toEqual({tool:'set_qq_profile',field,value:'开心，继续游！'});
  }
  expect(decision('我今天开心，继续游！')).toEqual({});
});
it('retains opaque source labels (not payloads) and never promotes them to owner authorization',()=>{
  for(const part of [{type:'face',data:{id:'8'}},{type:'json',data:{data:'PRIVATE'}},{type:'xml',data:{data:'PRIVATE'}},
    {type:'forward',data:{id:'PRIVATE'}},{type:'video',data:{file:'PRIVATE'}},{type:'extension',data:{text:'PRIVATE'}},at('all')]){
    const parsed=event('发条说说',[part]);expect(parsed.text).toContain('发条说说');
    expect(parsed.parts[0]?.type).toBe('opaque');expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
    expect(ownerDecision(parsed,config).command).toBeUndefined();expect(()=>segments([part],true)).toThrow();
  }
  expect(decision('发条说说',[{type:'reply',data:{id:'123'}}]).command).toBeUndefined();
  expect(decision('发条说说',[at('30003')]).command).toBeUndefined();
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
it('rejects model-supplied network, old, collected and unselected images before a write',async()=>{
  const execute=vi.fn().mockResolvedValue({status:'published',other:'PRIVATE'}),check=vi.fn();
  const tool=scopedGroupTool({tool:'publish_qzone_post',image:'message:2',value:'一起游'},[{name:'publish_qzone_post',description:'',parameters:{},execute}],[],check)[0]!;
  for(const ref of ['network:123','sticker-0123','builtin-hello','message:1','message:3']){
    await expect(tool.execute({content:'一起游',image:ref},signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');
  }
  await expect(tool.execute({content:'另一段话',image:'message:2'},signal)).rejects.toThrow('QQ_COMMAND_MISMATCH');
  expect(check).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();
  expect(await tool.execute({content:'一起游',image:'message:2'},signal)).toEqual({status:'published'});
  expect(check).toHaveBeenCalledWith('message:2');expect(execute).toHaveBeenCalledOnce();
});
