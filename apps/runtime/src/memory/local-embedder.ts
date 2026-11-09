import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { DataPaths } from '../paths.js';
import { privateCopy } from './files.js';
import { modelBytes, prepareModel } from './bge-assets.js';
export { EMBEDDING_REVISION } from './bge-assets.js';

type State = 'off' | 'downloading' | 'ready' | 'failed';
type Kind = 'query' | 'passage';
type Pending = { resolve: (value: Float32Array[]) => void; reject: (reason: Error) => void };

export class LocalEmbedder {
  private readonly directory: string;
  private readonly marker: string;
  private state: State = 'off';
  private downloadedBytes = 0;
  private error?: string;
  private controller?: AbortController;
  private worker?: Worker;
  private preparation?: Promise<void>;
  private closed = false;
  private sequence = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<() => void>();

  constructor(private paths: DataPaths) {
    this.directory = join(paths.data, 'bge-small-zh-v1.5-int8');
    this.marker = join(paths.config, 'semantic-memory.enabled');
    if (existsSync(this.marker)) this.start();
  }

  status() {
    return { state: this.state, downloadedBytes: this.downloadedBytes, totalBytes: modelBytes, error: this.error };
  }

  enable() {
    if (this.closed) throw new Error('EMBEDDING_CLOSED');
    if (this.state === 'ready' || this.state === 'downloading') return;
    privateCopy(this.paths.config, 'semantic-memory.enabled', '1');
    this.start();
  }

  disable() {
    rmSync(this.marker, { force: true });
    this.stop();
  }

  onReady(listener: () => void) {
    this.listeners.add(listener);
    if (this.state === 'ready') queueMicrotask(() => {
      if (this.state === 'ready' && this.listeners.has(listener)) listener();
    });
    return () => { this.listeners.delete(listener); };
  }

  embed(texts: string[], kind: Kind): Promise<Float32Array[]> {
    if (!this.worker || this.state !== 'ready') return Promise.reject(new Error('EMBEDDING_UNAVAILABLE'));
    if (!texts.length) return Promise.resolve([]);
    if (texts.length > 32 || this.pending.size >= 64) return Promise.reject(new Error('EMBEDDING_BATCH_LIMIT'));
    // BERT will truncate to 512 tokens. Bound pre-tokenization work as well.
    const inputs = texts.map(text => text.slice(0, 8192));
    const id = ++this.sequence;
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try { worker.postMessage({ id, texts: inputs, kind }); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }

  private start() {
    this.state = 'downloading';
    this.error = undefined;
    this.downloadedBytes = 0;
    const control = new AbortController();
    this.controller = control;
    const ready = async () => {
      await prepareModel(this.directory, control.signal, size => {
        if (!control.signal.aborted) this.downloadedBytes = size;
      });
      control.signal.throwIfAborted();
      const worker = new Worker(new URL('./bge-worker.mjs', import.meta.url), {
        workerData: { directory: this.directory }, execArgv: [],
      });
      this.worker = worker;
      worker.on('message', message => {
        if (this.worker !== worker) return;
        if (message.ready) {
          this.state = 'ready';
          for (const listener of this.listeners) listener();
          return;
        }
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(message.error));
        else pending?.resolve(message.vectors);
      });
      const ended = () => {
        if (this.worker !== worker) return;
        this.worker = undefined;
        this.state = 'failed';
        this.error = 'EMBEDDING_RUNTIME_FAILED';
        this.rejectPending();
      };
      worker.on('error', ended);
      worker.on('exit', ended);
    };
    this.preparation = ready().catch(() => {
      if (!control.signal.aborted) {
        this.state = 'failed';
        this.error = 'EMBEDDING_PREPARATION_FAILED';
      }
    });
  }

  private rejectPending() {
    for (const {reject} of this.pending.values()) reject(new Error('EMBEDDING_UNAVAILABLE'));
    this.pending.clear();
  }

  private stop() {
    this.controller?.abort();
    this.state = 'off';
    this.error = undefined;
    this.downloadedBytes = 0;
    const worker = this.worker;
    this.worker = undefined;
    this.rejectPending();
    return worker?.terminate();
  }

  async close() {
    this.closed = true;
    this.listeners.clear();
    await Promise.all([this.stop(), this.preparation]);
  }
}
