import { LifeService } from '../memory/life.js';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { DatabaseSync } from 'node:sqlite';
import { Configuration } from './configuration.js';
import { DSHAdapter } from './dsh.js';
import { InputError, object, string, type ChatMessage, type Conversation } from './types.js';
import type { AgentEngine } from './engine.js';
import type { DataPaths } from '../paths.js';
export class ChatService {
  readonly config: Configuration;
  readonly life: LifeService;
  readonly events = new EventEmitter();
  private engine: AgentEngine;
  private queues = new Map<string, Promise<void>>();
  private controllers = new Map<string, AbortController>();
  private closing = false;
  constructor(private db: DatabaseSync, p: DataPaths) {
    this.config = new Configuration(db, p); this.engine = new DSHAdapter(p);
    this.life = new LifeService(db, p, this.config, this.engine, this.events);
    db.prepare("UPDATE messages SET status='interrupted', error='RUNTIME_RESTARTED' WHERE role='assistant' AND status IN ('queued','running')").run();
  }
  conversations() { return this.db.prepare('SELECT id, title, model_id AS modelId, created_at AS createdAt FROM conversations ORDER BY created_at DESC LIMIT 500').all() as unknown as Conversation[]; }
  conversation(id: string) { const row = this.db.prepare('SELECT id, title, model_id AS modelId, created_at AS createdAt FROM conversations WHERE id=?').get(id); if (!row) throw new InputError('CONVERSATION_NOT_FOUND', 404); return row as unknown as Conversation; }
  create(input: unknown) {
    const body = object(input), selected = body.modelId ?? this.config.routes().chat;
    if (!selected) throw new InputError('MODEL_NOT_CONFIGURED', 409);
    const modelId = string(selected, 64); this.config.model(modelId);
    const id = randomUUID(), at = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('INSERT INTO conversations(id,title,model_id,created_at) VALUES(?,?,?,?)').run(id, string(body.title ?? '新对话', 100), modelId, at); this.db.prepare('INSERT INTO agent_sessions(conversation_id,engine_id) VALUES(?,?)').run(id, randomUUID()); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.conversation(id);
  }
  messages(id: string) { this.conversation(id); return this.db.prepare('SELECT id, conversation_id AS conversationId, role, content, status, error, created_at AS createdAt, request_id AS requestId, persona_version AS personaVersion FROM messages WHERE conversation_id=? ORDER BY rowid LIMIT 10000').all(id) as unknown as ChatMessage[]; }
  message(id: string) { const row = this.db.prepare('SELECT id, conversation_id AS conversationId, role, content, status, error, created_at AS createdAt, request_id AS requestId, persona_version AS personaVersion FROM messages WHERE id=?').get(id); if (!row) throw new InputError('MESSAGE_NOT_FOUND', 404); return row as unknown as ChatMessage; }
  private publish(id: string) { const message = this.message(id); this.events.emit('message', { type: 'message', conversationId: message.conversationId, message }); return message; }
  send(id: string, input: unknown) {
    if (this.closing) throw new InputError('RUNTIME_STOPPING', 503);
    const conversation = this.conversation(id), body = object(input), requestId = string(body.requestId, 100), content = string(body.content, 32000);
    const duplicate = this.db.prepare("SELECT id, content FROM messages WHERE conversation_id=? AND request_id=? AND role='user'").get(id, requestId);
    if (duplicate) { if (duplicate.content !== content) throw new InputError('IDEMPOTENCY_CONFLICT', 409); return this.message(this.db.prepare("SELECT id FROM messages WHERE conversation_id=? AND request_id=? AND role='assistant'").get(id, requestId)!.id as string); }
    if (this.controllers.size >= 32) throw new InputError('QUEUE_FULL', 429);
    this.config.model(conversation.modelId);
    const messageId = randomUUID(), at = new Date().toISOString(), version = this.config.persona().version;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const insert = this.db.prepare('INSERT INTO messages(id,conversation_id,role,content,status,created_at,request_id,persona_version) VALUES(?,?,?,?,?,?,?,?)');
      insert.run(randomUUID(), id, 'user', content, 'completed', at, requestId, version); insert.run(messageId, id, 'assistant', '', 'queued', at, requestId, version); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    const control = new AbortController(); this.controllers.set(messageId, control);
    const next = (this.queues.get(id) ?? Promise.resolve()).then(() => this.run(conversation, messageId, content, control));
    this.queues.set(id, next);
    void next.finally(() => { this.controllers.delete(messageId); if (this.queues.get(id) === next) this.queues.delete(id); });
    return this.publish(messageId);
  }
  private async run(conversation: Conversation, id: string, prompt: string, control: AbortController) {
    let timeout: ReturnType<typeof setTimeout> | undefined, timedOut = false;
    try {
      if (control.signal.aborted) throw new Error('CANCELLED');
      const { config: model, key } = this.config.model(conversation.modelId), persona = this.config.persona();
      this.db.prepare("UPDATE messages SET status='running', persona_version=? WHERE id=?").run(persona.version, id); this.publish(id);
      timeout = setTimeout(() => { timedOut = true; control.abort(); }, model.timeoutMs);
      const session = this.db.prepare('SELECT engine_id, initialized FROM agent_sessions WHERE conversation_id=?').get(conversation.id)!;
      const content = await this.engine.run({ conversationId: conversation.id, sessionId: session.engine_id as string, resume: !!session.initialized, prompt, context: this.life.memories.context(prompt), persona, model, key, signal: control.signal,
        onSessionReady: () => { this.db.prepare('UPDATE agent_sessions SET initialized=1 WHERE conversation_id=?').run(conversation.id); },
        onText: text => { if (!control.signal.aborted) { this.db.prepare('UPDATE messages SET content=? WHERE id=?').run(text, id); this.publish(id); } },
      });
      this.db.prepare("UPDATE messages SET content=?, status='completed' WHERE id=?").run(content, id);
      this.life.memories.record({ id: `chat:${id}`, kind: 'chat.completed', sourceId: id, summary: `完成对话：${conversation.title}`, occurredAt: new Date().toISOString() });
    } catch (error) {
      const code = timedOut ? 'MODEL_TIMEOUT' : control.signal.aborted ? 'CANCELLED' : error instanceof InputError ? error.message : error instanceof Error && ['EMPTY_MODEL_RESPONSE','MODEL_RUN_FAILED'].includes(error.message) ? error.message : 'ENGINE_REQUEST_FAILED';
      this.db.prepare('UPDATE messages SET status=?, error=? WHERE id=?').run(code === 'CANCELLED' ? 'cancelled' : 'failed', code, id);
    } finally { if (timeout) clearTimeout(timeout); this.publish(id); }
  }
  cancel(id: string) { const msg = this.message(id); this.controllers.get(id)?.abort(); return { ...msg, cancelRequested: this.controllers.has(id) }; }
  async close() { this.closing = true; for (const controller of this.controllers.values()) controller.abort(); await Promise.all([...this.queues.values(), this.life.close()]); await this.engine.close(); }
}
