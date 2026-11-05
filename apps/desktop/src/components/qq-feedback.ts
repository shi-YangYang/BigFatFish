import {modelErrorText} from '../model-error-text';
export interface QQDelivery {id:string;target:string;status:string;error?:string|null;createdAt:string;proactive:boolean}
const reasons:Record<string,string>={
 PERMISSION_REVOKED:'回复设置已变化或对象不在允许范围，消息未发送。',
 MEMORY_SCOPE_CHANGED:'记忆共享范围已变化，回复未发送。',
 CHANNEL_OFFLINE:'QQ 未连接，消息未发送。',
 QUEUE_FULL:'待回复消息过多，这条消息未处理。',
 MESSAGE_TOO_LONG:'回复超过长度限制，未发送。',
 CANCELLED:'本次回复已取消。',RUNTIME_RESTARTED:'服务重启，本次回复已中断。',
 ACTION_REJECTED:'QQ 服务未接受这条消息。',SEND_UNKNOWN:'请到 QQ 核实是否收到，避免重复发送。',
 PLUGIN_DISABLED:'QQ 插件已停用，消息未发送。',STICKER_CHANGED:'所选表情已变化，回复未发送。',STICKER_NOT_FOUND:'所选表情已删除，回复未发送。',
 INVALID_SEGMENTS:'回复内容格式不受支持，未发送。',INVALID_TEXT:'回复内容无效，未发送。',
};
export function deliveryFeedback(item:Pick<QQDelivery,'status'|'error'|'proactive'>){
 const {status,error,proactive}=item;
 const modelReason=error?modelErrorText(error):undefined;
 if(status==='sent')return {label:'已发送',detail:''};
 if(status==='unknown')return {label:'发送结果未知',detail:reasons.SEND_UNKNOWN!};
 if(status==='interrupted'||error==='CANCELLED'||error==='RUNTIME_RESTARTED'){
  const action=proactive?'发送':'回复';
  return {label:`${action}已中断`,detail:error==='CANCELLED'?`本次${action}已取消。`:error==='RUNTIME_RESTARTED'?`服务重启，本次${action}已中断。`:`本次${action}未完成。`};
 }
 if(modelReason||status==='failed'&&!proactive&&error!=='ACTION_REJECTED')return {label:'回复生成失败',detail:modelReason??'未能生成回复，具体原因未记录。'};
 const labels:Record<string,string>={sending:'正在发送',queued:proactive?'等待发送':'等待回复',generating:'正在回复',failed:'发送失败',blocked:'未发送',revoked:'未发送'};
 return {label:labels[status]??'状态待确认',detail:error?(reasons[error]??'未能完成这次操作，具体原因未记录。'):['failed','blocked','revoked'].includes(status)?'消息未发送，具体原因未记录。':''};
}
export function deliveryTarget(value:string){try{const target=JSON.parse(value);if(['private','group'].includes(target.kind)&&/^\d{1,64}$/.test(String(target.id)))return `${target.kind==='group'?'群':'私聊'} ${target.id}`;}catch{/* Legacy malformed targets stay readable. */}return 'QQ 消息';}
export function qqAuditText(event:string){
 const kind=event.split(':')[0]??'';
 const labels:Record<string,string>={'qq.configured':'回复设置已更新','qq.blocked':'消息未发送','qq.failed':'回复生成失败','qq.interrupted':'回复已中断','qq.send.started':'开始发送消息','qq.send.sent':'QQ 已确认发送','qq.send.blocked':'消息未发送','qq.send.failed':'QQ 发送失败','qq.send.unknown':'发送结果待核实'};
 return labels[kind]??'历史操作记录';
}
export function sendFailureFeedback(error:unknown){
 const code=error instanceof Error?error.message:String(error);
 // These failures happen before Channels.send accepts any external send.
 const rejected:Record<string,string>={PERMISSION_REVOKED:reasons.PERMISSION_REVOKED!,CHANNEL_OFFLINE:reasons.CHANNEL_OFFLINE!,PLUGIN_DISABLED:reasons.PLUGIN_DISABLED!,MESSAGE_TOO_LONG:reasons.MESSAGE_TOO_LONG!,INVALID_PLATFORM_ID:'发送对象无效，请重新选择。',FILE_MUST_BE_SINGLE:'文件消息不能同时包含文字。',UNSUPPORTED_MESSAGE_TYPE:'不支持这种消息类型。',INVALID_REQUEST:'请检查消息内容和发送对象。',INVALID_TARGET:'请选择有效的发送对象。',CHANNEL_NOT_CONFIGURED:'请先连接 QQ。',MEDIA_TOO_LARGE:'附件过大，请重新选择。',UNSUPPORTED_MEDIA_FORMAT:'附件格式不受支持。',UNSAFE_MEDIA_REFERENCE:'附件内容无效，请重新选择。',INVALID_SEGMENTS:'消息内容格式不受支持。',INVALID_TEXT:'请输入有效的消息内容。',WEB_LOGIN_REQUIRED:'请重新登录后发送。',WEB_CSRF_DENIED:'登录状态已变化，请重新登录。',QQ_APPROVAL_REMOVED:'请使用直接发送。'};
 return typeof rejected[code]==='string'?`未发送：${rejected[code]}`:'未取得发送结果，请到 QQ 核实，避免重复发送。';
}
