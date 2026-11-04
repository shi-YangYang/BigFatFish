/* global fetch, AbortSignal */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { createServer } from 'node:http';
export const inject = ['agents', 'tools'];
export async function apply(ctx) {
  const token = process.env.BFF_BRIDGE_TOKEN, target = process.env.BFF_BRIDGE_URL;
  let pending = Promise.resolve();
  function send(value) {
    pending = pending.then(async () => {
      const response = await fetch(target, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(value), signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok) throw new Error('BRIDGE_REJECTED');
    });
    // A broken observer must stop the owned turn instead of silently losing events.
    pending.catch(() => { for (const agent of ctx.agents.list()) agent.cancel({ kind: 'user' }); });
  }
  // Fixed SDK compatibility: resumed pre-Spec019 headers carry an explicit cap.
  // Public waterfall clears only that override; adapter defaults remain logged.
  ctx.on('agent/request', async (_event, next) => { const config = { ...await next() }; delete config.maxTokens; return config; });
  const tools=JSON.parse(process.env.BFF_TOOLS||'[]');
  ctx.tools.guard(exec => tools.some(t=>t.name===exec.name) ? undefined : 'denied');
  function fields(schema){return Object.fromEntries(Object.entries(schema.properties??{}).map(([name,value])=>[name,{...node(value),...(schema.required?.includes(name)?{required:true}:{})}]));}function node(schema){const value={...schema};if(schema.type==='object'){delete value.required;value.properties=fields(schema);value.additionalProperties=false;}if(schema.type==='array')value.items=node(schema.items);return value;}
  for(const tool of tools){const parameters=fields(tool.parameters);
   ctx.tools.register(defineTool({name:tool.name,description:tool.description,parameters,output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},async execute(args,exec){
    const response=await fetch(target,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({tool:tool.name,args,sessionId:process.env.BFF_SESSION}),signal:exec.signal,redirect:'error'});if(!response.ok)throw new Error('TOOL_DENIED');return JSON.stringify((await response.json()).result);
   }}));
  }
  ctx.on('agent/assistant-stream', ({ agent, frame }) => send({ sessionId: agent.session.id, frame }));
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}` || req.headers.origin || req.method !== 'POST') { res.writeHead(403).end(); return; }
    if (req.url === '/flush') { try { await pending; res.end('{}'); } catch { res.writeHead(500).end(); } return; }
    const id = req.url?.slice(1), agent = ctx.agents.get(id);
    if (!agent) { res.writeHead(404).end(); return; }
    try { agent.cancel({ kind: 'user' }); await agent.whenIdle(); await pending; res.end('{}'); }
    catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  ctx.on('dispose', () => { server.close(); server.closeAllConnections(); });
  send({ ready: true, port: server.address().port });
}
