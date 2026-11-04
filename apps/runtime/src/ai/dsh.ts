import { adapterEffort, openAIModelOptions } from './model-options.js';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateFile, assertRegular, type DataPaths } from '../paths.js';
import { windowsAcl } from '../windows-acl.js';
import type { AgentEngine, EngineInput } from './engine.js';
export class DSHAdapter implements AgentEngine {
  private children = new Set<DeepSeekHarness>();
  constructor(private p: DataPaths) {}
  async close() { await Promise.all([...this.children].map(h => h.close())); }
  async run(input: EngineInput): Promise<string> {
    if(input.images?.length && (!input.model.vision || input.images.length>2 || input.images.some(i=>i.data.length>5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(i.data))))throw new Error('INVALID_ENGINE_IMAGES');
    const home = join(this.p.data, 'engine', input.conversationId);
    for (const path of [join(this.p.data, 'engine'), home, join(home, 'workspace')]) {
      assertRegular(path, true); mkdirSync(path, { recursive: true, mode: 0o700 });
      if (process.platform === 'win32') windowsAcl('restrict', [{ path, directory: true }]);
    }
    const token = randomBytes(32).toString('hex');
    let childPort = 0, text = '', attempt = '', revision = 0;
    const bridge = createServer(async (req, res) => {
      if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${token}` || req.headers.origin) { res.writeHead(403).end(); return; }
      try {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 262144) throw new Error(); }
        const data = JSON.parse(body);
        if(data.tool && data.sessionId===input.sessionId){const tool=input.tools?.find(t=>t.name===data.tool);if(!tool)throw new Error();input.signal.throwIfAborted();input.onTool?.({name:tool.name,state:'running'});try{const value=await tool.execute(data.args,input.signal);input.signal.throwIfAborted();const result=JSON.stringify({result:value});if(result.length>65536)throw new Error();input.onTool?.({name:tool.name,state:'completed'});res.end(result);return;}catch{input.onTool?.({name:tool.name,state:'failed'});res.writeHead(403).end('{}');return;}}
        if (data.ready === true && Number.isInteger(data.port) && data.port > 0 && data.port < 65536) childPort = data.port;
        else if (data.sessionId === input.sessionId && !input.signal.aborted) {
          const frame = data.frame;
          if (frame.type === 'start') { attempt = frame.attemptId; revision = frame.revision; text = ''; input.onText(text); }
          if (frame.type === 'chunk' && frame.attemptId === attempt && frame.revision > revision && frame.chunk?.type === 'text-delta') { revision = frame.revision; text += frame.chunk.text; input.onText(text); }
        }
        res.end('{}');
      } catch { res.writeHead(400).end(); }
    });
    const profile = join(home, `profile-${token.slice(0,12)}.json`);
    let harness: DeepSeekHarness | undefined;
    let cancelTask: Promise<unknown> | undefined;
    let cancel = () => {};
    let resultText = '';
    let runError: unknown;
    const cleanupErrors: unknown[] = [];
    try {
    const plugin = fileURLToPath(new URL('./dsh-bridge.mjs', import.meta.url));
    const disabled = ['persistent-bash','persistent-pwsh','tool-fs','tool-working-directory','session-log-deepseek','plugin-package-inventory-deepseek','terminal-bash','terminal-pwsh','pty'];
    const patches: unknown[] = disabled.map(id => ({ id, disabled: true }));
    patches.push({ id: 'sandbox-policy', config: { mode: 'read-only' } });
    if (input.model.provider === 'openai') {
      patches.push({ id: 'llm-deepseek', disabled: true });
      patches.push({ insert: [{ id: 'llm-bff', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { bff: { api: 'openai-completions', ...(input.model.reasoningEffort ? { reasoning: adapterEffort(input.model.reasoningEffort) } : {}), baseURL: input.model.baseURL, apiKeyEnv: 'BFF_MODEL_API_KEY', models: [{ id: input.model.model, ...openAIModelOptions(input.model), input: input.model.vision ? ['text','image'] : ['text'], contextWindow: input.model.contextWindow, maxTokens: input.model.maxTokens }], timeoutMs: input.model.timeoutMs, streamIdleTimeoutMs: input.model.timeoutMs, retryPolicy: { mode: 'normal', maxRetries: 0 } } } } }] });
    } else patches.push({ id: 'llm-deepseek', config: { ...(input.model.reasoningEffort ? { reasoningEffort: adapterEffort(input.model.reasoningEffort) } : {}), baseURL: input.model.baseURL, apiKeyEnv: 'BFF_MODEL_API_KEY', defaultContextWindow: input.model.contextWindow, streamIdleTimeoutMs: input.model.timeoutMs } });
    patches.push({ insert: [{ id: 'bff-bridge', name: plugin }] });
    privateFile(profile); writeFileSync(profile, JSON.stringify(patches));
    await new Promise<void>((resolve, reject) => { bridge.once('error', reject); bridge.listen(0, '127.0.0.1', resolve); });
    const bridgePort = (bridge.address() as { port: number }).port;
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH','SystemRoot','WINDIR','TEMP','TMP','TMPDIR','LANG']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { BFF_TOOLS:JSON.stringify((input.tools??[]).map(({name,description,parameters})=>({name,description,parameters}))), BFF_SESSION:input.sessionId, BFF_MODEL_API_KEY: input.key || 'local-no-key', BFF_BRIDGE_TOKEN: token, BFF_BRIDGE_URL: `http://127.0.0.1:${bridgePort}`, DSH_SYSTEM_PROMPT: `你是${input.persona.name}。人格配置：${JSON.stringify(input.persona)}\n这是持续的人格配置；不声称拥有真实意识。不具备外部操作工具时不要声称已执行。\n${input.context ?? ''}` });
    harness = new DeepSeekHarness({ profile: 'sdk-minimal', patches: [profile], dshHome: home, cwd: join(home,'workspace'), processCwd: join(home,'workspace'), env, provider: input.model.provider === 'deepseek' ? 'deepseek-official' : 'bff', model: input.model.model, maxTokens: input.model.maxTokens, initializeTimeoutMs: 20000, shutdownTimeoutMs: 1000, disposeEofGraceMs: 1000, disposeGraceMs: 1000 });
    this.children.add(harness);
    cancel = () => { cancelTask ??= (async () => {
      try { if (childPort) { const r = await fetch(`http://127.0.0.1:${childPort}/${input.sessionId}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1500) }); if (r.ok) return; } } catch { /* owned process fallback */ }
      await harness?.close();
    })(); void cancelTask.catch(() => {}); };
    input.signal.addEventListener('abort', cancel, { once: true });
      if (input.signal.aborted) throw new Error('CANCELLED');
      await harness.start();
      const session = input.resume ? await harness.resumeSession(input.sessionId) : harness.session(input.sessionId);
      if (input.signal.aborted) throw new Error('CANCELLED');
      const result = await session.run(input.images?.length ? [{type:'text',text:input.prompt},...input.images] : input.prompt, { onNotification: notification => { if (notification.method === 'session.event') input.onSessionReady(); } });
      input.onSessionReady();
      if (childPort) { const flushed = await fetch(`http://127.0.0.1:${childPort}/flush`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }); if (!flushed.ok) throw new Error('BRIDGE_FAILED'); }
      if (input.signal.aborted) throw new Error('CANCELLED');
      const end = result.events.filter(event => event.type === 'turn/end').at(-1);
      const reason = (end?.data as { reason?: { kind?: string } } | undefined)?.reason?.kind;
      if (reason && !['completed','complete','success','stop'].includes(reason)) throw new Error('MODEL_RUN_FAILED');
      if (!result.finalResponse) throw new Error('EMPTY_MODEL_RESPONSE');
      resultText = result.finalResponse;
    } catch (error) {
      // SDK errors may embed provider response bodies or keys. Never expose them.
      runError = input.signal.aborted ? new Error('CANCELLED', { cause: error })
        : error instanceof Error && ['EMPTY_MODEL_RESPONSE','MODEL_RUN_FAILED'].includes(error.message) ? error
        : new Error('ENGINE_REQUEST_FAILED', { cause: error });
    } finally {
      input.signal.removeEventListener('abort', cancel);
      const cleanup = async (action: () => unknown) => { try { await action(); } catch (error) { cleanupErrors.push(error); } };
      await cleanup(() => cancelTask);
      await cleanup(() => harness?.close());
      if (harness) this.children.delete(harness);
      await cleanup(() => new Promise<void>((resolve, reject) => {
        if (!bridge.listening) { resolve(); return; }
        bridge.close(error => error ? reject(error) : resolve()); bridge.closeAllConnections();
      }));
      await cleanup(() => rmSync(profile, { force: true }));
    }
    if (cleanupErrors.length) throw new AggregateError([...(runError ? [runError] : []), ...cleanupErrors], 'ENGINE_CLEANUP_FAILED');
    if (runError) throw runError;
    return resultText;
  }
}
