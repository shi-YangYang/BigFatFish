import {publicMoodSignature,type Exchange} from '../account/signature-exchange.js';
import type {EngineTool} from '../../ai/engine/contract.js';
import {InputError,object,string} from '../../ai/types.js';
import type {GroupSource} from './group-intent.js';

const writeTools=new Set(['set_qq_profile','set_qq_avatar','publish_qzone_post','set_group_card']);
const schema=(properties:Record<string,unknown>,required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
type Action='nickname'|'signature'|'mood_signature'|'card'|'avatar'|'post';
interface Proposal {action:Action;value:string|null;image:string|null;followup:boolean}

const askSignature='签名没有改。想把我的 QQ 签名改成哪句话？也可以让我按现在的心情写一句。';
function proposed(name:string,args:unknown,src:GroupSource,refs:string[],allowMood:boolean):Proposal{
  const b=object(args),followup=b.followup===true;
  if(Object.hasOwn(b,'followup')&&(!followup||name!=='set_qq_profile'||(!Object.hasOwn(b,'signature')&&!Object.hasOwn(b,'signatureFrom'))))
    throw new InputError('QQ_COMMAND_MISMATCH');
  const keys=Object.keys(b).filter(k=>k!=='followup');
  if(name==='set_qq_profile'&&Object.hasOwn(b,'signatureFrom')){
    if(!allowMood||keys.length!==1||b.signatureFrom!=='current_mood')throw new InputError('QQ_COMMAND_MISMATCH');
    return {action:'mood_signature',value:null,image:null,followup};
  }
  const action=name==='set_qq_profile'?(Object.hasOwn(b,'signature')?'signature':'nickname'):
    name==='set_group_card'?'card':name==='set_qq_avatar'?'avatar':'post';
  const allowed=action==='post'?['content','image']:action==='avatar'?['image']:[action];
  if(keys.some(k=>!allowed.includes(k)))throw new InputError('QQ_COMMAND_MISMATCH');
  const value=action==='avatar'?null:string(b[action==='post'?'content':action],
    action==='post'?600:action==='signature'?160:action==='card'?60:32);
  if(value!==null&&action!=='post'&&!src.text.includes(value))throw new InputError('QQ_COMMAND_MISMATCH');
  const image=b.image===undefined?null:string(b.image,100);
  if((action==='avatar'&&!image)||(image&&!refs.includes(image)))throw new InputError('QQ_COMMAND_MISMATCH');
  return {action,value,image,followup};
}

// Intent belongs to the chat model; the host enforces the current scope,
// argument constraints and a single account write per inbound message.
export class GroupWrites{
  private attempt?:{key:string;result:Promise<unknown>};
  private outcome?:string;
  private reliedOn?:Exchange;
  private tried=false;
  private prior?:Exchange;
  constructor(private source:GroupSource|undefined,private builtinIds:string[],private viewed:(reference:string)=>void,
    private guard:()=>void,
    private signature?:{previous:()=>Exchange|undefined;mood:()=>string}){this.prior=signature?.previous();}
  attempted(){return this.tried;}
  assertFollowup(){if(this.reliedOn&&this.signature?.previous()!==this.reliedOn)throw new InputError('QQ_CLARIFICATION_EXPIRED');}
  notice(){return this.outcome;}
  tools(base:EngineTool[]){
    const src=this.source;
    if(!src)return [];
    const refs=[...this.builtinIds,...Array.from({length:src.images},(_,i)=>'message:'+(i+1))];
    const image={type:'string',enum:refs},field={type:'string'};
    return base.filter(t=>writeTools.has(t.name)&&(src.owner||t.name==='set_group_card')&&
      (t.name!=='set_qq_avatar'||refs.length>0)&&(t.name!=='set_group_card'||src.images===0)).map(t=>{
      const profile=t.name==='set_qq_profile',card=t.name==='set_group_card',avatar=t.name==='set_qq_avatar';
      return {name:t.name,description:profile?'修改自己的 QQ 昵称或签名。只选一个字段：nickname 或 signature 逐字取本条原文；明确委托按我的当前心情写签名用 signatureFrom=current_mood，不自拟正文。如依赖上一轮签名追问，须使用 followup:true；工具不含 followup 参数时只执行本条独立完整的指令。':
        card?'只改鱼在本群的名片，不改 QQ 昵称或他人资料；新名片逐字来自本条发言。':
        (avatar?'更新自己的 QQ 头像。':'发表本条明确要求的公开说说；指定正文原样使用，未指定可按主题创作。')+
          '配图只能选枚举中的、已实际查看的启用内置图或发言人本条指定的附件。',
        parameters:profile?schema({signature:field,nickname:field,...(this.signature?{signatureFrom:{type:'string',enum:['current_mood']}}:{}),...(this.prior?{followup:{type:'boolean',enum:[true]}}:{})}):card?schema({card:field},['card']):avatar?schema({image},['image']):
          schema({content:field,...(refs.length?{image}:{})},['content']),
        execute:async(args:unknown,s:AbortSignal)=>{
          this.tried=true;this.guard();s.throwIfAborted();
          let proposal:Proposal;
          try{
            proposal=proposed(t.name,args,src,refs,!!this.signature&&src.owner);
            if(proposal.image)this.viewed(proposal.image);
          }catch(error){
            if(!this.attempt)this.outcome=error instanceof Error&&error.message==='STICKER_VIEW_REQUIRED'
              ?'没有执行：需要先看过选用的图片。':profile&&args&&typeof args==='object'&&('signature' in args||'signatureFrom' in args)?askSignature:'这次没有执行。请告诉我要改哪一项、改成什么，或想发什么。';
            throw error;
          }
          const {action,value,image:ref}=proposal;
          const key=JSON.stringify(proposal);
          if(this.attempt){
            if(this.attempt.key!==key)throw new InputError('QQ_COMMAND_MISMATCH');
            return this.attempt.result;
          }
          const run=async()=>{
            this.outcome=undefined;
            try{
              if(proposal.followup){
                if(!this.prior)throw new InputError('QQ_CLARIFICATION_EXPIRED');
                this.reliedOn=this.prior;
              }
              this.assertFollowup();
              const mood=action==='mood_signature';
              const actual=mood?publicMoodSignature(this.signature!.mood()):value;
              if(mood&&!actual)throw new InputError('QQ_MOOD_UNAVAILABLE');
              const result=object(await t.execute({...(!avatar?{[mood?'signature':action==='post'?'content':action]:actual}:{}),...(ref?{image:ref}:{})},s));
              return {status:result.status,...(mood&&['verified','unchanged'].includes(String(result.status))?{signature:actual}:{})}; // never return existing profile data to the group
            }catch(error){
              const code=error instanceof Error?(error.message==='SEND_NOT_STARTED'&&error.cause instanceof Error?error.cause.message:error.message):'';
              this.outcome=code==='QQ_CLARIFICATION_EXPIRED'?'刚才的追问已结束。请重新告诉我要怎么改签名。':
                code==='QQ_MOOD_UNAVAILABLE'?'现在读不到这边的心情，签名没有改。':code==='QQ_ACTION_DAILY_LIMIT'?'今天的操作次数已经用完了。':
                code==='QQ_TOOL_UNSUPPORTED'?'当前 QQ 服务不支持这项操作。':
                code==='ACTION_REJECTED'?'QQ 服务没有接受这次操作。':'没有拿到可确认的操作结果，我不会重复操作。';
              throw error;
            }
          };
          const result=run();this.attempt={key,result};return result;
        }
      };
    });
  }
}
