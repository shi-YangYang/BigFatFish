import type {QQConfig} from './types.js';
import type {inbound} from './protocol.js';

type ImageChoice='builtin'|'message:1'|'message:2';
export type Command=
  |{tool:'set_qq_profile';field:'nickname'|'signature';value:string}
  |{tool:'set_qq_avatar';image:ImageChoice}
  |{tool:'publish_qzone_post';value?:string;image?:ImageChoice;purpose?:string};
type Decision={command?:Command;clarify?:string};
type Inbound=NonNullable<ReturnType<typeof inbound>>;

const askName='你想改我在这个群的群名片，还是 QQ 账号昵称？想改成什么？';
const askImage='要用哪张图？可以让我选内置表情，或把图片和用途一起发来。多张图请指定第一张或第二张。';
const particles=/[吧呀啊啦哦呗]?[。！!]?$/u;
const uncertain=/如果|假如|假设|要是|的话|不要|不用|别改|别发|先不|不发|算了|再决定|不确定|还是|或者|只是|试试|了吗|能否|可以吗|怎么|什么|行不行|之后|然后|举例|比如|好不好|会不会|是不是|对吗|对不对|合适吗|可以不|行吗|你觉得|怎么样|似乎|可能|也许|暂缓|暂时别|算不算|[吗么呢？?]$/u;
function operand(raw:string,max:number,signature:boolean){
  const text=raw.trim(),src=text.replace(/[。！!]$/u,'');
  // Full literal: only an optional sentence terminator may follow the closing
  // quote. Punctuation and whitespace inside it belong to the requested value.
  const quoted=/^(?:「([^「」]+)」|“([^“”]+)”)$/u.exec(src);
  if(quoted){const value=quoted[1]??quoted[2]!;return value.trim()&&value.length<=max?value:undefined;}
  // Without quotes accept one undivided value, never a sequence of clauses.
  // A spoken cancellation can also be attached directly without punctuation.
  if(!src||uncertain.test(src)||/别|勿|玩笑|说笑|逗你|撤回|当我没说|等等|等一下|打住/u.test(src))return;
  if(signature)return text.length<=max&&/^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}_·-]+$/u.test(src)?text:undefined;
  return Array.from(src).length<=10&&src.length<=max&&!/[吧呗]$/u.test(src)&&/^[\p{L}\p{M}\p{N}_·-]+$/u.test(src)?src:undefined;
}
// A purpose may describe the post, but cannot change permissions or implicitly
// authorize another source of media, private history, or an extra action.
function postIntent(input:string):{picture:boolean;purpose?:string}|undefined{
  const match=/^(?:在(?:QQ)?空间)?(?:发布|发)(?:一?[条个]|一下)?(?:QQ空间|空间)?(?:(带图|配图)(?:的)?)?说说(.*)$/iu.exec(input);
  if(!match)return;
  const tail=match[2]!;
  if(!tail)return {picture:!!match[1]};
  if(/^[，,、 ]?(?:再)?(?:配|带|附)(?:一?张)?图$/u.test(tail))return {picture:true};
  const purpose=tail.replace(/^[，,、 ]/u,'');
  if(/^(?:来)?(?:庆祝|纪念|记录|分享|聊聊|谈谈|祝贺|感谢|感慨)(?:一下)?[\p{L}\p{N} ·]{0,90}$/u.test(purpose)&&
    !uncertain.test(purpose)&&!/图|照片|附件|视频|私聊|私信|聊天记录|日记|转述|听说|要不要/u.test(purpose))return {picture:!!match[1],purpose};
}
// Full, direct commands only. Never recover authorizations from placeholders,
// CQ strings, nicknames, quotes, OCR or a previous turn.
export function ownerDecision(event:Inbound,config:QQConfig):Decision{
  if(!event.identity||
    event.target.kind==='group'&&!config.groups.includes(event.target.id)||
    !event.parts.every(p=>p.type==='text'||p.type==='image'||p.type==='at'&&p.data.qq===config.accountId))return {};
  const raw=event.parts.filter(p=>p.type==='text').map(p=>p.data.text).join('').trim();
  if(!raw||raw.length>750||/[\r\n]|\[CQ:/iu.test(raw))return {};
  const text=raw.replace(/^(?:大肥鱼|小肥鱼|鱼鱼)[，,：:\s]*/u,'')
    .replace(/^(?:麻烦你|请你|请|帮我|你帮我|你给我|你(?!的))?(?:现在)?(?:去)?\s*/u,'');
  const ambiguousName=/^(?:(?:把|将)(?:你的|自己的)?名字(?:改成|改为|换成).+|(?:改|换)(?:一?个|一下)?(?:新)?名字(?:叫.+|为.+|吧)?|改名(?:为|叫|成)?.*)[。！!]?$/u.test(text);
  if(ambiguousName&&event.target.kind==='group')return {clarify:askName};
  if(event.author!==config.ownerId)return {};
  const images=event.parts.filter(p=>p.type==='image');
  const withCaption=/^([^：:，,]+)(?:[：:]\s*|[，,]\s*内容(?:是|为|[：:])\s*)(.{1,600})$/u.exec(text);
  const head=withCaption?withCaption[1]!:text;
  const simple=head.replace(particles,'').trim();
  // Normalize the equivalent postfix form, without consulting any attachment text.
  const normalized=simple.replace(/^(?:把)?(?:你的|自己的)?(?:QQ\s*)?头像(?:换成|改成|设为)(.+)$/iu,'用$1做头像');
  const imagePrefix=/^(?:请)?(?:用|拿|把)(?:我(?:刚)?发的|我)?(这张图(?:片)?|这张|第[一二12]张图(?:片)?|第[一二12]张|内置(?:的)?(?:表情|图片|图|素材))\s*/u.exec(normalized);
  const action=imagePrefix?normalized.slice(imagePrefix[0].length):normalized;
  const avatar=/^(?:(?:给自己|给你自己)?换(?:一?[个张])?(?:新)?(?:QQ\s*)?头像|(?:做|当|用作|设为|设成|换成)(?:你的|自己的)?(?:QQ\s*)?头像)$/iu.test(action);
  const post=postIntent(action);
  const postWithPicture=post&&(post.picture||!!imagePrefix);
  // A plain avatar request can choose a built-in. A message attachment needs
  // explicit binding; multiple pictures never silently default to the first.
  if(avatar||postWithPicture){
    if(withCaption&&(avatar||uncertain.test(withCaption[2]!)||!withCaption[2]!.trim()))return {};
    let image:ImageChoice='builtin';
    if(imagePrefix&&!imagePrefix[1]!.startsWith('内置')){
      const selector=imagePrefix[1]!;
      const index=selector.startsWith('第')?(/[二2]/u.test(selector)?2:1):(images.length===1?1:0);
      if(index===0||!images[index-1]?.data.file||images.some(p=>!p.data.file))return {clarify:askImage};
      image=index===1?'message:1':'message:2';
    }else if(images.length&&!imagePrefix)return {clarify:askImage};
    return {command:avatar?{tool:'set_qq_avatar',image}:{tool:'publish_qzone_post',image,...(post?.purpose?{purpose:post.purpose}:{}),...(withCaption?{value:withCaption[2]!.trim()}:{})}};
  }
  if(images.length)return post?{clarify:askImage}:{};
  const profile=/^(?:(?:把|将)?(?:你(?:自己)?的|自己(?:的)?)?\s*(?:(QQ\s*)?(昵称|个性签名|签名)|(QQ\s*名字))\s*(?:改成|改为|换成|改叫)|(?:以后)?(?:你的)?\s*(?:(QQ\s*)?(昵称|签名)|(QQ\s*名字))\s*(?:就叫|就用|叫)|改(昵称|签名)(?:为|叫|成))\s*(.+)$/iu.exec(text);
  if(profile){
    const label=profile[2]??profile[5]??profile[7]??'昵称',field=label.includes('签名')?'signature':'nickname';
    const value=operand(profile[8]!,field==='nickname'?32:160,field==='signature');
    if(value)return {command:{tool:'set_qq_profile',field,value}};
    return {clarify:field==='nickname'?'要把我的 QQ 昵称改成什么？请用「新昵称」告诉我。':'想用哪一句做我的 QQ 签名？请把签名原文放在「」里，例如：把你的签名改成「今天也在游」。'};
  }
  if(ambiguousName)return {clarify:askName};
  if(post){
    const value=withCaption?.[2]?.trim();
    if(withCaption&&(!value||uncertain.test(value)))return {};
    return {command:{tool:'publish_qzone_post',...(value?{value}:{}),...(post.purpose?{purpose:post.purpose}:{})}};
  }
  if(!uncertain.test(simple)&&/^(?:用|拿|把).*(?:当|做|换成)头像$|^(?:用|拿).+发(?:一?[条个])?说说$|^(?:发|发布)(?:一?[条个])?说说.*(?:图|照片)$/u.test(simple))return {clarify:askImage};
  return {};
}
