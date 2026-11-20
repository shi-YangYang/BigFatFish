import { DatabaseSync } from 'node:sqlite';
// A kernel-backed SQLite write lock is released on process death. Never infer ownership
// from a PID or delete a stale lock file: both approaches race with another starter.
export function acquireInstance(file: string): () => void {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;');
  } catch (error) {
    db.close();
    const code = (error as { errcode?: number }).errcode;
    if (code === 5 || code === 6) throw new Error('ALREADY_RUNNING', { cause: error });
    throw error;
  }
  return () => { db.exec('ROLLBACK'); db.close(); };
}
