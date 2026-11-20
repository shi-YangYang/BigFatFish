import {InputError,object,string} from '../ai/types.js';
import type {EngineTool} from '../ai/engine.js';
import type {Command} from './group-intent.js';

const labels=(command:Command)=>command.tool==='publish_qzone_post'?['说说','发说说']:command.tool==='set_qq_avatar'?['头像','修改头像']:command.field==='signature'?['签名','修改签名']:['昵称','修改昵称'];

// Expose only the property and image source authorized in this message. The
// original tools still enforce options, per-account budgets and view receipts.
export function scopedGroupTool(command:Command,tools:EngineTool[],builtinIds:readonly string[],checkImage:(reference:string)=>void):EngineTool[]{
  const tool=tools.find(t=>t.name===command.tool);
  if(!tool)return [];
  const profile=command.tool==='set_qq_profile',post=command.tool==='publish_qzone_post';
  const image=!profile?command.image:undefined;
  const keys=[...(profile?[command.field]:post?['content']:[]),...(image?['image']:[])];
  const references=image==='builtin'?builtinIds:image?[image]:[];
  const required=Object.fromEntries(keys.map(k=>[k,k==='image'?{type:'string',enum:references}:{type:'string'}]));
  let attempted:Promise<unknown>|undefined;
  return [{name:tool.name,description:profile?'只按发言人指定的新值修改自己的 '+(command.field==='nickname'?'QQ 昵称。':'QQ 个性签名。'):
    (post?'发表本条指令要求的说说。指定正文时原样使用，未指定就创作可公开的新内容。'+(command.purpose?'本条发布目的：'+command.purpose+'。':''):'修改鱼自己的 QQ 头像。')+
    (image?(image==='builtin'?'先用 get_sticker_image 查看枚举中的内置图，再提交相同 image。':'先用 get_message_images 查看指定索引，再按枚举提交 image。'):'只发文字。'),
    parameters:{type:'object',properties:required,required:keys,additionalProperties:false},
    execute:async(args,signal)=>{
      signal.throwIfAborted();const body=object(args);
      const expected=profile?command.value:post?command.value:undefined;
      if(Object.keys(body).some(k=>!keys.includes(k))||keys.some(k=>typeof body[k]!=='string')||
        expected!==undefined&&body[profile?command.field:'content']!==expected||
        image&&!references.includes(string(body.image,100)))throw new InputError('QQ_COMMAND_MISMATCH');
      if(image)checkImage(string(body.image,100));
      // Don't reuse a changed image nor retry a write with an uncertain outcome.
      return attempted??=tool.execute(Object.fromEntries(keys.map(k=>[k,body[k]])),signal).then(result=>({status:object(result).status}));
    }}];
}

export function unavailableCommandNotice(command:Command,enabled:boolean,hasAccountActions:boolean){
  const [subject,action]=labels(command),notDone=command.tool==='publish_qzone_post'?'说说没发':subject+'没改';
  if(!enabled)return notDone+'，'+(command.tool==='publish_qzone_post'?'发说说':'修改 QQ 资料')+'的开关已关闭。';
  if(!hasAccountActions)return notDone+'，当前 QQ 连接不支持'+action+'。';
  return '这次没能'+action+'。';
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
          if(code==='QQ_COMMAND_MISMATCH'||code==='STICKER_VIEW_REQUIRED')this.result=undefined;
          this.failure=code==='QQ_ACTION_DAILY_LIMIT'?'今天的操作次数已经用完了。'
            :code==='QQ_TOOL_UNSUPPORTED'?'当前连接的 QQ 服务不支持这项操作。'
            :code==='ACTION_REJECTED'?'QQ 服务没有接受这次操作。'
            :code==='STICKER_VIEW_REQUIRED'?'没有修改：请先查看所选图片。'
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
  notice(){return this.failure??(!this.invoked?(this.command.tool==='publish_qzone_post'?'这条说说还没发出去。':'这次没有修改 QQ '+labels(this.command)[0]+'。'):undefined);}
}
