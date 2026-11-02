import { invoke } from '@tauri-apps/api/core';
export const api = <T>(route: string, method = 'GET', body?: unknown) => invoke<T>('runtime_request', { route, method, body });
const errors: Record<string,string> = { NOT_RUNNING: '服务尚未启动，请先启动 BigFatFish。', UNAVAILABLE: '无法连接服务，请检查运行状态。', MODEL_NOT_CONFIGURED: '请先配置聊天模型。', ENGINE_REQUEST_FAILED: '模型请求失败，请检查服务地址、模型名和密钥。', MODEL_TIMEOUT: '模型响应超时。', CANCELLED: '已取消', MODEL_IN_USE: '模型正在被会话或路由使用。修改地址或模型名时，请新建模型配置。', PERSONA_VERSION_CONFLICT: '人格已更新，请重新加载后再保存。', RUNTIME_RESTARTED: '服务重启，此回复已中断。', INVALID_MODEL_URL: '云端地址须使用 HTTPS，本地服务可使用回环 HTTP。', INVALID_REQUEST: '请检查输入内容。' };
export function errorText(error: unknown) { const code = String(error); return errors[code] ?? `操作失败：${code}`; }
export const statusText: Record<string,string> = { queued:'等待回复', running:'正在回复', completed:'', cancelled:'已取消', failed:'回复失败', interrupted:'已中断' };
