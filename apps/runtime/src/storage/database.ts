import { DatabaseSync } from 'node:sqlite';
export const SCHEMA_VERSION = 2;
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
