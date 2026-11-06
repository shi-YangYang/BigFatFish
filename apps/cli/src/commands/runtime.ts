import { existsSync } from 'node:fs';
import { type parseOptions, publicError } from '../../../runtime/src/arguments.js';
import { getStatus } from '../../../runtime/src/connection.js';
import type { DataPaths } from '../../../runtime/src/paths.js';
import { createRuntimeClient } from '../runtime/client.js';
import { start, stop } from '../runtime/process.js';

export async function runtimeCommand(paths: DataPaths, options: ReturnType<typeof parseOptions>) {
  switch (options.command) {
    case 'start':
      return start(paths, options.port);
    case 'stop':
      return stop(paths);
    case 'restart':
      await stop(paths);
      return start(paths, options.port);
    case 'status':
      if (existsSync(paths.connection)) return getStatus(paths);
      process.exitCode = 3;
      return { state: 'stopped' };
    case 'logs':
      return createRuntimeClient(paths).request(`/v1/logs?lines=${options.lines}`);
    case 'doctor': {
      const [major, minor] = process.versions.node.split('.').map(Number);
      const nodeSupported = major === 24 && Number(minor) >= 9;
      let runtime;
      try { runtime = await getStatus(paths); }
      catch (error) { runtime = { state: 'unavailable', error: publicError(error) }; }
      if (!nodeSupported || runtime.state !== 'running') process.exitCode = 1;
      return { node: process.versions.node, nodeSupported, platform: process.platform, dataDir: paths.root, runtime };
    }
    default:
      throw new Error('UNKNOWN_COMMAND');
  }
}
