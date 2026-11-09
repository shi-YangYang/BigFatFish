import type { ChatMessage } from '../../../../runtime/src/ai/types';
export function mergeChatMessage(messages: ChatMessage[], incoming: ChatMessage) {
  const index = messages.findIndex(message => message.id === incoming.id);
  if (index < 0) return [...messages, incoming];
  const old = messages[index]!;
  if (!['queued','running'].includes(old.status) && ['queued','running'].includes(incoming.status)) return messages;
  return messages.map(message => message.id === incoming.id ? incoming : message);
}

export const statusText: Record<string,string> = { queued:'等待回复', running:'正在回复', completed:'', cancelled:'已取消', failed:'回复失败', interrupted:'已中断' };
