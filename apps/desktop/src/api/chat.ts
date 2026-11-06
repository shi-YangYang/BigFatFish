import type { Conversation } from "../../../runtime/src/ai/types";
import { api } from "./client";

export type PendingMessage = { content: string; requestId: string; inputOrigin?: "transcription" };

export function loadConversations() {
  return api<Conversation[]>("/v1/conversations");
}

export async function loadLocalConversations() {
  try {
    return await api<Conversation[]>("/v1/conversations/local");
  } catch (error) {
    // An older Runtime returns Fastify's missing-route error through either transport.
    if ((error instanceof Error ? error.message : error) !== "Not Found") throw error;
    const sessions = await loadConversations();
    return sessions.filter(session => session.readOnly === false);
  }
}

export function createConversation() {
  return api<Conversation>("/v1/conversations", "POST", {});
}

export function sendMessage(conversationId: string, message: PendingMessage) {
  return api(`/v1/conversations/${conversationId}/messages`, "POST", message);
}

export function cancelMessage(id: string) {
  return api(`/v1/messages/${id}/cancel`, "POST");
}
