import type { DataPaths } from '../../../runtime/src/paths.js';
import { readInput } from '../io/input.js';
import { createRuntimeClient } from '../runtime/client.js';

export async function mediaCommand(paths: DataPaths, args: string[]) {
  const action = args[1];
  if (action !== 'transcribe' && action !== 'synthesize') throw new Error('INVALID_ARGUMENTS');
  const { request } = createRuntimeClient(paths);
  return request(`/v1/media/${action}`, 'POST', await readInput(3_000_000));
}
