import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertRegular } from '../paths.js';

const commit = '75c43b069aac4d136ba6bc1122f995fedcfd2781';
export const EMBEDDING_REVISION = `bge-small-zh-v1.5/${commit}/int8-cls-l2-zh-query-v1`;
const repository = `Xenova/bge-small-zh-v1.5/resolve/${commit}`;
const hosts = ['https://huggingface.co', 'https://hf-mirror.com'];
const assets = [
  { name: 'tokenizer.json', remote: 'tokenizer.json', bytes: 439125, sha: '48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26' },
  { name: 'tokenizer_config.json', remote: 'tokenizer_config.json', bytes: 367, sha: 'e6f3b96db926a37d4039995fbf5ad17de158dfb8f6343d607e4dbaad18d75f5a' },
  { name: 'model_int8.onnx', remote: 'onnx/model_int8.onnx', bytes: 23903394, sha: 'b9837c19ce154ff0726d398ee77abbc03a7faf0476c6f93016c84e531be7ebb5' },
];
export const modelBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);

const matches = (bytes: Buffer, asset: typeof assets[number]) =>
  bytes.length === asset.bytes && createHash('sha256').update(bytes).digest('hex') === asset.sha;

async function download(url: string, max: number, signal: AbortSignal, progress: (size: number) => void) {
  // The request carries only the fixed public asset path, never the text being embedded.
  const request = AbortSignal.any([signal, AbortSignal.timeout(180_000)]);
  const response = await fetch(url, { signal: request, credentials: 'omit' });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error('EMBEDDING_DOWNLOAD_FAILED');
  }
  const reader = response.body.getReader();
  const buffer = Buffer.allocUnsafe(max);
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      if (size + value.length > max) throw new Error('EMBEDDING_INVALID_ASSET');
      buffer.set(value, size);
      size += value.length;
      progress(size);
    }
  } finally { await reader.cancel(); }
  if (size !== max) throw new Error('EMBEDDING_INCOMPLETE_ASSET');
  return buffer;
}

export async function prepareModel(directory: string, signal: AbortSignal, progress: (size: number) => void) {
  assertRegular(directory, true);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let done = 0;
  let mirrors = hosts;
  for (const asset of assets) {
    signal.throwIfAborted();
    const path = join(directory, asset.name);
    assertRegular(path);
    const info = await stat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (info?.size !== asset.bytes || !matches(await readFile(path), asset)) {
      let lastError: unknown;
      for (const host of mirrors) {
        signal.throwIfAborted();
        const tmp = join(directory, randomUUID() + '.part');
        try {
          const bytes = await download(`${host}/${repository}/${asset.remote}`, asset.bytes, signal, size => progress(done + size));
          if (!matches(bytes, asset)) throw new Error('EMBEDDING_INVALID_ASSET');
          await writeFile(tmp, bytes, { flag: 'wx', mode: 0o600 });
          signal.throwIfAborted();
          await rename(tmp, path);
          mirrors = [host, ...hosts.filter(h => h !== host)];
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          progress(done);
        } finally { await rm(tmp, { force: true }); }
      }
      if (lastError) throw lastError;
    }
    done += asset.bytes;
    progress(done);
  }
}
