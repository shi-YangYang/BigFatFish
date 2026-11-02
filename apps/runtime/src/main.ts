#!/usr/bin/env node
import { parseOptions, publicError } from './arguments.js';
import { dataRoot, paths } from './paths.js';
import { startRuntime } from './lifecycle.js';
import { reportStartup } from './startup.js';
try {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) console.log('bigfatfishd [--data-dir PATH] [--port PORT]');
  else {
    if (options.positionals.length) throw new Error('INVALID_ARGUMENTS');
    const runtime = await startRuntime(paths(dataRoot(options['data-dir'])), options.port);
    reportStartup('ready');
    await runtime.finished;
  }
} catch (error) {
  reportStartup(error instanceof Error && error.message === 'ALREADY_RUNNING' ? 'contended' : 'failed');
  console.error(JSON.stringify({ error: publicError(error) })); process.exitCode = 1; }
