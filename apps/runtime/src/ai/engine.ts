import type { ModelConfig, Persona } from './types.js';
export interface EngineImage { type:'image'; data:string; mimeType:'image/png'|'image/jpeg'|'image/webp'|'image/gif' }
export interface EngineInput { sessionId: string; resume: boolean; conversationId: string; prompt: string; images?: EngineImage[]; context?: string; persona: Persona; model: ModelConfig; key: string; signal: AbortSignal; onText: (text: string) => void; onSessionReady: () => void }
export interface AgentEngine { run(input: EngineInput): Promise<string>; close(): Promise<void> }
