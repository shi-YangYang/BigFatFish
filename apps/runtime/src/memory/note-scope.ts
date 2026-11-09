import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { InputError } from '../ai/types.js';

type Note = { id: string; sourceId: string; author: string; content: string; quote: string; createdAt: string };
const fields = 'id,source_id AS sourceId,author,content,quote,created_at AS createdAt';

// Schema 8 already recorded the trusted message principal on each note. Private
// QQ rooms retain the same key after a rebind, so the principal is part of their
// boundary too. This also works with a memories-only restore (no messages table rows).
export class NoteScope {
  private readonly author: string | undefined;
  private readonly where: string;
  private readonly params: string[];

  constructor(private db: DatabaseSync, readonly key: string, owner: boolean) {
    const peer = /^qq:\d+:private:(\d+)$/.exec(key)?.[1];
    this.author = peer ? `qq-${owner ? 'owner' : 'user'}:${peer}` : undefined;
    this.where = this.author ? 'scope=? AND author=?' : 'scope=?';
    this.params = this.author ? [key, this.author] : [key];
  }
  recent() {
    return this.db.prepare(`SELECT ${fields} FROM conversation_notes WHERE ${this.where} ORDER BY rowid DESC LIMIT 100`).all(...this.params) as Note[];
  }
  matching(query: string) {
    return this.db.prepare(`SELECT ${fields} FROM conversation_notes WHERE ${this.where} AND instr(content,?)>0 ORDER BY rowid DESC LIMIT 12`).all(...this.params, query) as Note[];
  }
  canReadAll(ids: Set<string>) {
    if (!ids.size) return true;
    const rows = this.db.prepare(`SELECT id FROM conversation_notes WHERE ${this.where}`).iterate(...this.params);
    const visible = new Set(Array.from(rows, row => String(row.id)));
    return [...ids].every(id => visible.has(id));
  }
  append(source: {id:string;author:string}, content: string, quote: string) {
    if (this.author && source.author !== this.author) throw new InputError('INVALID_MEMORY_SOURCE');
    const existing = this.db.prepare('SELECT id FROM conversation_notes WHERE scope=? AND author=? AND content=?').get(this.key, source.author, content);
    if (existing) return {id:String(existing.id)};
    const count = this.db.prepare(`SELECT count(*) AS n FROM conversation_notes WHERE ${this.where}`).get(...this.params)!.n;
    const total = this.db.prepare('SELECT count(*) AS n FROM conversation_notes').get()!.n;
    if (Number(count) >= 100 || Number(total) >= 10000) throw new InputError('MEMORY_NOTES_FULL');
    const id = randomUUID();
    this.db.prepare('INSERT INTO conversation_notes(id,scope,source_id,author,content,quote,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(id,this.key,source.id,source.author,content,quote,new Date().toISOString());
    return {id,saved:true};
  }
  remove(id: string) {
    const r = this.db.prepare(`DELETE FROM conversation_notes WHERE ${this.where} AND id=?`).run(...this.params, id);
    if (!r.changes) throw new InputError('MEMORY_NOTE_NOT_FOUND');
    return {deleted:true};
  }
}
