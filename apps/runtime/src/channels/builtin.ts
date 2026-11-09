import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';

// Keep the historical rows/files for old backups; they never supply executable code.
// Transfer the old stop/revoke intent only once, before the connection is read.
export function migrateQQOwnership(db:DatabaseSync) {
  const key='qq.builtinOwnership.v1';
  if(db.prepare('SELECT 1 FROM settings WHERE key=?').get(key))return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const row=db.prepare("SELECT config FROM plugin_config WHERE id='sdk:qq'").get();
    if(row) {
      let wasEnabled=false;
      try {
        const state=JSON.parse(String(row.config));
        wasEnabled=state?.enabled===true&&state?.installed===true&&Array.isArray(state?.granted)&&state.granted.includes('channel.qq');
      } catch { /* An unreadable retired state cannot authorize automatic connection. */ }
      if(!wasEnabled)db.prepare("UPDATE plugin_config SET config=json_set(config,'$.enabled',json('false')),revision=? WHERE id='qq'").run(randomUUID());
    }
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(key,'true');
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
