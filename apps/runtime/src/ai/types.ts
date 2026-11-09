export type ModelPurpose = 'chat' | 'asr' | 'tts';
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export interface ModelConfig {
  id: string; label: string; provider: 'deepseek' | 'openai'; baseURL: string; model: string;
  /** Legacy input fields; ignored on save and never forwarded as generation settings. */
  contextWindow?: number; maxTokens?: number; timeoutMs?: number; vision?: boolean; reasoningEffort?: ReasoningEffort;
}
export interface Persona {
  cardPrompt?: string; cardId?: string; name: string; avatar: string; role: string; traits: string; style: string; likes: string;
  dislikes: string; boundaries: string; schedule: string; autonomy: string; version: number;
}
export interface ChatMessage { id: string; conversationId: string; role: 'user' | 'assistant'; content: string; status: string; error: string | null; createdAt: string; requestId: string; personaVersion: number }
export interface Conversation { id: string; title: string; modelId: string; createdAt: string; readOnly?: boolean }
export interface ChatEvent { type: 'message'; conversationId: string; message: ChatMessage }
export class InputError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('INVALID_REQUEST');
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 4000, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) throw new InputError('INVALID_REQUEST');
  return value;
}
