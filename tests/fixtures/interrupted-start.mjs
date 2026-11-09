import { startRuntime } from '../../dist/runtime/src/lifecycle.js';
import { mkdirSync, rmSync } from 'node:fs';
import { paths } from '../../dist/runtime/src/paths.js';
const [root, port, mode] = process.argv.slice(2);
if (mode === 'during-listen') {
  process.once('newListener', (event) => {
    if (event === 'SIGTERM') void Promise.resolve().then(() => {
      // Deliberate signal-handler timing injection, not an operating-system signal.
      process.emit('SIGTERM');
      process.emit('SIGTERM');
    });
  });
}
try {
  const runtime = await startRuntime(paths(root), Number(port));
  if (mode === 'shutdown-error') {
    rmSync(paths(root).log); mkdirSync(paths(root).log);
    const first = runtime.stop();
    if (first !== runtime.stop()) throw new Error('STOP_PROMISE_CHANGED');
    try { await first; throw new Error('MISSING_STOP_FAILURE'); }
    catch (error) { if (error.message !== 'STOP_FAILED') throw error; }
    try { await runtime.stop(); throw new Error('MISSING_REPEATED_FAILURE'); }
    catch (error) { if (error.message !== 'STOP_FAILED') throw error; }
  } else if (mode === 'repeat-stop') {
    const first = runtime.stop();
    if (first !== runtime.stop()) throw new Error('STOP_PROMISE_CHANGED');
    process.emit('SIGTERM');
    await first;
  } else {
    process.send?.({ state: 'ready' });
    await runtime.finished;
  }
} catch (error) {
  if (mode !== 'during-listen' || error.message !== 'START_INTERRUPTED') throw error;
  console.log('START_INTERRUPTED');
}
