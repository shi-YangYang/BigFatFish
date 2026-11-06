import { Channel, invoke } from '@tauri-apps/api/core';
import { isWeb } from "./client";
import type { ChatMessage } from '../../../runtime/src/ai/types';
export type ToolActivity = { name: string; state: string; at: string };
export type ChatStreamEvent = { type: 'snapshot-start'|'snapshot-message'|'snapshot-end'|'ready'|'message'|'tool'|'disconnected'|'heartbeat'; conversationId?: string; messages?: ChatMessage[]; tools?: ToolActivity[]; message?: ChatMessage } & Partial<ToolActivity>;
export function subscribeChat(conversationId: string, receive: (event: ChatStreamEvent) => void, disconnected: () => void) {
  let closed = false;
  if (isWeb) {
    const url = new URL('/events', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('conversationId', conversationId);
    const socket = new WebSocket(url);
    socket.onmessage = message => { if (!closed) { try { receive(JSON.parse(message.data)); } catch { socket.close(); } } };
    socket.onclose = () => { if (!closed) disconnected(); };
    socket.onerror = () => socket.close();
    return () => { closed = true; socket.close(); };
  }
  const subscriptionId = crypto.randomUUID(), channel = new Channel<ChatStreamEvent>();
  channel.onmessage = event => { if (!closed) { if (event.type === 'disconnected') disconnected(); else receive(event); } };
  void invoke('runtime_stream_start', { subscriptionId, conversationId, channel }).then(() => {
    if (closed) void invoke('runtime_stream_stop', { subscriptionId }).catch(() => {});
  }).catch(() => { if (!closed) disconnected(); });
  return () => { closed = true; void invoke('runtime_stream_stop', { subscriptionId }).catch(() => {}); };
}
