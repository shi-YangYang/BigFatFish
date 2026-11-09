import { mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it, vi } from 'vitest';
import { paths } from '../paths.js';
import { LocalEmbedder } from './local-embedder.js';

it('rejects an equal-length corrupt asset from both mirrors, can retry, and cancels without enabling after restart', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bff-model-'));
  const p = paths(root);
  mkdirSync(p.config); mkdirSync(p.data);
  const embedder = new LocalEmbedder(p);
  const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(new Uint8Array(439125)));
  try {
    expect(embedder.status().state).toBe('off');
    embedder.enable();
    await vi.waitFor(() => expect(embedder.status().state).toBe('failed'));
    expect(request).toHaveBeenCalledTimes(2);
    expect(readdirSync(join(p.data, 'bge-small-zh-v1.5-int8'))).toEqual([]);
    request.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), {once: true});
    }));
    embedder.enable(); embedder.enable();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    embedder.disable();
    await embedder.close();
    const restarted = new LocalEmbedder(p);
    expect(restarted.status().state).toBe('off');
    await expect(restarted.embed(['私密查询'], 'query')).rejects.toThrow('EMBEDDING_UNAVAILABLE');
    await restarted.close();
  } finally { request.mockRestore(); await embedder.close(); rmSync(root, {recursive:true, force:true}); }
});
