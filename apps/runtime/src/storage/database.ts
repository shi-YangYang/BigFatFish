import { DatabaseSync } from 'node:sqlite';
import { classifyLegacyMemories } from '../memory/attribution.js';
import { rebuildPersonProfiles } from '../memory/person-profile.js';
import { rebuildScenarios } from '../memory/scenario-store.js';
export const SCHEMA_VERSION = 12;
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
  `ALTER TABLE memories ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
   ALTER TABLE conversations ADD COLUMN audience TEXT NOT NULL DEFAULT 'owner';
   ALTER TABLE conversations ADD COLUMN principal TEXT NOT NULL DEFAULT 'local-owner';
   ALTER TABLE messages ADD COLUMN author TEXT NOT NULL DEFAULT 'local-owner';
   ALTER TABLE agent_sessions ADD COLUMN context_hash TEXT NOT NULL DEFAULT '';
   CREATE TABLE plugin_config (id TEXT PRIMARY KEY, config TEXT NOT NULL, secret TEXT, revision TEXT NOT NULL);
   CREATE TABLE channel_sessions (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id));
   CREATE TABLE channel_deliveries (id TEXT PRIMARY KEY, target TEXT NOT NULL, author TEXT NOT NULL, segments TEXT, status TEXT NOT NULL, message_id TEXT, error TEXT, created_at TEXT NOT NULL);
   CREATE TABLE approvals (id TEXT PRIMARY KEY, payload TEXT NOT NULL, digest TEXT NOT NULL, revision TEXT NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);`,
  `CREATE TABLE video_tasks (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, bvid TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL); CREATE INDEX video_bvid ON video_tasks(bvid,status); CREATE TABLE video_requests (request_id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES video_tasks(id), bvid TEXT NOT NULL);`,
  `ALTER TABLE approvals ADD COLUMN plugin TEXT NOT NULL DEFAULT 'qq';
   ALTER TABLE approvals ADD COLUMN approved_by TEXT;
   CREATE TABLE activity_tasks(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,platform TEXT NOT NULL,kind TEXT NOT NULL,mode TEXT NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL);
   CREATE TABLE activity_schedules(id TEXT PRIMARY KEY,config TEXT NOT NULL,next_at INTEGER NOT NULL,enabled INTEGER NOT NULL);
   CREATE INDEX activity_status ON activity_tasks(platform,status);
   CREATE TABLE activity_requests(request_id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES activity_tasks(id),platform TEXT NOT NULL,kind TEXT NOT NULL,input TEXT NOT NULL);
   CREATE INDEX activity_video ON activity_tasks(platform,kind,json_extract(input,'$.videoId'),status);`,
  `CREATE TABLE qq_stickers(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),builtin INTEGER NOT NULL CHECK(builtin IN (0,1)),revision TEXT NOT NULL,mime_type TEXT NOT NULL,bytes INTEGER NOT NULL,data TEXT NOT NULL); CREATE TABLE qq_sticker_options(id INTEGER PRIMARY KEY CHECK(id=1),network_enabled INTEGER NOT NULL CHECK(network_enabled IN (0,1)),revision TEXT NOT NULL);`,
  `CREATE TABLE conversation_notes(id TEXT PRIMARY KEY,scope TEXT NOT NULL,source_id TEXT NOT NULL,author TEXT NOT NULL,content TEXT NOT NULL,quote TEXT NOT NULL,created_at TEXT NOT NULL); CREATE INDEX conversation_notes_scope ON conversation_notes(scope);`,
  `ALTER TABLE memories ADD COLUMN actor_role TEXT NOT NULL DEFAULT 'unassigned'
      CHECK (actor_role IN ('owner','other','general','unassigned'));
   ALTER TABLE memories ADD COLUMN person_key TEXT NOT NULL DEFAULT '';
   ALTER TABLE memories ADD COLUMN scope_key TEXT NOT NULL DEFAULT '';
   CREATE INDEX channel_sessions_conversation ON channel_sessions(conversation_id);
   DROP INDEX memories_identity;
   CREATE INDEX memories_identity ON memories(actor_role,person_key,kind,subject,scope_key,normalized);`,
  `CREATE TABLE memory_turn_jobs (
     seq INTEGER PRIMARY KEY,
     source_id TEXT NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
     status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','failed')),
     attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, error TEXT
   );
   CREATE INDEX memory_turn_pending ON memory_turn_jobs(seq) WHERE status='pending';
   CREATE INDEX memory_links_source ON memory_links(source_type,source_id,memory_id);`,
  `ALTER TABLE memory_links ADD COLUMN asserted_at TEXT;
   ALTER TABLE memory_links ADD COLUMN speaker_verified INTEGER NOT NULL DEFAULT 0 CHECK(speaker_verified IN (0,1));
   UPDATE memory_links SET asserted_at=(SELECT created_at FROM messages WHERE id=memory_links.source_id)
     WHERE source_type='message';
   CREATE TABLE memory_profile_fields(
     memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
     field_key TEXT NOT NULL, label TEXT NOT NULL, value TEXT NOT NULL, observed_at TEXT NOT NULL,
     source_type TEXT NOT NULL, source_id TEXT NOT NULL, PRIMARY KEY(memory_id,field_key)
   ) WITHOUT ROWID;`,
  `CREATE TABLE memory_scenes(id TEXT PRIMARY KEY,scope_key TEXT NOT NULL,topic TEXT NOT NULL,summary TEXT NOT NULL,
     evidence TEXT NOT NULL,actor_role TEXT NOT NULL,person_key TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE memory_scene_terms(memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
     scope_key TEXT NOT NULL,topic TEXT NOT NULL,strength INTEGER NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(memory_id,topic)) WITHOUT ROWID;
   CREATE INDEX memory_scene_topic ON memory_scene_terms(scope_key,topic,observed_at DESC,memory_id);
   CREATE TABLE memory_scene_context(memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
     basis_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,topic TEXT NOT NULL);`,
];
export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}
export function migrate(db: DatabaseSync, steps = migrations) {
  const current = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (current > steps.length) throw new Error('DATABASE_VERSION_TOO_NEW');
  transaction(db, () => {
    for (let index = current; index < steps.length; index++) {
      db.exec(steps[index]!);
      if (index === 8) classifyLegacyMemories(db);
      if (index === 10) rebuildPersonProfiles(db);
      if (index === 11) rebuildScenarios(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(index + 1, new Date().toISOString());
      db.exec(`PRAGMA user_version = ${index + 1}`);
    }
  });
}
export function openDatabase(file: string) {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;');
    migrate(db);
    return db;
  } catch (error) { db.close(); throw error; }
}
