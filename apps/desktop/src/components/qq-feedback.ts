export function qqAuditText(event:string){
 const kind=event.split(':')[0]??'';
 const labels:Record<string,string>={'qq.reply.skipped':'本轮未接话','qq.send.partial':'部分消息已发送，后续已停止','qq.configured':'回复设置已更新','qq.blocked':'消息未发送','qq.failed':'回复生成失败','qq.interrupted':'回复已中断','qq.send.started':'开始发送消息','qq.send.sent':'QQ 已确认发送','qq.send.blocked':'消息未发送','qq.send.failed':'QQ 发送失败','qq.send.unknown':'发送结果待核实'};
 return labels[kind]??'历史操作记录';
}
