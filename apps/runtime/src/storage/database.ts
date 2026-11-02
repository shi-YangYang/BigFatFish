import { DatabaseSync } from 'node:sqlite';
export const SCHEMA_VERSION = 3;
export const migrations = [
  `CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE audit (id INTEGER PRIMARY KEY, event TEXT NOT NULL, at TEXT NOT NULL);
   CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`,
  `CREATE TABLE models (id TEXT PRIMARY KEY, config TEXT NOT NULL, secret TEXT);
   CREATE TABLE personas (version INTEGER PRIMARY KEY, config TEXT NOT NULL, created_at TEXT NOT NULL);
   CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, model_id TEXT NOT NULL REFERENCES models(id), created_at TEXT NOT NULL);
   CREATE TABLE agent_sessions (conversation_id TEXT PRIMARY KEY REFERENCES conversations(id), engine_id TEXT NOT NULL, initialized INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL, request_id TEXT NOT NULL, persona_version INTEGER NOT NULL REFERENCES personas(version), UNIQUE(conversation_id, request_id, role));
   CREATE INDEX messages_conversation ON messages(conversation_id, created_at);`,
  `CREATE TABLE memories (id TEXT PRIMARY KEY, kind TEXT NOT NULL, subject TEXT NOT NULL, content TEXT NOT NULL, normalized TEXT NOT NULL, importance INTEGER NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
   CREATE INDEX memories_status ON memories(status, importance DESC, updated_at DESC);
   CREATE INDEX memories_identity ON memories(kind,subject,normalized);
   CREATE TABLE memory_links (memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE, source_type TEXT NOT NULL, source_id TEXT NOT NULL, quote TEXT NOT NULL, PRIMARY KEY(memory_id,source_type,source_id));
   CREATE TABLE activity_records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, source_id TEXT NOT NULL, summary TEXT NOT NULL, occurred_at TEXT NOT NULL);
   CREATE INDEX activities_time ON activity_records(occurred_at);
   CREATE TABLE experiences (id TEXT PRIMARY KEY REFERENCES activity_records(id), title TEXT NOT NULL);
   CREATE TABLE mood_history (id TEXT PRIMARY KEY REFERENCES activity_records(id), mood TEXT NOT NULL, reason TEXT NOT NULL, occurred_at TEXT NOT NULL);
   CREATE TABLE interests (memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE);
   CREATE TABLE relationships (memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE);
   CREATE TABLE memory_tasks (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL, model_id TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL);
   CREATE TABLE daily_diaries (id TEXT PRIMARY KEY, day TEXT NOT NULL, timezone TEXT NOT NULL, content TEXT NOT NULL, sources TEXT NOT NULL, version INTEGER NOT NULL, model_id TEXT NOT NULL, updated_at TEXT NOT NULL, copy_status TEXT NOT NULL, UNIQUE(day,timezone));`,
];
export function migrate(db: DatabaseSync, steps = migrations) {
  const current = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (current > steps.length) throw new Error('DATABASE_VERSION_TOO_NEW');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let index = current; index < steps.length; index++) {
      db.exec(steps[index]!);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(index + 1, new Date().toISOString());
      db.exec(`PRAGMA user_version = ${index + 1}`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function openDatabase(file: string) {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
    migrate(db);
    return db;
  } catch (error) { db.close(); throw error; }
}
