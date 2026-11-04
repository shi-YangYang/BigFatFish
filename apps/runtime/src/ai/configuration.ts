import { modelURL, parseReasoning, normalizeModel } from './model-options.js';
import type { DatabaseSync } from 'node:sqlite';
import { InputError, object, string, type ModelConfig, type Persona } from './types.js';
import { SecretStore } from './secrets.js';
import type { DataPaths } from '../paths.js';
import { defaultPersona } from './persona-presets.js';
export { defaultPersona } from './persona-presets.js';
export class Configuration {
  private secrets: SecretStore;
  constructor(private db: DatabaseSync, p: DataPaths) {
    this.secrets = new SecretStore(p, !!db.prepare('SELECT id FROM models WHERE secret IS NOT NULL UNION ALL SELECT id FROM plugin_config WHERE secret IS NOT NULL LIMIT 1').get());
    if (!db.prepare('SELECT version FROM personas LIMIT 1').get()) db.prepare('INSERT INTO personas(version, config, created_at) VALUES(1, ?, ?)').run(JSON.stringify(defaultPersona), new Date().toISOString());
  }
  encryptSecret(value: string) { return this.secrets.encrypt(value); }
  decryptSecret(value: string) { return this.secrets.decrypt(value); }
  models() { return this.db.prepare('SELECT id, config, secret FROM models ORDER BY id').all().map(row => ({ ...normalizeModel(JSON.parse(row.config as string)), hasKey: !!row.secret })); }
  model(id: string) {
    const row = this.db.prepare('SELECT config, secret FROM models WHERE id=?').get(id);
    if (!row) throw new InputError('MODEL_NOT_CONFIGURED', 409);
    return { config: normalizeModel(JSON.parse(row.config as string)), key: row.secret ? this.secrets.decrypt(row.secret as string) : '' };
  }
  saveModel(input: unknown) {
    const b = object(input); const id = string(b.id, 64);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new InputError('INVALID_MODEL_ID');
    const provider = b.provider;
    if (provider !== 'deepseek' && provider !== 'openai') throw new InputError('INVALID_PROVIDER');
    const baseURL = modelURL(b.baseURL);
    const reasoningEffort = parseReasoning(provider, b.reasoningEffort);
    const config: ModelConfig = { id, label: b.label === undefined ? string(b.model, 200) : string(b.label, 200), provider, baseURL, model: string(b.model, 200), ...(reasoningEffort ? { reasoningEffort } : {}) };
    const old = this.db.prepare('SELECT config, secret FROM models WHERE id=?').get(id);
    if (old && this.modelIdentity(JSON.parse(old.config as string)) !== this.modelIdentity(config) && this.db.prepare('SELECT id FROM conversations WHERE model_id=? LIMIT 1').get(id)) throw new InputError('MODEL_IN_USE', 409);
    const secret = b.apiKey === undefined ? old?.secret ?? null : (string(b.apiKey, 8192, true) ? this.secrets.encrypt(b.apiKey as string) : null);
    this.db.prepare('INSERT INTO models(id, config, secret) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config, secret=excluded.secret').run(id, JSON.stringify(config), secret);
    return this.models().find(model => model.id === id)!;
  }
  private modelIdentity(config: ModelConfig) {
    return JSON.stringify([config.provider, modelURL(config.baseURL), config.model]);
  }
  deleteModel(id: string) {
    if (this.db.prepare('SELECT id FROM conversations WHERE model_id=? LIMIT 1').get(id)) throw new InputError('MODEL_IN_USE', 409);
    const routes = this.routes();
    if (Object.values(routes).includes(id)) throw new InputError('MODEL_IN_USE', 409);
    this.db.prepare('DELETE FROM models WHERE id=?').run(id); return { deleted: true };
  }
  routes(): Partial<Record<'chat'|'asr'|'tts', string>> {
    const row = this.db.prepare("SELECT value FROM settings WHERE key='model_routes'").get();
    return this.normalizeRoutes(row ? JSON.parse(row.value as string) : {});
  }
  private normalizeRoutes(routes: Record<string, unknown>) {
    const result: Partial<Record<'chat'|'asr'|'tts', string>> = {};
    // Old specialized routes remain readable but cannot override a configured chat model.
    const chat = routes.chat ?? routes.reasoning ?? routes.vision ?? routes.memory;
    for (const [purpose, id] of Object.entries({ chat, asr: routes.asr, tts: routes.tts }))
      if (id !== undefined && id !== '') result[purpose as 'chat'|'asr'|'tts'] = string(id, 64);
    return result;
  }
  saveRoutes(input: unknown) {
    const routes = object(input);
    if (Object.keys(routes).some(key => !['chat','asr','tts','reasoning','vision','memory'].includes(key))) throw new InputError('INVALID_MODEL_PURPOSE');
    const result = this.normalizeRoutes(routes);
    for (const id of Object.values(result)) this.model(id);
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
