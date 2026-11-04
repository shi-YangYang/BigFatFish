import type { ChatMessage } from '../../runtime/src/ai/types';
export function mergeChatMessage(messages: ChatMessage[], incoming: ChatMessage) {
  const index = messages.findIndex(message => message.id === incoming.id);
  if (index < 0) return [...messages, incoming];
  const old = messages[index]!;
  if (!['queued','running'].includes(old.status) && ['queued','running'].includes(incoming.status)) return messages;
  return messages.map(message => message.id === incoming.id ? incoming : message);
}
