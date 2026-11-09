// Dev-only IPC worker. The installed daemon entry and detached CLI remain unchanged.
import { startRuntime } from '../dist/runtime/src/lifecycle.js';
import { paths } from '../dist/runtime/src/paths.js';
import { publicError } from '../dist/runtime/src/arguments.js';
let runtime, cancelled = false;
async function stop() {
  cancelled = true;
  if (runtime) await runtime.stop();
}
process.once('disconnect', () => { void stop().catch(() => { process.exitCode = 1; }); });
process.on('message', message => {
  if (message?.type === 'stop') void stop().catch(() => { process.exitCode = 1; });
});
try {
  if (!process.connected || !process.env.BIGFATFISH_DATA_DIR) throw new Error('DEV_SUPERVISOR_REQUIRED');
  runtime = await startRuntime(paths(process.env.BIGFATFISH_DATA_DIR));
  if (cancelled || !process.connected) await runtime.stop();
  else process.send({ type: 'ready', instanceId: runtime.connection.instanceId }, error => { if (error) void stop().catch(() => { process.exitCode = 1; }); });
  await runtime.finished;
} catch (error) {
  if (process.connected) process.send({ type: 'failed', error: publicError(error) }, () => {});
  process.exitCode = 1;
} finally {
  if (runtime) await runtime.stop().catch(() => { process.exitCode = 1; });
  if (process.connected) process.disconnect();
}
