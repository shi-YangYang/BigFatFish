import { WebSocket } from 'ws';
import { readConnection, requestRuntime } from '../../../runtime/src/connection.js';
import type { DataPaths } from '../../../runtime/src/paths.js';

export function createRuntimeClient(paths: DataPaths) {
  const connection = readConnection(paths);
  return {
    request<T>(path: string, method = 'GET', body?: unknown) {
      return requestRuntime<T>(connection, path, method, body);
    },
    conversationEvents(conversationId: string) {
      const url = `ws://127.0.0.1:${connection.port}/v1/events?conversationId=${encodeURIComponent(conversationId)}`;
      return new WebSocket(url, { headers: { authorization: `Bearer ${connection.token}` } });
    },
  };
}
