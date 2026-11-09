import { InputError, string, type ModelConfig, type ReasoningEffort } from './types.js';

export const reasoningEfforts: Record<ModelConfig['provider'], readonly ReasoningEffort[]> = {
  openai: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  deepseek: ['none', 'low', 'high', 'max'],
};
export function parseReasoning(provider: ModelConfig['provider'], value: unknown): ReasoningEffort | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !reasoningEfforts[provider].includes(value as ReasoningEffort)) throw new InputError('INVALID_REASONING_EFFORT');
  return value as ReasoningEffort;
}
export function modelURL(value: unknown): string {
  let url: URL; try { url = new URL(string(value, 1000)); } catch { throw new InputError('INVALID_MODEL_URL'); }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new InputError('INVALID_MODEL_URL');
  return url.href.replace(/\/+$/, '');
}
// Match pi-ai 1.5.0's bff-route URL fallback; set this explicitly in both paths.
export function maxTokensField(baseURL: string): 'max_tokens' | 'max_completion_tokens' {
  return ['chutes.ai', 'deepseek.com', 'api.moonshot.', 'gateway.ai.cloudflare.com', 'api.together.ai', 'api.together.xyz', 'integrate.api.nvidia.com', 'api.ant-ling.com', 'api.z.ai', 'open.bigmodel.cn'].some(host => baseURL.includes(host)) ? 'max_tokens' : 'max_completion_tokens';
}
export function openAIModelOptions(model: ModelConfig) {
  return {
    compat: { maxTokensField: maxTokensField(model.baseURL), ...(model.reasoningEffort ? { supportsReasoningEffort: true, thinkingFormat: 'openai' } : {}) },
    ...(model.reasoningEffort ? { reasoningEfforts: { off: 'none', minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' } } : {}),
  };
}
export function adapterEffort(effort: ReasoningEffort | undefined) { return effort === 'none' ? 'off' : effort; }
export function reasoningBody(provider: ModelConfig['provider'], effort: ReasoningEffort | undefined) {
  if (provider === 'openai') return effort ? { reasoning_effort: effort } : {};
  return effort === 'none' ? { thinking: { type: 'disabled' } } : { thinking: { type: 'enabled' }, output_config: { effort: effort ?? 'high' } };
}

// Local resource safeguards, independent of provider generation defaults.
export const MODEL_REQUEST_TIMEOUT_MS = 180000;
export const RESTORED_HISTORY_CHAR_BUDGET = 48000;
export function normalizeModel(config: ModelConfig): ModelConfig {
  return { id: config.id, label: config.label || config.model, provider: config.provider, baseURL: config.baseURL, model: config.model, ...(config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}) };
}
