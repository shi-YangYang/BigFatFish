import type { DatabaseSync } from 'node:sqlite';
import { InputError, object, string, type ModelConfig, type Persona } from './types.js';
import { SecretStore } from './secrets.js';
import type { DataPaths } from '../paths.js';
export const defaultPersona: Persona = { name: '大肥鱼', avatar: '', role: '陪伴主人、了解世界的 AI 鱼', traits: '好奇、友善', style: '自然简洁', likes: '', dislikes: '', boundaries: '尊重隐私，涉及外部操作先取得授权', schedule: '', autonomy: '未经授权不主动进行外部操作', version: 1 };
export class Configuration {
  private secrets: SecretStore;
  constructor(private db: DatabaseSync, p: DataPaths) {
    this.secrets = new SecretStore(p, !!db.prepare('SELECT id FROM models WHERE secret IS NOT NULL LIMIT 1').get());
    if (!db.prepare('SELECT version FROM personas LIMIT 1').get()) db.prepare('INSERT INTO personas(version, config, created_at) VALUES(1, ?, ?)').run(JSON.stringify(defaultPersona), new Date().toISOString());
  }
  models() { return this.db.prepare('SELECT id, config, secret FROM models ORDER BY id').all().map(row => ({ ...JSON.parse(row.config as string) as ModelConfig, hasKey: !!row.secret })); }
  model(id: string) {
    const row = this.db.prepare('SELECT config, secret FROM models WHERE id=?').get(id);
    if (!row) throw new InputError('MODEL_NOT_CONFIGURED', 409);
    return { config: JSON.parse(row.config as string) as ModelConfig, key: row.secret ? this.secrets.decrypt(row.secret as string) : '' };
  }
  saveModel(input: unknown) {
    const b = object(input); const id = string(b.id, 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new InputError('INVALID_MODEL_ID');
    const provider = b.provider;
    if (provider !== 'deepseek' && provider !== 'openai') throw new InputError('INVALID_PROVIDER');
    let url: URL; try { url = new URL(string(b.baseURL, 1000)); } catch { throw new InputError('INVALID_MODEL_URL'); }
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new InputError('INVALID_MODEL_URL');
    const number = (value: unknown, min: number, max: number) => { if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new InputError('INVALID_MODEL_LIMIT'); return Number(value); };
    const config: ModelConfig = { id, label: string(b.label, 100), provider, baseURL: url.href.replace(/\/$/, ''), model: string(b.model, 200), contextWindow: number(b.contextWindow, 2048, 2000000), maxTokens: number(b.maxTokens, 1, 128000), timeoutMs: number(b.timeoutMs, 1000, 600000), vision: b.vision === true };
    if (config.maxTokens >= config.contextWindow) throw new InputError('INVALID_MODEL_LIMIT');
    const old = this.db.prepare('SELECT config, secret FROM models WHERE id=?').get(id);
    if (old && old.config !== JSON.stringify(config) && this.db.prepare('SELECT id FROM conversations WHERE model_id=? LIMIT 1').get(id)) throw new InputError('MODEL_IN_USE', 409);
    const secret = b.apiKey === undefined ? old?.secret ?? null : (string(b.apiKey, 8192, true) ? this.secrets.encrypt(b.apiKey as string) : null);
    this.db.prepare('INSERT INTO models(id, config, secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config, secret=excluded.secret').run(id, JSON.stringify(config), secret);
    return this.models().find(model => model.id === id)!;
  }
  deleteModel(id: string) {
    if (this.db.prepare('SELECT id FROM conversations WHERE model_id=? LIMIT 1').get(id)) throw new InputError('MODEL_IN_USE', 409);
    const routes = this.routes();
    if (Object.values(routes).includes(id)) throw new InputError('MODEL_IN_USE', 409);
    this.db.prepare('DELETE FROM models WHERE id=?').run(id); return { deleted: true };
  }
  routes(): Record<string, string> { const row = this.db.prepare("SELECT value FROM settings WHERE key='model_routes'").get(); return row ? JSON.parse(row.value as string) : {}; }
  saveRoutes(input: unknown) {
    const routes = object(input); const result: Record<string,string> = {};
    for (const [purpose, id] of Object.entries(routes)) { if (!['chat','reasoning','vision','memory','asr','tts'].includes(purpose)) throw new InputError('INVALID_MODEL_PURPOSE'); result[purpose] = string(id, 64); this.model(result[purpose]); }
    this.db.prepare("INSERT INTO settings(key,value) VALUES('model_routes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(result)); return result;
  }
  persona(): Persona { return JSON.parse(this.db.prepare('SELECT config FROM personas ORDER BY version DESC LIMIT 1').get()!.config as string); }
  history() { return this.db.prepare('SELECT config FROM personas ORDER BY version DESC LIMIT 100').all().map(row => JSON.parse(row.config as string) as Persona); }
  savePersona(input: unknown) {
    const value = object(input), old = this.persona();
    if (value.version !== old.version) throw new InputError('PERSONA_VERSION_CONFLICT', 409);
    const next = { ...old, version: old.version + 1 };
    for (const key of ['name','avatar','role','traits','style','likes','dislikes','boundaries','schedule','autonomy'] as const) next[key] = string(value[key], key === 'name' ? 100 : 4000, key !== 'name');
    if (next.avatar && !/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(next.avatar)) throw new InputError('INVALID_AVATAR');
    this.db.prepare('INSERT INTO personas(version, config, created_at) VALUES(?,?,?)').run(next.version, JSON.stringify(next), new Date().toISOString()); return next;
  }
}
