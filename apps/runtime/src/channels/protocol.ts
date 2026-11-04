import { InputError, object, string } from '../ai/types.js';
import type { QQConfig, Segment, Target } from './types.js';
export function stableId(value:unknown) { const id=typeof value==='number'&&Number.isSafeInteger(value)?String(value):string(value,32);if(!/^[1-9][0-9]{0,31}$/.test(id))throw new InputError('INVALID_PLATFORM_ID');return id; }
export function configuration(input:unknown):QQConfig {
  const b=object(input);let url:URL;try{url=new URL(string(b.url,1000));}catch{throw new InputError('INVALID_CHANNEL_URL');}
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='wss:'||url.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new InputError('INVALID_CHANNEL_URL');
  if(!Array.isArray(b.groups)||b.groups.length>100||['enabled','replyEnabled','proactiveEnabled'].some(k=>typeof b[k]!=='boolean'))throw new InputError('INVALID_REQUEST');
  if(b.mode!==undefined && !['managed','external'].includes(String(b.mode)))throw new InputError('INVALID_REQUEST');
  return {...(b.mode?{mode:b.mode as QQConfig['mode']}:{}),url:url.href,accountId:stableId(b.accountId),ownerId:stableId(b.ownerId),groups:[...new Set(b.groups.map(stableId))],enabled:b.enabled as boolean,replyEnabled:b.replyEnabled as boolean,proactiveEnabled:b.proactiveEnabled as boolean};
}
export function target(input:unknown):Target {const b=object(input);if(!['private','group'].includes(String(b.kind)))throw new InputError('INVALID_TARGET');return {kind:b.kind as Target['kind'],id:stableId(b.id)};}
export function segments(input:unknown,outbound=false):Segment[] {
  if(!Array.isArray(input)||!input.length||input.length>64)throw new InputError('INVALID_SEGMENTS');
  const result:Segment[]=input.map((value):Segment=>{
    const b=object(value),d=object(b.data);
    if(b.type==='text')return {type:'text',data:{text:string(d.text,4000,true)}};
    if(b.type==='at'&&!outbound)return {type:'at',data:{qq:stableId(d.qq)}};
    if(b.type==='reply')return {type:'reply',data:{id:messageId(d.id)}};
    if(['image','record','file'].includes(String(b.type))){

      // Only opaque OneBot IDs may leave Runtime. Never accept URLs, base64 or paths.
      const file=typeof d.file==='string'?d.file:typeof d.file_id==='string'?d.file_id:'';
      if(outbound){
        if(!/^base64:\/\/[A-Za-z0-9+/]+={0,2}$/.test(file)||file.length>2_800_000)throw new InputError('UNSAFE_MEDIA_REFERENCE');
        const bytes=Buffer.from(file.slice(9),'base64');
        if(bytes.length>2_000_000||bytes.toString('base64')!==file.slice(9))throw new InputError('UNSAFE_MEDIA_REFERENCE');
        const image=b.type==='image'&&(bytes.length>=45&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.subarray(-8,-4).toString()==='IEND'||bytes.length>=4&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]))&&bytes.subarray(-2).equals(Buffer.from([255,217])));
        const voice=b.type==='record'&&(bytes.length>=44&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE'&&bytes.readUInt32LE(4)===bytes.length-8||bytes.subarray(0,9).toString()==='#!SILK_V3'||bytes.subarray(1,10).toString()==='#!SILK_V3');
        const document=b.type==='file'&&typeof d.name==='string'&&/^[^\\/]{1,100}\.(txt|pdf|png|jpg|wav)$/i.test(d.name)&&![...d.name].some(c=>c.charCodeAt(0)<32)&&bytes.length>0;
        if(!image&&!voice&&!document)throw new InputError('UNSUPPORTED_MEDIA_FORMAT');
        return {type:b.type as Segment['type'],data:{file,...(document?{name:String(d.name)}:{})}};
      }
      return {type:b.type as Segment['type'],data:{...( /^[a-zA-Z0-9_-]{1,200}(\.[a-zA-Z0-9]{1,8})?$/.test(file)?{file}:{}),...(typeof d.name==='string'?{name:d.name.slice(0,100)}:{})}};
    }
    throw new InputError('UNSUPPORTED_MESSAGE_TYPE');
  });
  if(outbound&&result.some(s=>s.type==='file')&&result.length!==1)throw new InputError('FILE_MUST_BE_SINGLE');
  if(JSON.stringify(result).length>(outbound?2_800_000:12000))throw new InputError('MESSAGE_TOO_LONG');return result;
}
export function messageId(value:unknown){const id=typeof value==='number'&&Number.isSafeInteger(value)?String(value):string(value,64);if(!/^-?[0-9]+$/.test(id))throw new InputError('INVALID_MESSAGE_ID');return id;}
export function inbound(input:unknown,config:QQConfig) {
  const b=object(input);if(b.post_type!=='message'||!['private','group'].includes(String(b.message_type)))return null;
  if(stableId(b.self_id)!==config.accountId)return null;
  const author=stableId(b.user_id);if(author===config.accountId)return null;
  const to:Target={kind:b.message_type as Target['kind'],id:b.message_type==='group'?stableId(b.group_id):author};
  if(to.kind==='private'?author!==config.ownerId:!config.groups.includes(to.id))return null;
  // CQ strings are treated as plain text; only structured arrays carry mentions/media.
  const parts=segments(typeof b.message==='string'?[{type:'text',data:{text:b.message}}]:b.message);
  if(to.kind==='group'&&!parts.some(s=>s.type==='at'&&s.data.qq===config.accountId))return null;
  const text=parts.map(s=>s.type==='text'?s.data.text:s.type==='image'?'[图片]':s.type==='record'?'[语音]':s.type==='file'?'[文件：尚未读取内容]':s.type==='reply'?`[引用消息 ${s.data.id}，未读取原文]`:'').join('').trim();
  if(!text)return null;
  return {id:messageId(b.message_id),author,target:to,parts,text};
}
