import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';

export type ModelForwardFailure = {kind:'http';status:number}|{kind:'network'|'stream'|'empty'|'too-large'|'redirect'};
export function modelForwardError(failure:ModelForwardFailure){
  return failure.kind==='http'?`MODEL_HTTP_${failure.status}`:({network:'MODEL_NETWORK_ERROR',stream:'MODEL_STREAM_INTERRUPTED',empty:'EMPTY_MODEL_RESPONSE','too-large':'MODEL_RESPONSE_TOO_LARGE',redirect:'MODEL_REDIRECT_DENIED'} as const)[failure.kind];
}

/** Per-turn adapter transport. The target/key are captured, never supplied by callers. */
export async function forwardModel(req: IncomingMessage, res: ServerResponse, target: string, key: string, signal: AbortSignal, onFailure?: (failure:ModelForwardFailure)=>void) {
  const cancel = new AbortController();
  const closed = () => { if (!res.writableEnded) cancel.abort(); };
  res.once('close', closed);
  const combined = AbortSignal.any([signal, cancel.signal]);
  let failure:ModelForwardFailure|undefined;
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
    const upstream = await fetch(`${target}/chat/completions`, { method: 'POST', redirect: 'manual', signal: combined,
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });
    if (!upstream.ok) {
      failure=upstream.status>=300&&upstream.status<400?{kind:'redirect'}:{kind:'http',status:upstream.status};
      if(!combined.aborted)onFailure?.(failure);
      await upstream.body?.cancel();res.writeHead(failure.kind==='redirect'?502:upstream.status).end('{}');return;
    }
    if (!upstream.body) {failure={kind:'empty'};throw new Error('EMPTY_UPSTREAM');}
    res.writeHead(200, { 'content-type': upstream.headers.get('content-type')?.includes('text/event-stream') ? 'text/event-stream' : 'application/json', 'cache-control': 'no-store' });
    const reader = upstream.body.getReader(); let received = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        received += value.byteLength; if (received > 32_000_000) {failure={kind:'too-large'};throw new Error('MODEL_OUTPUT_TOO_LARGE');}
        if (!res.write(value)) await once(res, 'drain', { signal: combined });
      }
    } finally { await reader.cancel().catch(() => {}); }
    res.end();
  } catch {
    if(!combined.aborted)onFailure?.(failure??{kind:res.headersSent?'stream':'network'});
    if (!res.destroyed) { if (!res.headersSent) res.writeHead(502).end('{}'); else res.destroy(); }
  } finally { cancel.abort(); res.off('close', closed); }
}
