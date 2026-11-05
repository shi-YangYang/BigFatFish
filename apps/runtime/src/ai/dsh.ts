import { forwardModel, modelForwardError } from './model-forwarder.js';
import { InputError } from './types.js';
import { buildPersonaPrompt } from './persona-prompt.js';
import { adapterEffort, openAIModelOptions, MODEL_REQUEST_TIMEOUT_MS } from './model-options.js';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateFile, assertRegular, type DataPaths } from '../paths.js';
import { windowsAcl } from '../windows-acl.js';
import type { AgentEngine, EngineInput, EngineTool } from './engine.js';
export class DSHAdapter implements AgentEngine {
  private children = new Set<DeepSeekHarness>();
  constructor(private p: DataPaths) {}
  async close() { await Promise.all([...this.children].map(h => h.close())); }
  async run(input: EngineInput): Promise<string> {
    if(input.images?.length && (input.images.length>2 || input.images.some(i=>i.data.length>5600000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(i.data))))throw new Error('INVALID_ENGINE_IMAGES');
    const home = join(this.p.data, 'engine', input.conversationId);
    for (const path of [join(this.p.data, 'engine'), home, join(home, 'workspace')]) {
      assertRegular(path, true); mkdirSync(path, { recursive: true, mode: 0o700 });
      if (process.platform === 'win32') windowsAcl('restrict', [{ path, directory: true }]);
    }
    const token = randomBytes(32).toString('hex');
    let childPort = 0, text = '', attempt = '', revision = 0;
    let modelRequest=0,modelError:string|undefined;
    const imageResults = new Map<string,{tool:EngineTool;value:unknown;presented:boolean}>();
    const bridge = createServer(async (req, res) => {
      if (req.method !== 'POST' || req.headers.authorization !== `Bearer ${token}` || req.headers.origin) { res.writeHead(403).end(); return; }
      if (req.url === '/model/chat/completions' && input.model.provider === 'openai') {
        const request=++modelRequest;modelError=undefined;
        await forwardModel(req,res,input.model.baseURL,input.key,input.signal,failure=>{if(request===modelRequest)modelError=modelForwardError(failure);});return;
      }
      if (req.url !== '/') { res.writeHead(404).end('{}'); return; }
      try {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 262144) throw new Error(); }
        const data = JSON.parse(body);
        if(data.imageReceipt && data.sessionId===input.sessionId){
          const pending=imageResults.get(data.imageReceipt);if(!pending||typeof data.presented!=='boolean')throw new Error();
          if(data.presented&&pending.presented)throw new Error(); // Success is accepted only once; a later transport failure may still revoke it.
          const success=data.presented&&!input.signal.aborted;
          pending.presented=success;if(!success)imageResults.delete(data.imageReceipt);
          try{pending.tool.onImageResult?.(pending.value,success);input.onTool?.({name:pending.tool.name,state:success?'completed':'failed'});}
          catch{imageResults.delete(data.imageReceipt);pending.tool.onImageResult?.(pending.value,false);input.onTool?.({name:pending.tool.name,state:'failed'});throw new Error();}
          if(!success&&data.presented)throw new Error();res.end('{}');return;
        }
        if(data.tool && data.sessionId===input.sessionId){
          const tool=input.tools?.find(t=>t.name===data.tool);if(!tool)throw new Error();input.signal.throwIfAborted();input.onTool?.({name:tool.name,state:'running'});
          try{
            if(tool.resultKind==='image'&&imageResults.size>=16)throw new Error('TOOL_IMAGE_PENDING_LIMIT');
            const value=await tool.execute(data.args,input.signal);input.signal.throwIfAborted();
            const imageReceipt=tool.resultKind==='image'?randomBytes(24).toString('hex'):undefined;
            const result=JSON.stringify({result:value,...(imageReceipt?{imageReceipt}:{})});if(result.length>(imageReceipt?2_800_000:65536))throw new Error();
            if(imageReceipt)imageResults.set(imageReceipt,{tool,value,presented:false});else input.onTool?.({name:tool.name,state:'completed'});
            res.end(result);return;
          }catch{input.onTool?.({name:tool.name,state:'failed'});res.writeHead(403).end('{}');return;}
        }
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
    await new Promise<void>((resolve, reject) => { bridge.once('error', reject); bridge.listen(0, '127.0.0.1', resolve); });
    const bridgePort = (bridge.address() as { port: number }).port;
    const plugin = fileURLToPath(new URL('./dsh-bridge.mjs', import.meta.url));
    const disabled = ['persistent-bash','persistent-pwsh','tool-fs','tool-working-directory','session-log-deepseek','plugin-package-inventory-deepseek','terminal-bash','terminal-pwsh','pty'];
    const patches: unknown[] = disabled.map(id => ({ id, disabled: true }));
    patches.push({ id: 'sandbox-policy', config: { mode: 'read-only' } });
    if (input.model.provider === 'openai') {
      patches.push({ id: 'llm-deepseek', disabled: true });
      patches.push({ insert: [{ id: 'llm-bff', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: { bff: { api: 'openai-completions', ...(input.model.reasoningEffort ? { reasoning: adapterEffort(input.model.reasoningEffort) } : {}), baseURL: `http://127.0.0.1:${bridgePort}/model`, apiKeyEnv: 'BFF_MODEL_API_KEY', models: [{ id: input.model.model, ...openAIModelOptions(input.model), input: ['text','image'] }], timeoutMs: MODEL_REQUEST_TIMEOUT_MS, streamIdleTimeoutMs: MODEL_REQUEST_TIMEOUT_MS, retryPolicy: { mode: 'normal', maxRetries: 0 } } } } }] });
    } else patches.push({ id: 'llm-deepseek', config: { ...(input.model.reasoningEffort ? { reasoningEffort: adapterEffort(input.model.reasoningEffort) } : {}), baseURL: input.model.baseURL, apiKeyEnv: 'BFF_MODEL_API_KEY', streamIdleTimeoutMs: MODEL_REQUEST_TIMEOUT_MS } });
    patches.push({ insert: [{ id: 'bff-bridge', name: plugin }] });
    privateFile(profile); writeFileSync(profile, JSON.stringify(patches));
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH','SystemRoot','WINDIR','TEMP','TMP','TMPDIR','LANG']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { BFF_TOOLS:JSON.stringify((input.tools??[]).map(({name,description,parameters,resultKind})=>({name,description,parameters,resultKind}))), BFF_SESSION:input.sessionId, BFF_MODEL_API_KEY: input.model.provider === 'openai' ? token : (input.key || 'local-no-key'), BFF_BRIDGE_TOKEN: token, BFF_BRIDGE_URL: `http://127.0.0.1:${bridgePort}`, DSH_SYSTEM_PROMPT: buildPersonaPrompt(input.persona, input.interaction, input.context) });
    harness = new DeepSeekHarness({ profile: 'sdk-minimal', patches: [profile], dshHome: home, cwd: join(home,'workspace'), processCwd: join(home,'workspace'), env, provider: input.model.provider === 'deepseek' ? 'deepseek-official' : 'bff', model: input.model.model, initializeTimeoutMs: 20000, shutdownTimeoutMs: 1000, disposeEofGraceMs: 1000, disposeGraceMs: 1000 });
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
      if (reason && !['completed','complete','success','stop'].includes(reason)) throw modelError?new InputError(modelError):new Error('MODEL_RUN_FAILED');
      if (!result.finalResponse) throw modelError?new InputError(modelError):new Error('EMPTY_MODEL_RESPONSE');
      resultText = result.finalResponse;
    } catch (error) {
      // SDK errors may embed provider response bodies or keys. Never expose them.
      runError = input.signal.aborted ? new Error('CANCELLED', { cause: error })
        : modelError ? new InputError(modelError) : error instanceof Error && ['EMPTY_MODEL_RESPONSE','MODEL_RUN_FAILED'].includes(error.message) ? error
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
      for(const {tool,value,presented} of imageResults.values())if(!presented)await cleanup(()=>{tool.onImageResult?.(value,false);input.onTool?.({name:tool.name,state:'failed'});});
      imageResults.clear();
      await cleanup(() => rmSync(profile, { force: true }));
    }
    if (cleanupErrors.length) throw new AggregateError([...(runError ? [runError] : []), ...cleanupErrors], 'ENGINE_CLEANUP_FAILED');
    if (runError) throw runError;
    return resultText;
  }
}
