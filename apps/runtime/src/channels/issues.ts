import type { DatabaseSync } from 'node:sqlite';
import { target } from './protocol.js';
import type { QQMessageIssue, Target } from './types.js';

function issueKind(status: string, error: string | null, partial: boolean): QQMessageIssue['kind'] | undefined {
  if (partial) return status === 'unknown' ? 'partial_unknown' : 'partial';
  if (status === 'unknown') return 'unknown';
  if (status === 'failed') return error === 'ACTION_REJECTED' ? 'send_failed' : 'reply_failed';
  if (status !== 'blocked') return;
  if (error === 'MODEL_RUN_FAILED') return 'reply_failed';
  if (error === 'CHANNEL_OFFLINE') return 'offline';
  if (error === 'QUEUE_FULL') return 'queue_full';
}

function issueTarget(value: string): Target | undefined {
  try { return target(JSON.parse(value)); } catch { return undefined; }
}

export function recentMessageIssues(db: DatabaseSync): QQMessageIssue[] {
  // Replies send outputs in order and stop at the first unconfirmed one. Output 0
  // therefore proves partial delivery even if a restart interrupted the parent update.
  const rows = db.prepare(`
    SELECT operation.rowid AS operationId,
           CASE WHEN operation.error = 'REPLY_PARTIALLY_SENT' THEN 1
                WHEN delivery.status = 'unknown' AND delivery.id <> operation.id THEN EXISTS (
                  SELECT 1 FROM channel_deliveries AS firstOutput
                   WHERE firstOutput.id = operation.id || ':output:0' AND firstOutput.status = 'sent'
                ) ELSE 0 END AS partial,
           delivery.status,
           delivery.error, delivery.target, delivery.created_at AS at
      FROM channel_deliveries AS delivery
      JOIN channel_deliveries AS operation ON operation.id = CASE
        WHEN instr(delivery.id, ':output:') > 0 THEN substr(delivery.id, 1, instr(delivery.id, ':output:') - 1)
        ELSE delivery.id END
     WHERE delivery.status IN ('failed', 'blocked', 'unknown') OR delivery.error = 'REPLY_PARTIALLY_SENT'
     ORDER BY delivery.created_at DESC, delivery.rowid DESC
  `).iterate();
  const issues: QQMessageIssue[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const id = Number(row.operationId);
    if (seen.has(id)) continue;
    const kind = issueKind(row.status as string, row.error as string | null, row.partial === 1);
    if (!kind) continue;
    seen.add(id);
    issues.push({ id, kind, target: issueTarget(row.target as string), at: row.at as string });
    if (issues.length === 20) break;
  }
  return issues;
}
