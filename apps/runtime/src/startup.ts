// Private parent/child IPC handshake. No token or connection data crosses this channel.
export type StartupResult = { type: 'bigfatfish.startup'; state: 'ready' | 'contended' | 'failed' };
export function reportStartup(state: StartupResult['state']) {
  if (!process.send || !process.connected) return;
  process.send({ type: 'bigfatfish.startup', state } satisfies StartupResult, undefined, undefined, () => {
    if (process.connected) process.disconnect();
  });
}
