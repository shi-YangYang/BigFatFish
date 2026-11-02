import { useState } from 'react';
import type { ModelConfig } from '../../../runtime/src/ai/types';
import { api } from '../api';
type PublicModel = ModelConfig & { hasKey: boolean };
const blank: ModelConfig = { id:'', label:'', provider:'openai', baseURL:'', model:'', contextWindow:32768, maxTokens:4096, timeoutMs:120000, vision:false };
export function Models({ models, reload, fail }: { models: PublicModel[]; reload: () => Promise<void>; fail: (e: unknown) => void }) {
  const [form,setForm] = useState(blank), [key,setKey] = useState(''), [busy,setBusy] = useState(false), [saved,setSaved] = useState('');
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setSaved(''); try { await api('/v1/models','POST',{...form,...(key ? {apiKey:key}: {})}); const routes = await api<Record<string,string>>('/v1/model-routes'); if (!routes.chat) await api('/v1/model-routes','PUT',{...routes,chat:form.id}); setKey(''); await reload(); setSaved('已保存'); } catch(e) { fail(e); } finally {setBusy(false);} }
  return <section><h2>模型</h2><div className="model-list">{models.map(model=><div key={model.id}><button onClick={()=>{setForm(model);setKey('');setSaved('');}}>{model.label}</button><span>{model.hasKey?'密钥已设置':'未设置密钥'}</span><button onClick={()=>void api('/v1/models/'+model.id,'DELETE').then(reload).catch(fail)}>删除</button><button onClick={()=>void api<Record<string,string>>('/v1/model-routes').then(routes=>api('/v1/model-routes','PUT',{...routes,chat:model.id})).then(()=>setSaved('已设为默认聊天模型')).catch(fail)}>设为默认</button></div>)}</div>
  <form onSubmit={save} className="settings"><button type="button" onClick={()=>{setForm(blank);setKey('');}}>新建配置</button>
    {(['id','label','baseURL','model'] as const).map((field,i)=><label key={field}>{['配置标识','显示名称','服务地址','模型名称'][i]}<input required value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/></label>)}
    <label>提供商<select value={form.provider} onChange={e=>setForm({...form,provider:e.target.value as ModelConfig['provider'],baseURL:e.target.value==='deepseek'?'https://api.deepseek.com/anthropic':form.baseURL})}><option value="openai">OpenAI 兼容 / 本地模型</option><option value="deepseek">DeepSeek</option></select></label>
    <label>API Key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="留空保留已有密钥"/></label>
    {(['contextWindow','maxTokens','timeoutMs'] as const).map((field,i)=><label key={field}>{['上下文容量','单次输出上限','超时（毫秒）'][i]}<input required type="number" value={form[field]} onChange={e=>setForm({...form,[field]:Number(e.target.value)})}/></label>)}
    <label className="check"><input type="checkbox" checked={form.vision} onChange={e=>setForm({...form,vision:e.target.checked})}/>模型支持图片</label><button disabled={busy}>保存模型</button><span role="status">{saved}</span>
  </form></section>;
}
