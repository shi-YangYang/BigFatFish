export function fixtureModel(): Promise<{ url: string; requests: { url: string; authorization: string; body: { messages: unknown[]; tools?: unknown[] } }[]; close(): Promise<void> }>;
