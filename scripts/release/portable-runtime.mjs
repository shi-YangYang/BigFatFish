import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

// An incremental developer build retains old modules for running sessions.
// Include only current runtime modules/assets when copying it into a release.
export function portableRuntimeFilter(root) {
  const emitted = resolve(root, 'dist/runtime/src');
  const source = resolve(root, 'apps/runtime/src');
  const napcat = join('channels', 'managed', 'napcat');
  return path => {
    const name = relative(emitted, resolve(path));
    if (!name || name === '..' || name.startsWith('..' + sep)) return true;
    // This subtree is built from the pinned third-party workspace, not TypeScript.
    if (name === napcat || name.startsWith(napcat + sep)) return true;
    const candidate = join(source, name);
    return existsSync(candidate) || (name.endsWith('.js') && existsSync(candidate.slice(0, -3) + '.ts'));
  };
}
