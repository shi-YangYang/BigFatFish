import type { DatabaseSync } from 'node:sqlite';
import { MODEL_REQUEST_TIMEOUT_MS } from '../ai/model-options.js';
import { transaction } from '../storage/database.js';
import type { SourceTurn } from './personal-learning.js';

interface TurnAnalyzer {
  prepare(source: SourceTurn, signal: AbortSignal): Promise<() => boolean>;
}

const retryDelays = [1000, 4000];

// One worker per Runtime. The Runtime's instance lock is held for the lifetime
// of this connection. In-flight work stays pending until the write and ack commit.
export class MemoryTurnQueue {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly stop = new AbortController();

  constructor(private db: DatabaseSync, private analyzer: TurnAnalyzer, private changed: () => void) {
    this.schedule();
  }

  // The caller owns the transaction that finalizes the chat or QQ delivery.
  enqueue(sourceId: string) {
    this.db.prepare('INSERT INTO memory_turn_jobs(source_id) VALUES(?) ON CONFLICT(source_id) DO NOTHING').run(sourceId);
    this.schedule();
  }

  // markComplete is only the local SQLite update, never a network send.
  // Normally both records commit together. If just the job insert fails,
  // the already delivered/generated reply must still report its real outcome.
  completeTurn(sourceId: string | undefined, markComplete: () => void) {
    if (!sourceId) { markComplete(); return; }
    let insertFailed = false;
    try {
      transaction(this.db, () => {
        markComplete();
        try { this.enqueue(sourceId); } catch (error) { insertFailed = true; throw error; }
      });
    } catch (error) {
      if (!insertFailed) throw error;
      markComplete();
      try {
        this.db.prepare('INSERT INTO audit(event,at) VALUES(?,?)')
          .run('memory.enqueue.failed:' + sourceId,new Date().toISOString());
      } catch {
        process.emitWarning('MEMORY_ENQUEUE_AUDIT_UNAVAILABLE');
      }
    }
  }

  private schedule(delay = 0) {
    if (this.stop.signal.aborted || this.timer || this.running) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.db.isOpen) return;
      try {
        this.next();
      } catch {
        // Reading the queue can also fail while SQLite is busy. No job has been consumed.
        this.schedule(1000);
      }
    }, delay).unref();
  }

  private next() {
    const job = this.db.prepare(`SELECT source_id, attempts, next_at FROM memory_turn_jobs
      WHERE status='pending' ORDER BY seq LIMIT 1`).get();
    if (!job) return;
    const wait = Number(job.next_at) - Date.now();
    if (wait > 0) { this.schedule(wait); return; }
    const resume = (delay: number) => {
      this.running = undefined;
      this.schedule(delay);
    };
    this.running = this.consume(String(job.source_id), Number(job.attempts)).then(
      () => resume(0), () => resume(1000),
    );
  }

  private async consume(messageId: string, attempts: number) {
    const timeout = AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([this.stop.signal, timeout]);
    try {
      const row = this.db.prepare('SELECT author, content FROM messages WHERE id=?').get(messageId);
      if (!row) return; // Source deletion cascades to the job.
      const commit = await this.analyzer.prepare({ messageId, author: String(row.author), text: String(row.content) }, signal);
      signal.throwIfAborted();
      const changed = transaction(this.db, () => {
        const claimed = this.db.prepare(`UPDATE memory_turn_jobs SET status='done', next_at=0, error=NULL
          WHERE source_id=? AND status='pending'`).run(messageId);
        return !!claimed.changes && commit();
      });
      if (changed) this.changed();
    } catch (error) {
      if (this.stop.signal.aborted) return;
      const delay = retryDelays[attempts];
      const reason = timeout.aborted ? 'MODEL_TIMEOUT'
        : error instanceof Error && error.message === 'MODEL_NOT_CONFIGURED' ? 'MODEL_NOT_CONFIGURED'
        : 'MEMORY_ANALYSIS_FAILED';
      this.db.prepare(`UPDATE memory_turn_jobs SET status=?, attempts=attempts+1, next_at=?, error=?
        WHERE source_id=? AND status='pending'`).run(delay === undefined ? 'failed' : 'pending',
          delay === undefined ? 0 : Date.now() + delay, reason, messageId);
    }
  }

  async close() {
    this.stop.abort();
    clearTimeout(this.timer);
    await this.running;
  }
}
