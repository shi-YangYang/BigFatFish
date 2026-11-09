export interface FixtureMessage {
  role: string;
  content?: unknown;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
}
export interface FixtureFunctionTool {
  type: 'function';
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}
export interface FixtureNamedTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}
export type FixtureTool = FixtureFunctionTool | FixtureNamedTool;
export interface FixtureRequest {
  url: string;
  raw?: string;
  authorization?: string;
  // Multipart transcription requests have raw only; /models has no messages.
  body?: { messages?: FixtureMessage[]; tools?: FixtureTool[]; [key: string]: unknown };
}
export function fixtureModel(): Promise<{
  url: string;
  controls: {
    emotionResponse: string;
    turnMemoryResponse: string;
    memoryResponse: string | undefined;
    slowMemory: boolean;
    tool: boolean;
    sticker: string | undefined;
    replyTools: { name: string; args: Record<string, unknown> }[] | undefined;
  };
  requests: FixtureRequest[];
  close(): Promise<void>;
}>;
