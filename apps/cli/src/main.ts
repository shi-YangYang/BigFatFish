#!/usr/bin/env node
import { pluginCommand } from './commands/plugins.js';
import { mediaCommand } from './commands/media.js';
import { webCommand } from './commands/web.js';
import { updateCommand } from './commands/update.js';
import { maintenanceCommand } from './commands/maintenance.js';
import { activityCommand } from './commands/activities.js';
import { bilibiliCommand } from './commands/bilibili.js';
import { channelCommand } from './commands/channels.js';
import { lifeCommand } from './commands/life.js';
import { aiCommand } from './commands/ai.js';
import { parseOptions, publicError } from '../../runtime/src/arguments.js';
import { dataRoot, paths } from '../../runtime/src/paths.js';
import { runtimeCommand } from './commands/runtime.js';
let json = process.argv.includes('--json');
function output(value: unknown) { console.log(json ? JSON.stringify(value) : JSON.stringify(value, null, 2)); }
try {
  const options = parseOptions(process.argv.slice(2));
  json = options.json;
  if (options.help || !options.command) {
    console.log('bigfatfish <web|plugins|media|update|onboard|config|backup|start|stop|restart|status|logs|doctor|models|routes|persona|sessions|chat|cancel|life|memories|diaries|memory-tasks|channels|permissions|bilibili|douyin|activities|schedules> [--data-dir PATH] [--port PORT] [--lines 1..200] [--json]');
  } else {
    const plugin=options.command==='plugins',media=options.command==='media';
    const web=options.command==='web';
    const update=options.command==='update';
    const maintenance=['backup','onboard','config'].includes(options.command);
    const activity=['douyin','activities','schedules'].includes(options.command);
    const bili=options.command==='bilibili';
    const channel = ['channels','permissions'].includes(options.command);
    const life = ['life','memories','diaries','memory-tasks'].includes(options.command);
    const ai = ['models','routes','persona','sessions','chat','cancel'].includes(options.command);
    if (!plugin && !media && !web && !update && !maintenance && !activity && !bili && !ai && !life && !channel && options.positionals.length !== 1) throw new Error('INVALID_ARGUMENTS');
    const p = paths(dataRoot(options['data-dir']));
    if(plugin)output(await pluginCommand(p,options.positionals));
    else if(media)output(await mediaCommand(p,options.positionals));
    else if(web)output(await webCommand(p,options.positionals));
    else if(update)output(await updateCommand(p,options.positionals));
    else if(maintenance)output(await maintenanceCommand(p,options.positionals));
    else if(activity)await activityCommand(p,options.positionals,output);
    else if(bili)await bilibiliCommand(p,options.positionals,output);
    else if (channel) await channelCommand(p,options.positionals,output);
    else if (life) await lifeCommand(p, options.positionals, output);
    else if (ai) await aiCommand(p, options.positionals, json, output);
    else output(await runtimeCommand(p, options));
  }
} catch (error) { output({ error: publicError(error) }); process.exitCode = 1; }
