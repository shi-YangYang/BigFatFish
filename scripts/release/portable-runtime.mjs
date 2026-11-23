import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// An incremental developer build retains old modules for running sessions.
// Include only current runtime modules/assets when copying it into a release.
export function portableRuntimeFilter(root) {
  const dist = resolve(root, 'dist');
  const modules = ['runtime', 'cli'].map(name => ({
    emitted: join(dist, name, 'src'), source: resolve(root, 'apps', name, 'src'), runtime: name === 'runtime',
  }));
  const napcat = join('channels', 'managed', 'napcat');
  return path => {
    const file = resolve(path);
    if (relative(dist, file).split(sep)[0] === 'web') return false;
    for (const {emitted, source, runtime} of modules) {
      const name = relative(emitted, file);
      if (!name || name === '..' || name.startsWith('..' + sep)) continue;
      // This subtree is built from the pinned third-party workspace, not TypeScript.
      if (runtime && (name === napcat || name.startsWith(napcat + sep))) return true;
      const candidate = join(source, name);
      return existsSync(candidate) || (name.endsWith('.js') && existsSync(candidate.slice(0, -3) + '.ts'));
    }
    return true;
  };
}
