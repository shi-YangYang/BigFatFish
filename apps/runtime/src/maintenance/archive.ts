import {classifyLegacyMemories, validAttribution} from '../memory/attribution.js';
import {canShareMemory, type MemoryAttribution} from '../memory/types.js';
import {ConversationNotes} from '../memory/notes.js';
import {StickerLibrary} from '../channels/stickers.js';
import {validateBundle,hash as pluginHash} from '../plugins/package.js';
import { backup, DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  randomUUID,
} from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertRegular,
  paths,
  preparePaths,
  type DataPaths,
} from "../paths.js";
import { acquireInstance } from "../instance.js";
import { rebuildPersonProfiles } from "../memory/person-profile.js";
import { openDatabase, SCHEMA_VERSION } from "../storage/database.js";
import { privateCopy } from "../memory/files.js";
import { Configuration } from "../ai/configuration.js";
import { configuration as parseConfig } from "../channels/protocol.js";
import { SecretStore } from "../ai/secrets.js";

export const groups = {
  persona: ["personas"],
  models: ["models", "settings"],
  sessions: [
    "conversations",
    "messages",
    "channel_sessions",
    "channel_deliveries",
  ],
  memories: ["memories", "memory_links", "interests", "relationships", "conversation_notes"],
  life: [
    "activity_records",
    "experiences",
    "mood_history",
    "daily_diaries",
    "video_tasks",
    "video_requests",
    "activity_tasks",
    "activity_requests",
    "activity_schedules",
  ],
  plugins: ["plugin_config", "qq_stickers", "qq_sticker_options"],
} as const;
export type Scope = keyof typeof groups;
type Row = Record<string, SQLInputValue>;
interface Payload {
  version: 1;
  schema: number;
  scopes: Scope[];
  credentials: boolean;
  tables: Record<string, Row[]>;
}
const limit = 128 * 1024 * 1024;
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
function encode(value: Payload, password?: string) {
  const bytes = Buffer.from(JSON.stringify(value));
  const content = {
    format: "bigfatfish",
    version: 1,
    files: [
      {
        path: "data.json",
        size: bytes.length,
        sha256: hash(bytes),
        content: bytes.toString("base64"),
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(content));
  if (!password) return raw;
  if (password.length < 12 || password.length > 1024)
    throw new Error("PASSWORD_LENGTH");
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    scryptSync(password, salt, 32),
    iv,
  );
  return Buffer.from(
    JSON.stringify({
      format: "bigfatfish-encrypted",
      version: 1,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      ...(() => {
        const body = Buffer.concat([cipher.update(raw), cipher.final()]);
        return {
          tag: cipher.getAuthTag().toString("base64"),
          body: body.toString("base64"),
        };
      })(),
    }),
  );
}
function decode(file: string, password?: string): Payload {
  assertRegular(file);
  if (statSync(file).size > limit) throw new Error("ARCHIVE_TOO_LARGE");
  let value = JSON.parse(readFileSync(file, "utf8"));
  const encrypted = value.format === "bigfatfish-encrypted";
  if (value.format === "bigfatfish-encrypted") {
    if (!password || password.length > 1024 || value.version !== 1)
      throw new Error("ARCHIVE_PASSWORD_REQUIRED");
    try {
      const salt = Buffer.from(value.salt, "base64"),
        iv = Buffer.from(value.iv, "base64"),
        tag = Buffer.from(value.tag, "base64");
      if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16)
        throw new Error();
      const cipher = createDecipheriv(
        "aes-256-gcm",
        scryptSync(password, salt, 32),
        iv,
      );
      cipher.setAuthTag(tag);
      value = JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(value.body, "base64")),
          cipher.final(),
        ]).toString(),
      );
    } catch {
      throw new Error("ARCHIVE_DECRYPT_FAILED");
    }
  }
  if (
    value.format !== "bigfatfish" ||
    value.version !== 1 ||
    !Array.isArray(value.files) ||
    value.files.length !== 1
  )
    throw new Error("INVALID_ARCHIVE");
  const entry = value.files[0];
  // Archive paths are never used as filesystem destinations. Exactly one logical file is allowed.
  if (entry.path !== "data.json" || entry.type !== undefined)
    throw new Error("INVALID_ARCHIVE_PATH");
  const bytes = Buffer.from(entry.content, "base64");
  if (bytes.length !== entry.size || hash(bytes) !== entry.sha256)
    throw new Error("ARCHIVE_CHECKSUM");
  const payload = JSON.parse(bytes.toString()) as Payload;
  if (payload.version !== 1 || ![6, 7, 8, 9, 10, SCHEMA_VERSION].includes(payload.schema))
    throw new Error("ARCHIVE_SCHEMA_UNSUPPORTED");
  if (
    !Array.isArray(payload.scopes) ||
    payload.scopes.some((s) => !Object.hasOwn(groups, s)) ||
    typeof payload.credentials !== "boolean"
  )
    throw new Error("INVALID_ARCHIVE");
  if (payload.credentials && (!password || !encrypted))
    throw new Error("ARCHIVE_PASSWORD_REQUIRED");
  return payload;
}
export function inspectArchive(file: string, password?: string) {
  const p = decode(file, password);
  return {
    schema: p.schema,
    scopes: p.scopes,
    credentials: p.credentials,
    conversations: p.tables.conversations?.length ?? 0,
    activitiesPaused: true,
    reauthorizeChannels: true,
  };
}
export async function exportArchive(
  p: DataPaths,
  file: string,
  options: { scopes?: Scope[]; credentials?: boolean; password?: string } = {},
) {
  preparePaths(p);
  const release = acquireInstance(p.lock);
  const temp = mkdtempSync(join(tmpdir(), "bff-backup-"));
  try {
    recoverMaintenance(p);
    const scopes = options.scopes ?? (Object.keys(groups) as Scope[]);
    if (!scopes.length || scopes.some((s) => !Object.hasOwn(groups, s)))
      throw new Error("INVALID_BACKUP_SCOPE");
    if (
      scopes.includes("sessions") &&
      (!scopes.includes("models") || !scopes.includes("persona"))
    )
      throw new Error("SESSIONS_REQUIRE_MODELS_PERSONA");
    if (options.credentials && !options.password)
      throw new Error("ARCHIVE_PASSWORD_REQUIRED");
    const source = openDatabase(p.database);
    try {
      await backup(source, join(temp, "snapshot.sqlite"));
    } finally {
      source.close();
    }
    const db = new DatabaseSync(join(temp, "snapshot.sqlite"));
    const tables: Record<string, Row[]> = {};
    try {
      const secrets = options.credentials
        ? new SecretStore(p, true)
        : undefined;
      for (const scope of scopes)
        for (const table of groups[scope]) {
          tables[table] = db
            .prepare(
              table === "settings"
                ? "SELECT * FROM settings WHERE key='model_routes'"
                : `SELECT * FROM ${table}`,
            )
            .all() as Row[];
          for (const row of tables[table]) {
            if (table === "models" || table === "plugin_config")
              row.secret =
                secrets && row.secret
                  ? secrets.decrypt(String(row.secret))
                  : null;
            if (table === "plugin_config") {
              const config = JSON.parse(String(row.config));
              config.enabled = false;
              if(String(row.id).startsWith('sdk:')){config.granted=[];config.directory='';config.installed=false;}
              if (row.id === "douyin") {
                config.executablePath = "";
                config.pythonPath = "python3";
              }
              row.config = JSON.stringify(config);
              row.revision = randomUUID();
            }
          }
        }
    } finally {
      db.close();
    }
    const bytes = encode(
      {
        version: 1,
        schema: SCHEMA_VERSION,
        scopes,
        credentials: !!options.credentials,
        tables,
      },
      options.password,
    );
    if (bytes.length > limit) throw new Error("ARCHIVE_TOO_LARGE");
    writeFileSync(file, bytes, { mode: 0o600, flag: "wx" });
    return { file, bytes: bytes.length, scopes, encrypted: !!options.password };
  } finally {
    release();
    rmSync(temp, { recursive: true, force: true });
  }
}
// runtime/ remains fixed, retaining the SQLite process lock across directory swaps.
// Journal is written before any rename; recovery is idempotent after process death.
export function recoverMaintenance(p: DataPaths) {
  const file = join(p.runtime, "restore.json");
  if (!existsSync(file)) return;
  assertRegular(file);
  const record = JSON.parse(readFileSync(file, "utf8"));
  if (!/^[a-f0-9-]{36}$/.test(record.id))
    throw new Error("INVALID_RESTORE_JOURNAL");
  const old = join(p.root, `rollback-${record.id}`);
  for (const part of ["config", "data"]) {
    assertRegular(join(old, part), true);
    if (existsSync(join(old, part))) {
      rmSync(join(p.root, part), { recursive: true, force: true });
      renameSync(join(old, part), join(p.root, part));
    }
  }
  rmSync(file); // Keep rollback directory for inspection; never delete the original fish implicitly.
}
export async function restoreArchive(p: DataPaths, file: string, password?: string) {
  const payload = decode(file, password); // Validate before touching the destination.
  preparePaths(p);
  const release = acquireInstance(p.lock);
  const id = randomUUID(),
    staging = paths(join(p.root, `staging-${id}`)),
    old = join(p.root, `rollback-${id}`);

  try {
    recoverMaintenance(p);
    preparePaths(staging);
    const db = openDatabase(staging.database);
    try {
      const secrets = new SecretStore(staging);
      const allowed = payload.scopes.flatMap((s) => [...groups[s]]);
      if (
        Object.keys(payload.tables).some((t) => !allowed.includes(t as never))
      )
        throw new Error("INVALID_ARCHIVE_TABLE");
      db.exec("BEGIN IMMEDIATE");
      for (const table of Object.values(groups).flat()) {
        const rows = payload.tables[table] ?? [];
        if (!Array.isArray(rows) || rows.length > 200000)
          throw new Error("INVALID_ARCHIVE_ROWS");
        const columns = db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .map((r) => String(r.name));
        const legacyMemory = table === 'memories' && payload.schema < 9;
        const importedColumns = legacyMemory ? columns.filter(c => !['actor_role','person_key','scope_key'].includes(c)) : table === 'memory_links' && payload.schema < 11 ? columns.filter(c => c !== 'asserted_at' && c !== 'speaker_verified') : columns;
        for (const row of rows) {
          if (
            !row ||
            Object.keys(row).length !== importedColumns.length ||
            importedColumns.some((c) => !Object.hasOwn(row, c))
          )
            throw new Error("INVALID_ARCHIVE_COLUMNS");
          if (table === 'memories' && !legacyMemory) {
            const actor = {role:row.actor_role,personKey:row.person_key,scopeKey:row.scope_key} as MemoryAttribution;
            if (!validAttribution(actor) || (row.visibility === 'shared' && !canShareMemory(actor))) throw new Error('INVALID_ARCHIVE_MEMORY');
          }
          if (table === "settings" && row.key !== "model_routes")
            throw new Error("INVALID_ARCHIVE_SETTING");
          if (table === "models" || table === "plugin_config")
            row.secret =
              payload.credentials && row.secret
                ? secrets.encrypt(String(row.secret))
                : null;
          if (table === "plugin_config") {
            const config = JSON.parse(String(row.config));
            config.enabled = false;
              if(String(row.id).startsWith('sdk:')){config.granted=[];config.directory='';config.installed=false;}
            row.config = JSON.stringify(config);
            row.revision = randomUUID();
          }
          db.prepare(
            `INSERT INTO ${table} (${importedColumns.join(",")}) VALUES (${importedColumns.map(() => "?").join(",")})`,
          ).run(...importedColumns.map((c) => row[c]!));
        }
      }
      if (payload.schema < 9) classifyLegacyMemories(db);
      rebuildPersonProfiles(db);
      await new StickerLibrary(db).validateStored();
      new ConversationNotes(db).validateStored();
      // Canonical message history will seed a fresh DSH session, excluding old hidden context and host paths.
      for (const row of db.prepare("SELECT id FROM conversations").all())
        db.prepare(
          "INSERT INTO agent_sessions(conversation_id,engine_id,context_hash) VALUES(?,?,?)",
        ).run(row.id!, randomUUID(), "restored");
      const configuration = new Configuration(db, staging);
      for (const model of configuration.models())
        configuration.saveModel(model);
      configuration.saveRoutes(configuration.routes());
      for (const plugin of db
        .prepare("SELECT id,config FROM plugin_config")
        .all()) {
        const config = JSON.parse(String(plugin.config));
        if (plugin.id === "qq") parseConfig(config);
        else if (plugin.id === "douyin") {
          if (
            typeof config.headless !== "boolean" ||
            typeof config.accountId !== "string" ||
            (config.accountId && !/^\d{1,100}$/.test(config.accountId))
          )
            throw new Error("INVALID_ARCHIVE_PLUGIN");
          config.executablePath = "";
          config.pythonPath = "python3";
          db.prepare("UPDATE plugin_config SET config=? WHERE id=?").run(
            JSON.stringify(config),
            plugin.id!,
          );
        } else if(String(plugin.id).startsWith('sdk:')) {
          validateBundle({format:'bigfatfish-plugin',manifest:config.manifest,files:[{path:config.manifest?.entry,data:'',sha256:pluginHash('')}]});
          if(!config.manifest || config.manifest.id!==String(plugin.id).slice(4) || config.manifest.protocol!==1 || typeof config.storage!=='object' || JSON.stringify(config.storage).length>131072)throw new Error('INVALID_ARCHIVE_PLUGIN');
        } else if (plugin.id !== "bilibili")
          throw new Error("INVALID_ARCHIVE_PLUGIN");
      }
      db.exec(
        "UPDATE activity_schedules SET enabled=0; UPDATE activity_tasks SET status=CASE WHEN kind='write' THEN 'unknown' ELSE 'interrupted' END,error='RESTORED' WHERE status IN ('queued','running'); UPDATE video_tasks SET status='interrupted',error='RESTORED' WHERE status IN ('queued','running'); UPDATE channel_deliveries SET status='unknown',error='RESTORED' WHERE status NOT IN ('sent','failed','unknown'); INSERT INTO settings VALUES('activities.paused','true'); UPDATE messages SET status='interrupted',error='RESTORED' WHERE status IN ('queued','running'); COMMIT;",
      );
      for (const diary of db.prepare("SELECT * FROM daily_diaries").all()) {
        const id = String(diary.id);
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(id))
          throw new Error("INVALID_ARCHIVE_DIARY");
        const sources = JSON.parse(String(diary.sources)) as {
          type: string;
          id: string;
          quote: string;
        }[];
        if (!Array.isArray(sources)) throw new Error("INVALID_ARCHIVE_DIARY");
        privateCopy(
          join(staging.data, "diaries"),
          `${id}.md`,
          `# ${diary.day} (${diary.timezone})\n\n${diary.content}\n\n## 来源\n\n${sources.map((s) => `- ${s.type}:${s.id} — ${s.quote}`).join("\n")}\n`,
        );
        db.prepare(
          "UPDATE daily_diaries SET copy_status='ready' WHERE id=?",
        ).run(id);
      }
      if (
        db.prepare("PRAGMA foreign_key_check").all().length ||
        db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok"
      )
        throw new Error("ARCHIVE_DATABASE_INVALID");
    } finally {
      db.close();
    }
    mkdirSync(old, { mode: 0o700 });
    writeFileSync(join(p.runtime, "restore.json"), JSON.stringify({ id }), {
      mode: 0o600,
      flag: "wx",
    });
    for (const part of ["config", "data"]) {
      renameSync(join(p.root, part), join(old, part));
      renameSync(join(staging.root, part), join(p.root, part));
    }
    rmSync(p.connection, { force: true });
    rmSync(join(p.runtime, "restore.json"));
    return {
      restored: true,
      rollback: old,
      activitiesPaused: true,
      credentials: payload.credentials,
      historyPolicy:
        "All messages retained; first continuation uses the latest history within the context budget and reports omissions",
    };
  } catch (error) {
    recoverMaintenance(p);
    throw error;
  } finally {
    rmSync(staging.root, { recursive: true, force: true });
    release();
  }
}
// Raw same-machine rollback for updater snapshots. Unlike portable export it deliberately
// retains local credentials and engine state, and must only read a product-owned snapshot.
export function restoreSnapshot(p: DataPaths, source: string) {
  preparePaths(p);
  const release = acquireInstance(p.lock),
    id = randomUUID();
  const staging = join(p.root, `staging-${id}`),
    old = join(p.root, `rollback-${id}`);
  try {
    recoverMaintenance(p);
    assertRegular(source, true);
    mkdirSync(staging, { mode: 0o700 });
    for (const part of ["config", "data"]) {
      assertRegular(join(source, part), true);
      cpSync(join(source, part), join(staging, part), { recursive: true });
    }
    pauseAfterRollback(join(staging, "data/bigfatfish.sqlite"));
    const db = new DatabaseSync(join(staging, "data/bigfatfish.sqlite"));
    try {
      if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok")
        throw new Error("UPDATE_SNAPSHOT_INVALID");
    } finally {
      db.close();
    }
    mkdirSync(old, { mode: 0o700 });
    writeFileSync(join(p.runtime, "restore.json"), JSON.stringify({ id }), {
      mode: 0o600,
      flag: "wx",
    });
    for (const part of ["config", "data"]) {
      renameSync(join(p.root, part), join(old, part));
      renameSync(join(staging, part), join(p.root, part));
    }
    rmSync(join(p.runtime, "restore.json"));
    rmSync(p.connection, { force: true });
    rmSync(join(p.runtime, "update-pending.json"), { force: true });
    return {
      state: "data-rolled-back",
      failedData: old,
      previousApplication: join(source, "BigFatFish-previous.app"),
      reinstallPreviousDesktop: true,
    };
  } catch (error) {
    recoverMaintenance(p);
    throw error;
  } finally {
    rmSync(staging, { recursive: true, force: true });
    release();
  }
}

// A rollback must not revive previously granted approvals or replay automatic work.
// Inspect table presence so an older application can restore its own original schema.
export function pauseAfterRollback(database: string) {
  const db = new DatabaseSync(database);
  try {
    const tables = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => String(r.name)),
    );
    const updates: Record<string, string> = {
      approvals: "DELETE FROM approvals",
      settings:
        "INSERT OR REPLACE INTO settings VALUES('activities.paused','true')",
      plugin_config:
        "UPDATE plugin_config SET config=json_set(config,'$.enabled',json('false'))",
      activity_schedules: "UPDATE activity_schedules SET enabled=0",
      activity_tasks:
        "UPDATE activity_tasks SET status=CASE WHEN kind='write' THEN 'unknown' ELSE 'interrupted' END,error='RESTORED' WHERE status IN ('queued','running')",
      video_tasks:
        "UPDATE video_tasks SET status='interrupted',error='RESTORED' WHERE status IN ('queued','running')",
      channel_deliveries:
        "UPDATE channel_deliveries SET status='unknown',error='RESTORED' WHERE status NOT IN ('sent','failed','unknown')",
    };
    db.exec("BEGIN IMMEDIATE");
    for (const [table, sql] of Object.entries(updates))
      if (tables.has(table)) db.exec(sql);
    db.exec("COMMIT");
  } finally {
    db.close();
  }
}
