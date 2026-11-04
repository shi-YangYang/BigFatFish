import { useRef, useState } from 'react';
import type { ModelConfig } from '../../../runtime/src/ai/types';
import type { ModelDiscovery, ModelTestResult } from '../../../runtime/src/ai/model-connection';
import { api, errorText } from '../api';
type Action = 'discover' | 'test';
interface Result { stamp: string; kind: Action; message: string; error?: boolean }
export function useModelConnection(form: ModelConfig, key: string) {
  const connectionStamp = JSON.stringify([form.id, form.provider, form.baseURL, key]);
  const testStamp = JSON.stringify([form, key]);
  const sequence = useRef(0);
  const [pending, setPending] = useState<{ stamp: string; kind: Action }>();
  const [result, setResult] = useState<Result>();
  const [list, setList] = useState<{ stamp: string; data: ModelDiscovery['models'] }>();
  const stampFor = (kind: Action) => kind === 'discover' ? connectionStamp : testStamp;
  async function run(kind: Action) {
    const seq = ++sequence.current, stamp = stampFor(kind);
    setPending({ stamp, kind }); setResult(undefined);
    const body = { ...form, ...(key ? { apiKey: key } : {}) };
    try {
      if (kind === 'discover') {
        const value = await api<ModelDiscovery>('/v1/models/discover', 'POST', body);
        if (seq !== sequence.current) return;
        setList({ stamp, data: value.models });
        setResult({ stamp, kind, message: value.models.length ? `获取到 ${value.models.length} 个模型` : '服务未返回可用模型，可手动填写模型名称。' });
      } else {
        const value = await api<ModelTestResult>('/v1/models/test', 'POST', body);
        if (seq === sequence.current) setResult({ stamp, kind, message: `连接成功，模型已响应 · ${value.elapsedMs} 毫秒` });
      }
    } catch (error) {
      if (seq !== sequence.current) return;
      if (kind === 'discover') setList(undefined);
      setResult({ stamp, kind, error: true, message: errorText(error) });
    } finally { if (seq === sequence.current) setPending(undefined); }
  }
  return {
    run,
    pending: pending && pending.stamp === stampFor(pending.kind) ? pending.kind : undefined,
    result: result && result.stamp === stampFor(result.kind) ? result : undefined,
    models: list?.stamp === connectionStamp ? list.data : [],
  };
}
