// Product boundary around upstream transport. Upstream traffic/risk gates remain active.
const transport = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const u = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !['bilibili.com','bilivideo.com','hdslb.com'].some(d => u.hostname === d || u.hostname.endsWith('.' + d))) throw Error('BILI_UNSAFE_URL');
  if (!['GET','HEAD'].includes(String(options.method ?? 'GET').toUpperCase())) throw Error('BILI_READ_ONLY');
  const response = await transport(input, {...options, redirect:'error',signal:AbortSignal.any([AbortSignal.timeout(30000),...(options.signal?[options.signal]:[])])});
  const cap = u.hostname.endsWith('bilivideo.com') ? 128 * 1024 * 1024 : 4 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > cap) { await response.body?.cancel(); throw Error('BILI_RESPONSE_TOO_LARGE'); }
  if (!response.body) return response;
  let size = 0;
  const stream=response.body.pipeThrough(new TransformStream({transform(chunk, controller){size+=chunk.byteLength;if(size>cap)throw Error('BILI_RESPONSE_TOO_LARGE');controller.enqueue(chunk);}}));
  return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
};
