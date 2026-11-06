import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { InputError } from '../ai/types.js';
import type { NoteScope } from './note-scope.js';

export interface DisclosedMemory { id: string; version: number }

function references(value: unknown): value is DisclosedMemory[] {
  return Array.isArray(value) && value.length <= 256 && value.every(ref =>
    ref && typeof ref.id === 'string' && Number.isSafeInteger(ref.version) && ref.version > 0);
}

// A public engine session may contain any item disclosed in previous turns, including tool results.
// Validate those exact versions when resuming and again before delivery; additions do not revoke a reply.
export class PublicMemorySession {
  private readonly policy: string;
  private readonly seen = new Set<string>();
  private readonly memories = new Map<string, number>();

  constructor(private db: DatabaseSync, private conversation: string, private notes: NoteScope,
    private canRecall: (item: DisclosedMemory) => boolean, recognizesOwner: boolean) {
    this.policy = createHash('sha256').update(JSON.stringify([notes.key,recognizesOwner])).digest('hex');
    const row = db.prepare('SELECT context_hash FROM agent_sessions WHERE conversation_id=?').get(conversation)!;
    let previous;
    try { previous = JSON.parse(String(row.context_hash)); } catch { /* older session format */ }
    if (previous?.policy === this.policy && Array.isArray(previous.notes) && previous.notes.length <= 100 &&
        previous.notes.every((v: unknown) => typeof v === 'string') && references(previous.memories)) {
      const ids = new Set<string>(previous.notes);
      if (notes.canReadAll(ids) && previous.memories.every(canRecall)) {
        for (const id of ids) this.seen.add(id);
        for (const {id, version} of previous.memories) this.memories.set(id, version);
        return;
      }
    }
    db.prepare('UPDATE agent_sessions SET engine_id=?,initialized=0,context_hash=? WHERE conversation_id=?')
      .run(randomUUID(),this.snapshot(),conversation);
  }

  private snapshot() {
    return JSON.stringify({policy:this.policy,notes:[...this.seen],memories:Array.from(this.memories, ([id,version]) => ({id,version}))});
  }
  private save() {
    this.db.prepare('UPDATE agent_sessions SET context_hash=? WHERE conversation_id=?').run(this.snapshot(),this.conversation);
  }
  observe(ids: string[]) {
    const before = this.seen.size;
    for (const id of ids) this.seen.add(id);
    if (this.seen.size !== before) this.save();
  }
  observeMemories(items: ReadonlyArray<DisclosedMemory>) {
    const before = this.memories.size;
    for (const {id,version} of items) {
      const previous = this.memories.get(id);
      if (previous !== undefined && previous !== version) throw new InputError('MEMORY_SCOPE_CHANGED',409);
      this.memories.set(id,version);
    }
    if (this.memories.size !== before) this.save();
  }
  assertCurrent() {
    if (!this.notes.canReadAll(this.seen)) throw new InputError('MEMORY_SCOPE_CHANGED',409);
    for (const [id,version] of this.memories) {
      if (!this.canRecall({id,version})) throw new InputError('MEMORY_SCOPE_CHANGED',409);
    }
  }
}
