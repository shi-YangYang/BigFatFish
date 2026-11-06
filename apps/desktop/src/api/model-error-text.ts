/** Only locally defined codes are rendered; provider messages never enter the UI. */
const messages:Record<string,string>={
 MODEL_RUN_FAILED:'模型未能完成回复，具体原因未记录。',
 EMPTY_MODEL_RESPONSE:'模型没有返回回复内容。',
 ENGINE_REQUEST_FAILED:'模型请求未完成，请检查模型连接。',
 GENERATION_FAILED:'回复生成失败，具体原因未记录。',
 MODEL_NETWORK_ERROR:'无法连接模型服务，请检查网络与服务地址。',
 MODEL_STREAM_INTERRUPTED:'模型响应途中断开，回复未完成。',
 MODEL_RESPONSE_TOO_LARGE:'模型响应超过大小限制，回复未完成。',
 MODEL_TIMEOUT:'等待模型回复超时。',
 MODEL_REDIRECT_DENIED:'模型地址发生重定向，请填写最终服务地址。',
 MODEL_NOT_CONFIGURED:'请先配置聊天模型。',
 MODEL_AUTH_FAILED:'模型鉴权失败，请检查 API Key。',
 MODEL_ACCESS_DENIED:'模型服务拒绝访问，请检查账号或模型权限。',
 MODEL_RATE_LIMIT:'模型请求过于频繁或额度不足，请稍后重试。',
 MODEL_SERVICE_UNAVAILABLE:'模型服务暂时不可用，请稍后重试。',
};
export function modelErrorText(code:string):string|undefined{
 const match=/^MODEL_HTTP_([45]\d{2})$/.exec(code);
 if(!match)return typeof messages[code]==='string'?messages[code]:undefined;
 const status=Number(match[1]);
 const reason=status===401?'模型鉴权失败，请检查 API Key':status===403?'模型服务拒绝访问，请检查账号或模型权限':status===404||status===405?'模型接口不存在，请检查服务地址和模型名称':status===408||status===504?'模型服务响应超时':status===429?'模型请求过于频繁或额度不足':status>=500?'模型服务暂时不可用':'模型服务未接受请求，请检查模型设置';
 return `${reason}（HTTP ${status}）。`;
}
