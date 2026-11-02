#!/usr/bin/env node
import { lifeCommand } from './life.js';
import { aiCommand } from './ai.js';
import { existsSync } from 'node:fs';
import { parseOptions, publicError } from '../../runtime/src/arguments.js';
import { dataRoot, paths } from '../../runtime/src/paths.js';
import { getStatus, readConnection, requestRuntime } from '../../runtime/src/connection.js';
import { start, stop } from './process.js';
let json = process.argv.includes('--json');
function output(value: unknown) { console.log(json ? JSON.stringify(value) : JSON.stringify(value, null, 2)); }
try {
  const options = parseOptions(process.argv.slice(2));
  json = options.json;
  if (options.help || !options.command) {
    console.log('bigfatfish <start|stop|restart|status|logs|doctor|models|routes|persona|sessions|chat|cancel|life|memories|diaries|memory-tasks> [--data-dir PATH] [--port PORT] [--lines 1..200] [--json]');
  } else {
    const life = ['life','memories','diaries','memory-tasks'].includes(options.command);
    const ai = ['models','routes','persona','sessions','chat','cancel'].includes(options.command);
    if (!ai && !life && options.positionals.length !== 1) throw new Error('INVALID_ARGUMENTS');
    const p = paths(dataRoot(options['data-dir']));
    if (life) await lifeCommand(p, options.positionals, output);
    else if (ai) await aiCommand(p, options.positionals, json, output);
    else switch (options.command) {
      case 'start': output(await start(p, options.port)); break;
      case 'stop': output(await stop(p)); break;
      case 'restart': await stop(p); output(await start(p, options.port)); break;
      case 'status': {
        if (!existsSync(p.connection)) { output({ state: 'stopped' }); process.exitCode = 3; }
        else output(await getStatus(p));
        break;
      }
      case 'logs': output(await requestRuntime(readConnection(p), `/v1/logs?lines=${options.lines}`)); break;
      case 'doctor': {
        const nodeSupported = Number(process.versions.node.split('.')[0]) === 24 && Number(process.versions.node.split('.')[1]) >= 9;
        let runtime: unknown;
        try { runtime = await getStatus(p); } catch (error) { runtime = { state: 'unavailable', error: publicError(error) }; }
        const result = { node: process.versions.node, nodeSupported, platform: process.platform, dataDir: p.root, runtime };
        output(result);
        if (!nodeSupported || (runtime as { state: string }).state !== 'running') process.exitCode = 1;
        break;
      }
      default: throw new Error('UNKNOWN_COMMAND');
    }
  }
} catch (error) { output({ error: publicError(error) }); process.exitCode = 1; }
