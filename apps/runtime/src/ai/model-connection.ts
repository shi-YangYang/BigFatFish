import type { Configuration } from './configuration.js';
import { modelURL, parseReasoning, reasoningBody, maxTokensField } from './model-options.js';
import { InputError, object, string, type ModelConfig } from './types.js';

const RESPONSE_LIMIT = 1_048_576;
const MAX_MODELS = 2000;
export const MODEL_CONNECTION_TIMEOUT_MS = 30_000;
export interface DiscoveredModel { id: string; name: string }
export interface ModelDiscovery { models: DiscoveredModel[]; elapsedMs: number }
export interface ModelTestResult { ok: true; elapsedMs: number }
function connection(config: Configuration, input: unknown) {
  const b = object(input), provider = b.provider;
  if (provider !== 'openai' && provider !== 'deepseek') throw new InputError('INVALID_PROVIDER');
  const baseURL = modelURL(b.baseURL);
  let key = '';
  if (b.apiKey !== undefined) key = string(b.apiKey, 8192, true);
  else if (b.id) {
    const stored = config.model(string(b.id, 64));
    if (stored.key && (stored.config.provider !== provider || modelURL(stored.config.baseURL) !== baseURL)) throw new InputError('MODEL_KEY_REENTRY_REQUIRED');
    key = stored.key;
  }
  if (/[\r\n]/.test(key)) throw new InputError('INVALID_MODEL_KEY');
  const timeoutMs = b.timeoutMs === undefined ? MODEL_CONNECTION_TIMEOUT_MS : b.timeoutMs;
  if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 1000 || Number(timeoutMs) > 600000) throw new InputError('INVALID_MODEL_LIMIT');
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(provider === 'deepseek' ? { 'anthropic-version': '2023-06-01' } : {}) };
  if (key) headers[provider === 'deepseek' ? 'x-api-key' : 'authorization'] = provider === 'deepseek' ? key : `Bearer ${key}`;
  return { b, provider: provider as ModelConfig['provider'], baseURL, headers, timeoutMs: Math.min(Number(timeoutMs), MODEL_CONNECTION_TIMEOUT_MS) };
}
function httpError(status: number): string {
  if (status === 401) return 'MODEL_AUTH_FAILED';
  if (status === 403) return 'MODEL_ACCESS_DENIED';
  if (status === 404 || status === 405) return 'MODEL_ENDPOINT_NOT_FOUND';
  if (status === 429) return 'MODEL_RATE_LIMIT';
  if (status >= 300 && status < 400) return 'MODEL_REDIRECT_DENIED';
  if (status >= 500) return 'MODEL_SERVICE_UNAVAILABLE';
  return 'MODEL_REQUEST_REJECTED';
}
async function request(url: string, headers: Record<string, string>, timeoutMs: number, body?: Record<string, unknown>) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response | undefined;
  try {
    response = await fetch(url, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual', signal });
    if (!response.ok) throw new InputError(httpError(response.status), 409);
    if (Number(response.headers.get('content-length')) > RESPONSE_LIMIT) throw new InputError('MODEL_RESPONSE_TOO_LARGE', 409);
    const reader = response.body?.getReader();
    if (!reader) throw new InputError('MODEL_INVALID_RESPONSE', 409);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength; if (size > RESPONSE_LIMIT) throw new InputError('MODEL_RESPONSE_TOO_LARGE', 409);
        chunks.push(chunk.value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { throw new InputError('MODEL_INVALID_RESPONSE', 409); }
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(signal.aborted ? 'MODEL_CONNECTION_TIMEOUT' : 'MODEL_NETWORK_ERROR', 409);
  } finally { if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
}
export async function discoverModels(config: Configuration, input: unknown): Promise<ModelDiscovery> {
  const c = connection(config, input), start = performance.now();
  const url = c.provider === 'deepseek' ? new URL('/models', c.baseURL).href : `${c.baseURL}/models`;
  const result = await request(url, c.headers, Math.min(c.timeoutMs, 15000));
  if (!Array.isArray(result.data) || result.data.length > MAX_MODELS) throw new InputError('MODEL_INVALID_LIST', 409);
  const models = new Map<string, DiscoveredModel>();
  for (const value of result.data) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 200 || [...value.id].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new InputError('MODEL_INVALID_LIST', 409);
    models.set(value.id, { id: value.id, name: typeof value.name === 'string' && value.name.trim() && value.name.length <= 200 ? value.name : value.id });
  }
  return { models: [...models.values()], elapsedMs: Math.round(performance.now() - start) };
}
export async function testModelConnection(config: Configuration, input: unknown): Promise<ModelTestResult> {
  const c = connection(config, input), model = string(c.b.model, 200), effort = parseReasoning(c.provider, c.b.reasoningEffort);
  const requested = c.b.maxTokens ?? 256;
  if (!Number.isInteger(requested) || Number(requested) < 1 || Number(requested) > 128000) throw new InputError('INVALID_MODEL_LIMIT');
  const cap = Math.min(Number(requested), 256), start = performance.now();
  const root = c.provider === 'deepseek' && !new URL(c.baseURL).pathname.endsWith('/v1') ? `${c.baseURL}/v1` : c.baseURL;
  const result = await request(`${root}/${c.provider === 'deepseek' ? 'messages' : 'chat/completions'}`, c.headers, c.timeoutMs, {
    model, messages: [{ role: 'user', content: 'Reply with OK only.' }], stream: false,
    [c.provider === 'deepseek' ? 'max_tokens' : maxTokensField(c.baseURL)]: cap,
    ...reasoningBody(c.provider as ModelConfig['provider'], effort),
  });
  const content = c.provider === 'deepseek' ? result.content : Array.isArray(result.choices) ? result.choices[0]?.message?.content : undefined;
  const valid = c.provider === 'deepseek' ? Array.isArray(content) && content.some(part => part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) : typeof content === 'string' && !!content.trim();
  if (!valid) throw new InputError('MODEL_EMPTY_TEST_RESPONSE', 409);
  return { ok: true, elapsedMs: Math.round(performance.now() - start) };
}
