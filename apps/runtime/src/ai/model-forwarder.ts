import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';

/** Per-turn adapter transport. The target/key are captured, never supplied by callers. */
export async function forwardModel(req: IncomingMessage, res: ServerResponse, target: string, key: string, signal: AbortSignal) {
  const cancel = new AbortController();
  const closed = () => { if (!res.writableEnded) cancel.abort(); };
  res.once('close', closed);
  const combined = AbortSignal.any([signal, cancel.signal]);
  try {
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 24_000_000) { res.writeHead(413).end('{}'); return; }
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) { res.writeHead(400).end('{}'); return; }
    // pi-ai's streamSimple always materializes a local output budget. Keep that
    // for its context bookkeeping, but let the actual provider choose its cap.
    delete body.max_tokens; delete body.max_completion_tokens;
    const upstream = await fetch(`${target}/chat/completions`, { method: 'POST', redirect: 'error', signal: combined,
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });
    if (!upstream.ok) { await upstream.body?.cancel(); res.writeHead(upstream.status).end('{}'); return; }
    if (!upstream.body) throw new Error('EMPTY_UPSTREAM');
    res.writeHead(200, { 'content-type': upstream.headers.get('content-type')?.includes('text/event-stream') ? 'text/event-stream' : 'application/json', 'cache-control': 'no-store' });
    const reader = upstream.body.getReader(); let received = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        received += value.byteLength; if (received > 32_000_000) throw new Error('MODEL_OUTPUT_TOO_LARGE');
        if (!res.write(value)) await once(res, 'drain', { signal: combined });
      }
    } finally { await reader.cancel().catch(() => {}); }
    res.end();
  } catch {
    if (!res.destroyed) { if (!res.headersSent) res.writeHead(502).end('{}'); else res.destroy(); }
  } finally { cancel.abort(); res.off('close', closed); }
}
