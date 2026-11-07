import {transcribe,synthesize} from './ai/media.js';
import {InputError,object,string} from './ai/types.js';
import {Plugins,registerPlugins,readBundle} from './plugins/service.js';
import {fileURLToPath} from 'node:url';
import { join } from 'node:path';
import { Douyin } from './douyin/service.js';
import { registerDouyin } from './douyin/routes.js';
import { TaskQueue } from './tasks/queue.js';
import { Activities } from './tasks/service.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { preparePaths, assertRegular, privateFile, type DataPaths } from './paths.js';
import { recoverMaintenance } from './maintenance/archive.js';
import { acquireInstance } from './instance.js';
import { openDatabase } from './storage/database.js';
import { createLogger } from './logger.js';
import { Bilibili } from './bilibili/service.js';
import { registerBilibili } from './bilibili/routes.js';
import { ManagedQQ,registerManagedQQ } from './channels/managed/service.js';
import { Channels } from './channels/service.js';
import { registerChannels } from './channels/routes.js';
import { ChatService } from './ai/chat.js';
import { registerLife } from './memory/routes.js';
import { registerAi } from './ai/routes.js';
import { createServer } from './server.js';
import type { Connection } from './connection.js';

export async function startRuntime(p: DataPaths, port = 0, adapters?: {bilibili?:ConstructorParameters<typeof Bilibili>[4];douyin?:ConstructorParameters<typeof Douyin>[4]}) {
  process.umask(0o077);
  preparePaths(p);
  const release = acquireInstance(p.lock);
  const log = createLogger(p.log);
  let db: ReturnType<typeof openDatabase> | undefined;
  let app: ReturnType<typeof createServer> | undefined;
  let stopping = false;let plugins:Plugins|undefined;
  let chat: ChatService | undefined;
  let channels: Channels | undefined;let managedQQ:ManagedQQ|undefined;
  let bilibili: Bilibili | undefined;let douyin:Douyin|undefined;let activities:Activities|undefined;
  const connection: Connection = { version: 1, pid: process.pid, port, token: randomBytes(32).toString('hex'), instanceId: randomUUID(), startedAt: new Date().toISOString() };
  let initialized!: () => void;
  const initialization = new Promise<void>(resolve => { initialized = resolve; });
  let complete!: () => void;
  let fail!: (error: unknown) => void;
  const finished = new Promise<void>((resolve, reject) => { complete = resolve; fail = reject; });
  // A failed start has no caller awaiting finished, but stop still reports failure.
  void finished.catch(() => {});
  async function shutdown() {
    // Fastify close must not race with an unresolved listen, even during startup failure.
    await initialization;
    const errors: unknown[] = [];
    // Revoke built-in QQ immediately; unrelated extensions may take time to drain.
    const closingQQ = channels?.close().catch(error => { errors.push(error); });
    try { await plugins?.close(); } catch(error){errors.push(error);}
    try { await activities?.close();await douyin?.close(); } catch(error){errors.push(error);}
    try { await bilibili?.close(); } catch (error) { errors.push(error); }
    await closingQQ;
    try { await managedQQ?.close(); } catch(error){errors.push(error);}
    try { await chat?.close(); } catch (error) { errors.push(error); }
    try { await app?.close(); } catch (error) { errors.push(error); }
    if (app?.server.listening) {
      const server = app.server;
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
    // Keep instance ownership until the listening socket is actually closed.
    try {
      db?.prepare('INSERT INTO audit(event, at) VALUES (?, ?)').run('runtime.stopped', new Date().toISOString());
      log('runtime.stopped');
    } catch (error) { errors.push(error); }
    try {
      if (existsSync(p.connection)) {
        assertRegular(p.connection);
        const metadata = JSON.parse(readFileSync(p.connection, 'utf8')) as Connection;
        if (metadata.instanceId === connection.instanceId) unlinkSync(p.connection);
      }
    } catch (error) { errors.push(error); }
    try { db?.close(); } catch (error) { errors.push(error); }
    try { release(); } catch (error) { errors.push(error); }
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
    if (errors.length) throw new AggregateError(errors, 'STOP_FAILED');
  }
  function stop() {
    if (!stopping) {
      stopping = true;
      void shutdown().then(complete, fail);
    }
    return finished;
  }
  const onSignal = () => { void stop().catch(() => { process.exitCode = 1; }); };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  try {
    try {
      // Only the lock owner may replace connection metadata or open the application DB.
      assertRegular(p.connection);
      if (existsSync(p.connection)) unlinkSync(p.connection);
      if(existsSync(join(p.runtime,'update-pending.json')))throw new Error('UPDATE_IN_PROGRESS');
      const updateJournal=join(p.runtime,'update-journal.json');
      if(existsSync(updateJournal)&&JSON.parse(readFileSync(updateJournal,'utf8')).phase!=='committed')throw new Error('UPDATE_IN_PROGRESS');
      recoverMaintenance(p);
      db = openDatabase(p.database);
      if(process.env.BIGFATFISH_MAINTENANCE_PROBE === '1') {
        db.exec("INSERT OR REPLACE INTO settings VALUES('activities.paused','true'); UPDATE plugin_config SET config=json_set(config,'$.enabled',json('false')); UPDATE activity_schedules SET enabled=0; DELETE FROM approvals;");
      }
      app = createServer(p, connection, onSignal);
      chat = new ChatService(db, p);
      await registerAi(app, chat);
      registerLife(app, chat.life);
      plugins=new Plugins(db,p);chat.plugins=plugins;registerPlugins(app,plugins);
      channels = new Channels(db,chat);await channels.initialize();
      managedQQ=new ManagedQQ(p,channels);registerChannels(app,channels,()=>managedQQ!.resume(),()=>managedQQ!.pause());registerManagedQQ(app,managedQQ);managedQQ.initialize();
      bilibili=new Bilibili(db,chat,channels,p,adapters?.bilibili);await bilibili.initialize();registerBilibili(app,bilibili);
      const queue=new TaskQueue(db);queue.onPause=()=>channels!.pauseSelfActivity();douyin=new Douyin(db,chat,queue,p,adapters?.douyin);activities=new Activities(db,queue,chat,bilibili,douyin);registerDouyin(app,douyin,activities);
      plugins.platform={stop:async id=>{if(id==='bilibili')await bilibili!.suspend();if(id==='douyin')await douyin!.stop();},reload:async(id,path)=>{if(id==='bilibili')await bilibili!.reload(path);if(id==='douyin')await douyin!.reload(path);}};
      for(const id of ['bilibili','douyin'])if(!plugins.list().some(x=>x.id===id)){
       const path=fileURLToPath(new URL(`../plugin-catalog/${id}.bff-plugin`,import.meta.url));
       if(existsSync(path)){const bundle=readBundle(path);await plugins.install(bundle);await plugins.enable(id,bundle.manifest.permissions,{});}
      }
      bilibili.assertPlugin=()=>{if(plugins!.list().some(x=>x.id==='bilibili'))plugins!.check('bilibili');};
      douyin.assertPlugin=()=>{if(plugins!.list().some(x=>x.id==='douyin'))plugins!.check('douyin');};
      plugins.capability=async(method,args,signal,guard)=>{const b=object(args);if(method==='personality.read')return chat!.config.persona();if(method==='memory.search')return chat!.life.memories.list(b);if(method==='memory.propose')return chat!.life.memories.insert({...b,status:'candidate'});if(method==='channel.propose')throw new InputError('QQ_APPROVAL_REMOVED',410);if(method==='channel.send')return channels!.send(b,guard);if(method==='media.transcribe')return transcribe(chat!.config,{data:string(b.data,3000000),mimeType:string(b.mimeType,100)},signal);if(method==='media.synthesize')return synthesize(chat!.config,b,signal);throw new Error('PLUGIN_HOST_DENIED');};
      chat.events.on('message',event=>void plugins!.event('message',event));
      await plugins.initialize();

      const address = await app.listen({ host: '127.0.0.1', port });
      if (stopping) throw new Error('START_INTERRUPTED');
      connection.port = Number(new URL(address).port);
      const temporary = `${p.connection}.${connection.instanceId}.tmp`;
      try {
        writeFileSync(temporary, '', { mode: 0o600, flag: 'wx' });
        // Establish and verify Windows DACL before writing the bearer token.
        privateFile(temporary);
        writeFileSync(temporary, JSON.stringify(connection));
        renameSync(temporary, p.connection);
      } finally { if (existsSync(temporary)) unlinkSync(temporary); }
      db.prepare('INSERT INTO audit(event, at) VALUES (?, ?)').run('runtime.started', connection.startedAt);
      log('runtime.started', { pid: process.pid, port: connection.port });
    } finally { initialized(); }
    return { connection, stop, finished };
  } catch (error) {
    await stop();
    throw error;
  }
}
