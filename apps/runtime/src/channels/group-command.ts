import {InputError,object,string} from '../ai/types.js';
import type {EngineTool} from '../ai/engine.js';
import type {QQConfig} from './types.js';
import type {inbound} from './protocol.js';

type Command = {tool:'set_qq_profile'; value:string} | {tool:'publish_qzone_post'; value?:string};
type Inbound = NonNullable<ReturnType<typeof inbound>>;

// This is an admission check, never an executor. Match the whole, directly
// authored command, not keywords from a quote, a model, history or OCR.
export function ownerCommand(event:Inbound, config:QQConfig):Command|undefined {
  if((event.target.kind==='group'&&!config.groups.includes(event.target.id))||event.author!==config.ownerId||!event.identity||
    !event.parts.every(p=>p.type==='text'||(p.type==='at'&&p.data.qq===config.accountId))) return;
  const raw=event.text.trim();
  if(!raw||raw.length>750||/[\r\n]/u.test(raw)) return;
  const text=raw.replace(/^(?:大肥鱼|小肥鱼|鱼鱼)[，,：:\s]*/u,'')
    .replace(/^(?:麻烦你|请你|请|帮我|你帮我|你给我|你|现在)?(?:现在)?(?:去)?/u,'');
  // A missing name is not permission to invent one. Bare names have a
  // deliberately small grammar; quoted names can contain punctuation.
  const rename=/^(?:(?:把|将)(?:你(?:自己)?的|自己(?:的)?)?\s*(?:QQ\s*)?(?:昵称|名字)(?:改成|改为|换成)|(?:改名|改昵称)(?:为|叫|成))\s*(?:「([^「」]{1,32})」|“([^“”]{1,32})”|([\p{L}\p{N}_·-]{1,24}))[。！!]?$/iu.exec(text);
  if(rename){
    const name=(rename[1]??rename[2]??rename[3]!).trim();
    // Text after an unquoted operand can be part of a question or condition,
    // not a nickname. Longer or sentence-like names need explicit quotes.
    if(!name||(rename[3]&&(Array.from(name).length>10||/如果|的话|不要|不用|别改|还是|或者|只是|试试|了吗|能否|可以|怎么|什么|行不行|之后|然后|举例|比如|好不好|会不会|是不是|[吗么吧呢呗？?]$/u.test(name))))return;
    return {tool:'set_qq_profile',value:name};
  }
  const post=/^(?:在(?:QQ)?空间)?(?:发|发布)(?:一?[条个]|一下)?(?:QQ空间|空间)?说说(?:[吧呀啊啦哦呗]?[。！!]?|[：:]\s*(.{1,600})|[，,]\s*内容(?:是|为|[：:])\s*(.{1,600}))$/iu.exec(text);
  if(post){const value=(post[1]??post[2])?.trim();if(value!==undefined&&!value)return;return {tool:'publish_qzone_post',value};}
}

// Return only the admitted capability. Its arguments cannot change scope,
// carry private fields/photos, or leak the signature read back by the adapter.
export function scopedGroupTool(command:Command,tools:EngineTool[]):EngineTool[] {
  const tool=tools.find(t=>t.name===command.tool);
  if(!tool)return [];
  const rename=command.tool==='set_qq_profile',key=rename?'nickname':'content';
  let attempted:Promise<unknown>|undefined;
  return [{name:tool.name,description:rename?'按本条明确指令修改自己的QQ昵称；nickname 必须等于指定昵称。':'按本条明确指令发表一条纯文字说说；有指定正文时原样使用。没有指定时只用可公开的新内容，不复述聊天或记忆。',parameters:{type:'object',properties:{[key]:{type:'string'}},required:[key],additionalProperties:false},
    execute:async(args,signal)=>{
      signal.throwIfAborted();const body=object(args),value=string(body[key],rename?32:600);
      if(Object.keys(body).some(k=>k!==key)||(command.value!==undefined&&value!==command.value))throw new InputError('QQ_COMMAND_MISMATCH');
      // Even if the model rephrases after a missing receipt, don't issue a second write.
      attempted??=tool.execute({[key]:value},signal).then(result=>({status:object(result).status}));
      return attempted;
    },
  }];
}

// Used only for a verified command whose specific write tool was not offered.
export function unavailableCommandNotice(command:Command,enabled:boolean,hasAccountActions:boolean){
  const post=command.tool==='publish_qzone_post';
  if(!enabled)return post?'说说没发，发说说的开关已关闭。':'昵称没改，修改 QQ 资料的开关已关闭。';
  if(!hasAccountActions)return post?'说说没发，当前 QQ 连接不支持发说说。':'昵称没改，当前 QQ 连接不支持修改昵称。';
  return post?'这次没能发说说。':'这次没能修改 QQ 昵称。';
}

// On an unambiguous *available* action, give a premature reply one chance to
// use the tool. Never synthesize the write or repeat an uncertain operation.
export class RequestedQQAction {
  private premature=false;
  private invoked=false;
  private result?:Promise<unknown>;
  private failure?:string;
  constructor(private command:Command){}
  wrap(tools:EngineTool[]):EngineTool[]{
    return tools.map(tool=>{
      if(tool.name===this.command.tool)return {...tool,execute:async(args,signal)=>{
        this.invoked=true;
        signal.throwIfAborted();
        this.result??=tool.execute(args,signal);
        try{const result=await this.result;this.failure=undefined;return result;}
        catch(error){const code=error instanceof Error?error.message:'';
          // Only a rejected local argument, before a write, may be corrected.
          if(code==='QQ_COMMAND_MISMATCH')this.result=undefined;
          this.failure=code==='QQ_ACTION_DAILY_LIMIT'?'今天的操作次数已经用完了。'
            :code==='QQ_TOOL_UNSUPPORTED'?'当前连接的 QQ 服务不支持这项操作。'
            :code==='ACTION_REJECTED'?'QQ 服务没有接受这次操作。'
            :code==='QQ_COMMAND_MISMATCH'||code==='INVALID_REQUEST'?'这次没有执行：操作参数和指令不匹配。'
            :'没有拿到可确认的操作结果，我不会重复操作。';throw error;}
      }};
      if(tool.concludesTurn)return {...tool,execute:async(args,signal)=>{
        if(!this.invoked&&!this.premature){this.premature=true;throw new InputError('QQ_REQUESTED_TOOL_PENDING');}
        return tool.execute(args,signal);
      }};
      return tool;
    });
  }
  notice(){return this.failure??(!this.invoked?(this.command.tool==='publish_qzone_post'?'这条说说还没发出去。':'这次没有改 QQ 昵称。'):undefined);}
}
