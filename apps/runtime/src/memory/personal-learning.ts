import type { DatabaseSync } from 'node:sqlite';
import { normalizeMemoryText, type MemoryStore } from './store.js';
import { demographicStatements, selectStatement, type Statement } from './natural-learning.js';
import { trustedSpeakerTurn, type MemorySpeaker, type MemoryTurnSource } from './speaker.js';
import type { Memory, Source } from './types.js';

export type SourceTurn = MemoryTurnSource;
export interface PreparedChange {
  statement: Statement;
  target?: { id: string; version: number };
  context?: { id: string; quote: string };
}
type Turn = NonNullable<ReturnType<typeof trustedSpeakerTurn>>;

// One memory has one quote per source message. Resolve repeated assignments
// before inserting any of them so the surviving value keeps its own evidence.
function resolveTurnChanges(source: SourceTurn, changes: PreparedChange[]) {
  const slots = new Map<string,PreparedChange[]>();
  for (const change of changes) {
    const {kind,subject,quote} = change.statement;
    if (!quote.trim() || !source.text.includes(quote)) continue;
    const key = kind + ':' + normalizeMemoryText(subject);
    const group = slots.get(key) ?? [];
    group.push(change);
    slots.set(key,group);
  }
  return [...slots.values()].flatMap(group => {
    if (group.length === 1 || !group.some(c => c.statement.replaces)) return group;
    // Unlike a name or a preference, two appointments on one topic can be distinct.
    if (group[0]!.statement.kind === 'experience') return [];
    return [group.reduce((latest,c) => source.text.lastIndexOf(c.statement.quote) >
      source.text.lastIndexOf(latest.statement.quote) ? c : latest)];
  });
}

export class PersonalLearning {
  constructor(private db: DatabaseSync, private memories: MemoryStore) {}

  // Called inside the queue's transaction: the changes, source cursor and acknowledgement
  // either all survive a restart, or none do. Identity is re-read after model calls.
  commit(source: SourceTurn, expected: MemorySpeaker, changes: PreparedChange[]): boolean {
    const turn = trustedSpeakerTurn(this.db,source);
    if (!turn || turn.role !== expected.role || turn.personKey !== expected.personKey ||
        turn.scopeKey !== expected.scopeKey) return false;
    const advance = this.db.prepare(`INSERT INTO settings(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
      WHERE CAST(settings.value AS INTEGER)<CAST(excluded.value AS INTEGER)`)
      .run('memory.natural.seen.' + turn.conversation, String(turn.sequence));
    if (!advance.changes) return false;

    let changed = false;
    for (const change of resolveTurnChanges(source,changes)) {
      if (!this.apply(turn,source,change)) continue;
      changed = true;
      // A per-chat note containing the same claim must follow its correction/deletion.
      this.db.prepare(`DELETE FROM conversation_notes WHERE source_id=? AND author=?
        AND (instr(?,content)>0 OR instr(content,?)>0) AND instr(?,quote)>0`)
        .run(source.messageId,source.author,change.statement.quote,change.statement.quote,source.text);
    }
    return changed;
  }

  private apply(turn: Turn, source: SourceTurn, {statement, target, context}: PreparedChange) {
    const {kind, quote, content} = statement, subject = normalizeMemoryText(statement.subject);
    if (!subject || !quote.trim() || !source.text.includes(quote)) return false;
    const reviewed = this.memories.reviewedThrough(turn,kind,subject);
    if (turn.sequence <= reviewed) return false;
    const sources: Source[] = [{type:'message', id:source.messageId, quote}];
    if (context) {
      const prior = this.db.prepare(`SELECT rowid AS seq FROM messages WHERE id=? AND conversation_id=?
        AND role='user' AND status='completed' AND author=? AND instr(content,?)>0
        AND EXISTS (SELECT 1 FROM messages a WHERE a.conversation_id=messages.conversation_id
          AND a.request_id=messages.request_id AND a.role='assistant' AND a.status='completed')`)
        .get(context.id,turn.conversation,source.author,context.quote);
      if (!context.quote.trim() || !prior || Number(prior.seq) >= turn.sequence || Number(prior.seq) <= reviewed) return false;
      sources.push({type:'message', ...context});
    }
    const rows = this.db.prepare(`SELECT id,normalized,status FROM memories
      WHERE actor_role=? AND person_key=? AND scope_key=? AND kind=? AND subject=?`)
      .all(turn.role,turn.personKey,turn.scopeKey,kind,subject);
    const normalized = normalizeMemoryText(content);
    const exact = rows.find(row => row.normalized === normalized);
    if (exact && exact.status !== 'confirmed') return false;

    if (kind === 'experience' && statement.replaces) {
      const matches = this.memories.appointmentTargets(turn,subject);
      if (matches.length > 1 || matches[0]?.id !== target?.id || matches[0]?.version !== target?.version) return false;
    }
    let previous: Memory | undefined;
    if (target) {
      const audience = turn.scopeKey === 'owner' ? 'owner' : turn;
      if (!statement.replaces || !this.memories.canRecall(target.id,audience,target.version)) return false;
      previous = this.memories.get(target.id);
      if (previous.role !== turn.role || previous.personKey !== turn.personKey ||
          previous.kind !== kind || previous.subject !== subject) return false;
    }
    if (statement.replaces) {
      const conflicts = rows.filter(row => row.status === 'confirmed' && row.normalized !== normalized);
      // Two distinct appointments with the same subject cannot be resolved from that subject alone.
      if (!target && conflicts.length > 1) return false;
      if (!previous && conflicts.length) previous = this.memories.get(String(conflicts[0]!.id));
    }
    if (previous) {
      const latest = this.lastAutomaticSource(previous,turn);
      if (!latest) return false;
      if (previous.scopeKey !== turn.scopeKey) {
        // A private correction can reuse the owner's group evidence, never modify the group.
        if (turn.scopeKey !== 'owner' || turn.role !== 'owner' || !previous.scopeKey.includes(':group:')) return false;
        sources.push(latest);
        const publicEvidence = previous.sources;
        const local = rows.filter(row => row.status === 'confirmed')
          .map(row => this.memories.get(String(row.id)))
          .filter(m => m.sources.some(s => s.type === 'message' && publicEvidence.some(
            e => e.type === 'message' && e.id === s.id && e.quote === s.quote)));
        if (local.length > 1) return false;
        previous = local[0];
        if (previous && !this.lastAutomaticSource(previous,turn)) return false;
      }
      if (exact && previous?.id !== exact.id) return false;
      if (previous && previous.content !== content) {
        this.db.prepare(`UPDATE memories SET content=?,normalized=?,version=version+1,updated_at=? WHERE id=?`)
          .run(content,normalized,new Date().toISOString(),previous.id);
      }
    }
    // insert deduplicates within person and room; in-place corrections retain earlier evidence.
    this.memories.insert({kind, subject, content, sources, importance:kind === 'preference' ? 5 : 4}, 'confirmed',turn);
    return true;
  }

  private lastAutomaticSource(memory: Memory, turn: Turn): Source | undefined {
    if (memory.visibility !== 'private' || memory.sources.some(s => s.type !== 'message')) return;
    const last = this.db.prepare(`SELECT m.rowid AS seq,m.created_at AS at,l.source_id AS id,l.quote
      FROM memory_links l JOIN messages m ON m.id=l.source_id
      WHERE l.memory_id=? AND l.source_type='message' AND m.role='user' AND m.status='completed'
        AND instr(m.content,l.quote)>0 ORDER BY m.rowid DESC LIMIT 1`).get(memory.id);
    if (!last || Number(last.seq) > turn.sequence ||
        Number(last.seq) <= this.memories.reviewedThrough(memory,memory.kind,memory.subject)) return;
    const quote = String(last.quote);
    // Legacy automatic rows have no origin flag. Verify an evidence-based representation
    // rather than taking ownership of a manually worded or model-proposed memory.
    if (!demographicStatements(quote,turn).some(field => field.content === memory.content) &&
        selectStatement(quote,turn,String(last.at))?.content !== memory.content &&
        quote !== memory.content && memory.subject+'：'+quote !== memory.content) return;
    return {type:'message',id:String(last.id),quote};
  }
}
