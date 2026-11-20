import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparePaths, paths } from '../../../apps/runtime/src/storage/paths.js';
import { openDatabase } from '../../../apps/runtime/src/storage/database.js';
import { exportArchive, restoreArchive } from '../../../apps/runtime/src/maintenance/archive.js';

it('restores platform accounts from current and legacy backups without their retired installers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bff-platform-archive-')), src = paths(join(root,'source'));
  const ids = ['qq','bilibili','douyin'], archive = join(root,'platforms.bff');
  const legacyRows = ids.map(id => ({id:'sdk:'+id,revision:'old-sdk',secret:null,config:JSON.stringify({
    enabled:true,installed:true,directory:'/retired/package',granted:['activity.'+id],
    manifest:{id,kind:'platform',entry:'old-executable.mjs'},storage:{},
  })}));
  try {
    preparePaths(src);
    const original = openDatabase(src.database);
    try {
      const save = original.prepare('INSERT INTO plugin_config(id,config,revision) VALUES(?,?,?)');
      save.run('qq',JSON.stringify({enabled:true,url:'ws://127.0.0.1:1234',accountId:'10001',ownerId:'20002',groups:[],replyEnabled:true,proactiveEnabled:false}),'qq-settings');
      save.run('douyin',JSON.stringify({enabled:true,headless:false,accountId:'30003',executablePath:'/old/chrome',pythonPath:'/old/python'}),'douyin-settings');
      save.run('bilibili',JSON.stringify({enabled:true,account:{mid:'40004',name:'fixture'}}),'bili-settings');
      for(const row of legacyRows)save.run(row.id,row.config,row.revision);
    } finally { original.close(); }
    await exportArchive(src, archive, {scopes:['plugins']});
    const envelope = JSON.parse(readFileSync(archive,'utf8')), file = envelope.files[0];
    const payload = JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
    expect(payload.tables.plugin_config.map((r:{id:string})=>r.id).sort()).toEqual([...ids].sort());
    const oldArchive = (fileName:string, extra:typeof legacyRows) => {
      const bytes = Buffer.from(JSON.stringify({...payload,tables:{...payload.tables,plugin_config:[...payload.tables.plugin_config,...extra]}}));
      const p = join(root,fileName);
      writeFileSync(p,JSON.stringify({...envelope,files:[{...file,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),content:bytes.toString('base64')}]}));
      return p;
    };
    for (const [index,a] of [archive,oldArchive('old.bff',legacyRows)].entries()) {
      const output = paths(join(root,'restored-'+index));preparePaths(output);
      await restoreArchive(output,a);
      const db = openDatabase(output.database);
      try {
        const rows = db.prepare('SELECT id,config,secret FROM plugin_config ORDER BY id').all();
        expect(rows.map(r=>r.id)).toEqual([...ids].sort());
        for(const row of rows){expect(JSON.parse(String(row.config)).enabled).toBe(false);expect(row.secret).toBeNull();}
        expect(JSON.parse(String(rows[0]!.config)).account.mid).toBe('40004');
        expect(JSON.parse(String(rows[1]!.config))).toMatchObject({accountId:'30003',executablePath:'',pythonPath:'python3'});
        expect(JSON.parse(String(rows[2]!.config)).ownerId).toBe('20002');
      } finally { db.close(); }
    }
    const dst=paths(join(root,'invalid'));preparePaths(dst);
    await expect(restoreArchive(dst,oldArchive('invalid.bff',[{...legacyRows[0]!,id:'sdk:other-extension'}]))).rejects.toThrow();
  } finally { rmSync(root,{recursive:true,force:true}); }
});
