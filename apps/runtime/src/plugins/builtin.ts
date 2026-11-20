import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { InputError } from '../ai/types.js';

export const builtinPlatforms = ['qq', 'bilibili', 'douyin'] as const;
export const isBuiltinPlatform = (id: string) => builtinPlatforms.some(platform => platform === id);

export function assertExtensionId(id: string) {
  if (isBuiltinPlatform(id)) throw new InputError(id === 'qq' ? 'QQ_BUILTIN' : 'PLATFORM_BUILTIN', 409);
}

// Keep old extension rows and user files for backups, but never treat them as executable.
// Only transfer a previous stop/revocation once; a later explicit reconnect takes precedence.
export function migrateActivityOwnership(db: DatabaseSync) {
  const key = 'activities.builtinOwnership.v1';
  if (db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const id of ['bilibili', 'douyin']) {
      const row = db.prepare('SELECT config FROM plugin_config WHERE id=?').get('sdk:' + id);
      if (!row) continue;
      let enabled = false;
      try {
        const old = JSON.parse(String(row.config));
        enabled = old?.installed === true && old.enabled === true &&
          Array.isArray(old.granted) && old.granted.includes('activity.' + id);
      } catch { /* An unreadable legacy grant cannot enable a built-in account. */ }
      if (!enabled) db.prepare("UPDATE plugin_config SET config=json_set(config,'$.enabled',json('false')), revision=? WHERE id=?").run(randomUUID(), id);
    }
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(key, 'true');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
