import type { ModelConfig, Persona } from './types.js';
import type { PersonaInteraction } from './persona-prompt.js';
export interface EngineImage { type:'image'; data:string; mimeType:'image/png'|'image/jpeg'|'image/webp'|'image/gif' }
export interface EngineTool {resultKind?:'image';onImageResult?:(value:unknown,presented:boolean)=>void;name:string;description:string;parameters:Record<string,unknown>;execute:(args:unknown,signal:AbortSignal)=>Promise<unknown>}
export interface EngineInput { interaction?: PersonaInteraction; tools?:EngineTool[]; onTool?:(event:{name:string;state:string})=>void; sessionId: string; resume: boolean; conversationId: string; prompt: string; images?: EngineImage[]; context?: string; persona: Persona; model: ModelConfig; key: string; signal: AbortSignal; onText: (text: string) => void; onSessionReady: () => void }
export interface AgentEngine { run(input: EngineInput): Promise<string>; close(): Promise<void> }
