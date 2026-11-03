import { InputError, object, string } from '../ai/types.js';
export function videoId(v:unknown){const id=string(v,30);if(!/^\d{6,30}$/.test(id))throw new InputError('INVALID_VIDEO_ID');return id;}
function keys(b:Record<string,unknown>,allowed:string[]){if(Object.keys(b).some(k=>!allowed.includes(k)))throw new InputError('INVALID_REQUEST');}
export function toolArgs(tool:string,value:unknown){const b=object(value??{});const result:Record<string,unknown>={};
 switch(tool){
 case 'douyin_check_credential':case 'douyin_login_qr':case 'douyin_login_poll':keys(b,[]);break;
 case 'douyin_feed':keys(b,[]);Object.assign(result,{num:5,scrolls:2,skip_live:true});break;
 case 'douyin_search':keys(b,['keyword']);result.keyword=string(b.keyword,200);result.num=10;break;
 case 'douyin_video':case 'douyin_comments':keys(b,['aweme_id']);result.aweme_id=videoId(b.aweme_id);if(tool==='douyin_comments')result.num=20;break;
 case 'douyin_like':keys(b,['aweme_id','undo']);result.aweme_id=videoId(b.aweme_id);if(b.undo!==undefined&&typeof b.undo!=='boolean')throw new InputError('INVALID_REQUEST');result.undo=b.undo??false;break;
 case 'douyin_comment':keys(b,['aweme_id','text','reply_cid']);Object.assign(result,{aweme_id:videoId(b.aweme_id),text:string(b.text,500),reply_cid:b.reply_cid===undefined?'':string(b.reply_cid,64,true)});break;
 case 'douyin_chat_send':keys(b,['nickname','peer_id','text']);Object.assign(result,{nickname:string(b.nickname,80),peer_id:string(b.peer_id,128),text:string(b.text,1000)});break;
 case 'douyin_share_video':keys(b,['aweme_id','nickname','peer_id']);Object.assign(result,{aweme_id:videoId(b.aweme_id),nickname:string(b.nickname,80),peer_id:string(b.peer_id,128)});break;
 case 'douyin_publish':keys(b,['attachmentId','title','tags','draft','ai_declare']);if(typeof b.draft!=='boolean'||typeof b.ai_declare!=='boolean')throw new InputError('INVALID_REQUEST');Object.assign(result,{attachmentId:string(b.attachmentId,64),title:string(b.title,100),tags:string(b.tags??'',200,true),draft:b.draft,ai_declare:b.ai_declare});break;
 default:throw new InputError('TOOL_NOT_ALLOWED',403);
 }return result;
}
// Upstream errors and browser diagnostics may contain URLs/cookies/paths: expose only typed product fields.
export function publicResult(raw:Record<string,unknown>){const out:Record<string,unknown>={};for(const k of ['ok','loggedIn','needLogin','uid','nickname','aweme_id','title','desc','author','url','source','count','liked','verified','changed','status','platformId','draftId','draft','messageId','text','cid','create_time','publish_time']){const v=raw[k];if(typeof v==='string')out[k]=v.slice(0,4000);else if(typeof v==='number'||typeof v==='boolean')out[k]=v;}for(const k of ['items','comments'])if(Array.isArray(raw[k]))out[k]=(raw[k] as unknown[]).slice(0,50).map(x=>publicResult(object(x)));if(raw.needLogin)out.error='DOUYIN_LOGIN_REQUIRED';else if(raw.ok!==true)out.error=raw.status==='unknown'?'ACTION_UNKNOWN':'DOUYIN_ACTION_FAILED';else if(raw.source==='none')out.error='DOUYIN_PAGE_CHANGED';return out;}
