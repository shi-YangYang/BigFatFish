import {OneBotTransport} from './transport.js';
import type {QQAction,QQConnection,Segment} from '../types.js';

export class QQClient extends OneBotTransport implements QQConnection {
  beforeIo(guard:()=>void){try{guard();}catch(error){throw new Error('SEND_NOT_STARTED',{cause:error});}}
  async action(name:QQAction,params:Record<string,unknown>,guard:()=>void) {
    const actions={history_private:'get_friend_msg_history',history_group:'get_group_msg_history',message:'get_msg',recall:'delete_msg',group_card:'set_group_card',like:'send_like',reaction:'set_msg_emoji_like',profile:'get_stranger_info',profile_update:'set_qq_profile',avatar:'set_qq_avatar',posts:'get_qzone_msg_list',post:'send_qzone_msg',space_profile:'get_qzone_profile',space_update:'set_qzone_profile'};
    if(!Object.hasOwn(actions,name))throw new Error('QQ_TOOL_UNSUPPORTED');
    await this.readyToSend(guard);this.beforeIo(guard);
    return this.request(actions[name],params,30000);
  }
  async poke(kind:string,id:string,userId:string,guard:()=>void){await this.readyToSend(guard);this.beforeIo(guard);await this.request('send_poke',{user_id:userId,...(kind==='group'?{group_id:id}:{})});}
  async send(kind:string,id:string,message:Segment[],guard:()=>void) {
    await this.readyToSend(guard);this.beforeIo(guard);
    if(message.length===1&&message[0]!.type==='file'){const part=message[0]!;const result=await this.request(kind==='group'?'upload_group_file':'upload_private_file',{[kind==='group'?'group_id':'user_id']:id,file:part.data.file,name:part.data.name},30000);if(typeof result?.file_id!=='string'||!result.file_id)throw new Error('SEND_UNKNOWN');return {messageId:result.file_id};}
    const result=await this.request(kind==='group'?'send_group_msg':'send_private_msg',{[kind==='group'?'group_id':'user_id']:id,message});
    const mid=typeof result?.message_id==='string'?result.message_id:Number.isSafeInteger(result?.message_id)?String(result?.message_id):'';
    if(!/^-?[0-9]{1,64}$/.test(mid))throw new Error('SEND_UNKNOWN');
    return {messageId:mid};
  }
  async media(kind:string,file:string,guard:()=>void){
    if(!/^[a-fA-F0-9]{32}(\.[a-zA-Z0-9]{1,8})?$/.test(file))throw new Error('MEDIA_REFERENCE_UNSUPPORTED');
    const generation=this.generation;const login=await this.request('get_login_info',{}),status=await this.request('get_status',{});
    if(generation!==this.generation||String(login?.user_id)!==this.config.accountId||status?.online!==true)throw new Error('NOT_CONNECTED');guard();
    const result=await this.request(kind==='record'?'get_record':'get_image',kind==='record'?{file,out_format:'wav'}:{file},30000);
    guard();if(generation!==this.generation||typeof result?.base64!=='string'||result.base64.length>2_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64))throw new Error('MEDIA_BYTES_UNAVAILABLE');return result.base64;
  }
}
