// CPU inference runs in a dedicated Node worker so the QQ/chat event loop stays responsive.
import { parentPort, workerData } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = 1;
const load = name => readFile(join(workerData.directory, name));
const tokenizer = new Tokenizer(JSON.parse(await load('tokenizer.json')), JSON.parse(await load('tokenizer_config.json')));
const session = await ort.InferenceSession.create(await load('model_int8.onnx'), { executionProviders: ['wasm'] });

async function embed(text, kind) {
  const input = kind === 'query' ? '为这个句子生成表示以用于检索相关文章：' + text : text;
  const { ids } = tokenizer.encode(input);
  // The BERT tokenizer inserts [CLS] and [SEP]. Retain [SEP] after truncation.
  const tokens = ids.length > 512 ? [...ids.slice(0, 511), ids.at(-1)] : ids;
  const dims = [1, tokens.length];
  const feeds = {
    input_ids: new ort.Tensor('int64', BigInt64Array.from(tokens, BigInt), dims),
    attention_mask: new ort.Tensor('int64', new BigInt64Array(tokens.length).fill(1n), dims),
    token_type_ids: new ort.Tensor('int64', new BigInt64Array(tokens.length), dims),
  };
  const outputs = await session.run(feeds);
  try {
    const hidden = outputs.last_hidden_state;
    if (!hidden || hidden.dims.at(-1) !== 512) throw new Error('EMBEDDING_INVALID_MODEL');
    const cls = hidden.data.slice(0, 512);
    const norm = Math.hypot(...cls);
    if (!norm || !Number.isFinite(norm)) throw new Error('EMBEDDING_INVALID_RESULT');
    return cls.map(n => n / norm);
  } finally {
    for (const tensor of Object.values(outputs)) tensor.dispose();
    for (const tensor of Object.values(feeds)) tensor.dispose();
  }
}

let queue = Promise.resolve();
parentPort.on('message', ({ id, texts, kind }) => {
  queue = queue.then(async () => {
    try {
      const vectors = [];
      for (const text of texts) vectors.push(await embed(text, kind));
      parentPort.postMessage({ id, vectors }, vectors.map(v => v.buffer));
    } catch {
      parentPort.postMessage({ id, error: 'EMBEDDING_INFERENCE_FAILED' });
    }
  });
});
parentPort.postMessage({ ready: true });
