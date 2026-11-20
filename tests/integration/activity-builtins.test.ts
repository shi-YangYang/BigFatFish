import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { migrateActivityOwnership } from '../../apps/runtime/src/plugins/builtin.js';
import { Plugins } from '../../apps/runtime/src/plugins/service.js';
import { paths } from '../../apps/runtime/src/paths.js';

describe.each(['bilibili', 'douyin'])('built-in ownership: %s', id => {
  it.each(['absent', 'enabled', 'disabled', 'removed', 'revoked', 'malformed'])(
    'retains account data and transfers %s extension state once',
    async mode => {
      const db = new DatabaseSync(':memory:'), dir = mkdtempSync(join(tmpdir(), 'bff-platform-'));
      try {
        db.exec('CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE plugin_config(id TEXT PRIMARY KEY,config TEXT,secret TEXT,revision TEXT)');
        const save = db.prepare('INSERT INTO plugin_config VALUES(?,?,NULL,?)');
        const config = { enabled:true, accountId:'fixture', headless:true };
        db.prepare('INSERT INTO plugin_config VALUES(?,?,?,?)').run(id, JSON.stringify(config), 'encrypted-fixture', 'origin');
        const old = { enabled:mode !== 'disabled', installed:mode !== 'removed', granted:mode === 'revoked' ? [] : ['activity.' + id] };
        if (mode !== 'absent') save.run('sdk:' + id, mode === 'malformed' ? '{' : JSON.stringify(old), 'old');
        // These historical rows contain no executable resource path or valid extension manifest.
        // They must never be registered, initialized or dispatched.
        const plugins = new Plugins(db, paths(dir));
        migrateActivityOwnership(db);
        const read = () => db.prepare('SELECT config,secret,revision FROM plugin_config WHERE id=?').get(id)!;
        const row = read(), wasAllowed = ['absent','enabled'].includes(mode);
        expect(JSON.parse(String(row.config))).toEqual({...config, enabled:wasAllowed});
        expect(row.secret).toBe('encrypted-fixture');
        expect(row.revision === 'origin').toBe(wasAllowed);
        await plugins.initialize();
        expect(plugins.list()).toEqual([]);
        const bundle = { format:'bigfatfish-plugin', manifest:{ protocol:1, runtime:'^0.1.0', id } };
        expect(() => plugins.inspect(bundle)).toThrow('PLATFORM_BUILTIN');
        await expect(plugins.install(bundle)).rejects.toThrow('PLATFORM_BUILTIN');
        await expect(plugins.install(bundle,true)).rejects.toThrow('PLATFORM_BUILTIN');
        await expect(plugins.enable(id,[])).rejects.toThrow('PLATFORM_BUILTIN');
        await expect(plugins.disable(id)).rejects.toThrow('PLATFORM_BUILTIN');
        await expect(plugins.call(id,'test',{})).rejects.toThrow('PLATFORM_BUILTIN');
        await expect(plugins.remove(id)).rejects.toThrow('PLATFORM_BUILTIN');
        await plugins.close();
        db.prepare('UPDATE plugin_config SET config=?,revision=? WHERE id=?').run(JSON.stringify(config),'explicit-reconnect',id);
        migrateActivityOwnership(db);
        expect(read().revision).toBe('explicit-reconnect');
        expect(JSON.parse(String(read().config))).toEqual(config);
      } finally { db.close(); rmSync(dir,{recursive:true,force:true}); }
    });
});
