import {assertActionReceipt} from './protocol.js';
import type {EngineTool} from '../ai/engine.js';
import {InputError,object,string} from '../ai/types.js';
import type {Plugin,QQAction} from './types.js';
import type {QQActionState,SelfOptions} from './action-state.js';
import type {StickerLibrary} from './stickers.js';
interface Image {data:string;mimeType:string}
const schema=(properties:Record<string,unknown>,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
export function selfTools(context:'owner'|'autonomous',plugin:Plugin,state:QQActionState,options:SelfOptions,library:StickerLibrary,guard:()=>void,externalImage?:(reference:string)=>Image):EngineTool[]{
 if(!plugin.action)return [];
 const viewed=new Map<string,string>(),usedImages=new Set<string>();
 const check=(signal?:AbortSignal)=>{signal?.throwIfAborted();guard();if(state.options(options.accountId).revision!==options.revision)throw new InputError('PERMISSION_REVOKED');for(const ref of usedImages){if(viewed.has(ref))library.assertEnabled(ref,viewed.get(ref));else externalImage?.(ref);}};
 const call=async(name:QQAction,params:Record<string,unknown>,signal:AbortSignal)=>{check(signal);const r=await plugin.action!(name,params,()=>check(signal));check(signal);return r;};
 const image=(ref:unknown)=>{const id=string(ref,100);if(id.startsWith('builtin-')&&viewed.has(id)){library.assertEnabled(id,viewed.get(id));usedImages.add(id);return library.image(id);}if(externalImage){const result=externalImage(id);usedImages.add(id);return result;}throw new InputError('STICKER_VIEW_REQUIRED');};
 const profile=async(signal:AbortSignal)=>{const r=object(await call('profile',{user_id:options.accountId,no_cache:true},signal));if(String(r.user_id)!==options.accountId)throw new InputError('QQ_ACCOUNT_CHANGED');return {nickname:string(r.nickname,100,true),signature:typeof r.long_nick==='string'?r.long_nick:typeof r.longNick==='string'?r.longNick:''};};
 const writes=new Map<string,Promise<unknown>>(),lastWrite=new Map<string,string>();
 const write=(kind:string,payload:unknown,signal:AbortSignal,run:()=>Promise<unknown>,limit=1)=>{check(signal);const key=JSON.stringify([kind,payload]);let task=lastWrite.get(kind)===key?writes.get(key):undefined;if(!task){task=state.write(options.accountId,kind,payload,'self',limit,()=>check(signal),run);writes.set(key,task);lastWrite.set(kind,key);}return task;};

 const tools:EngineTool[]=[
  {name:'get_qq_profile',description:'读取大肥鱼当前QQ昵称和签名。',parameters:schema({}),execute:(_,s)=>profile(s)},
  {name:'list_avatar_images',description:'列出可用的内置大肥鱼图片，先查看图片再用作头像或说说配图。',parameters:schema({}),execute:async(_,s)=>{check(s);return library.list().filter(r=>r.builtin&&r.enabled).map(({id,name,description})=>({id,name,description}));}},
  {name:'get_avatar_image',description:'实际查看内置图片。看过才可用于头像或说说。',parameters:schema({id:{type:'string'}},['id']),resultKind:'image',onImageResult:(value,success)=>{const r=value as {id:string;revision:string};viewed.delete(r.id);if(success){check();library.assertEnabled(r.id,r.revision);viewed.set(r.id,r.revision);}},execute:async(args,s)=>{check(s);const id=string(object(args).id,100),r=library.assertEnabled(id);if(!r.builtin)throw new InputError('QQ_IMAGE_NOT_PUBLIC');return {id,revision:r.revision,text:r.name,image:library.image(id)};}},
  {name:'get_qzone_profile',description:'读取自己的空间名称和说明。',parameters:schema({}),execute:async(_,s)=>{const r=object(await call('space_profile',{},s));return {name:string(r.name,8192,true),description:string(r.description,8192,true)};}},
 ];
 // Old post visibility cannot be established reliably; only the trusted owner turn may read it.
 if(context==='owner')tools.push(
  {name:'get_qzone_posts',description:'读取自己的最近10条说说，用于了解已有动态、避免重复。',parameters:schema({}),execute:async(_,s)=>{const r=object(await call('posts',{target_uin:options.accountId,pos:0,num:10},s));if(!Array.isArray(r.msglist))throw new InputError('QQ_INVALID_RESPONSE');return r.msglist.slice(0,10).map(v=>{const m=object(v);return {id:String(m.tid??''),content:String(m.content??'').slice(0,1500),time:m.created_time??m.time};});}}
 );
 if(options.profile)tools.push(
  {name:'set_qq_profile',description:'修改自己的昵称或签名，未提供的字段保持不变。不能公开聊天中的私人资料。每天最多一次。',parameters:schema({nickname:{type:'string'},signature:{type:'string'}}),execute:async(args,s)=>{const b=object(args);if(b.nickname===undefined&&b.signature===undefined)throw new InputError('INVALID_REQUEST');const old=await profile(s),next={nickname:b.nickname===undefined?old.nickname:string(b.nickname,32),signature:b.signature===undefined?old.signature:string(b.signature,160,true)};if(JSON.stringify(old)===JSON.stringify(next))return {status:'unchanged'};return write('profile',next,s,async()=>{assertActionReceipt(await call('profile_update',{nickname:next.nickname,personal_note:next.signature},s));const after=await profile(s);if(after.nickname!==next.nickname||after.signature!==next.signature)throw new InputError('QQ_PROFILE_UNCONFIRMED');return {status:'verified',...after};});}},
  {name:'set_qq_avatar',description:'用已查看的图片更新自己的QQ头像。image可为已查看内置/表情ID或message:1。每天最多一次；返回服务确认，不代表客户端缓存立即刷新。',parameters:schema({image:{type:'string'}},['image']),execute:async(args,s)=>{check(s);const img=image(object(args).image);return write('avatar',{data:img.data},s,async()=>{assertActionReceipt(await call('avatar',{file:'base64://'+img.data},s));return {status:'service_confirmed',notice:'QQ已接受头像更新，客户端显示可能稍有延迟'};});}},
  {name:'set_qzone_profile',description:'修改自己的空间名称或说明，未提供项保持不变；不能公开私人聊天资料。每天最多一次。',parameters:schema({name:{type:'string'},description:{type:'string'}}),execute:async(args,s)=>{const b=object(args),p:Record<string,string>={};for(const k of ['name','description'])if(b[k]!==undefined)p[k]=string(b[k],200,true);if(!Object.keys(p).length)throw new InputError('INVALID_REQUEST');return write('space_profile',p,s,async()=>{assertActionReceipt(await call('space_update',p,s));const r=object(await call('space_profile',{},s));if(Object.entries(p).some(([k,v])=>r[k]!==v))throw new InputError('QQ_PROFILE_UNCONFIRMED');return {status:'verified',...p};});}}
 );
 if(options.posts)tools.push({name:'publish_qzone_post',description:'发表自己的说说，可选最多一张已实际查看图片。可见范围由设置固定，不得发布私人聊天、记忆或日记中的隐私。最多每日两条，不为凑频率而发。',parameters:schema({content:{type:'string'},image:{type:'string'}},['content']),execute:async(args,s)=>{check(s);const b=object(args),content=string(b.content,600),img=b.image===undefined?undefined:image(b.image),p={content,ugc_right:{friends:4,self:64,public:1}[options.visibility],...(img?{images:['base64://'+img.data]}:{})};return write('post',p,s,async()=>{const r=object(await call('post',p,s));const tid=typeof r.tid==='string'?r.tid:'';if(!tid||tid.length>200)throw new InputError('QQ_POST_UNCONFIRMED');return {status:'published',id:tid,visibility:options.visibility};},2);}});
 return tools;
}
