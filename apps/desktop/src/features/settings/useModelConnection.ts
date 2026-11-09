import { dismissError } from '../../components/Notifications';
import { useEffect, useRef, useState } from 'react';
import type { ModelConfig } from '../../../../runtime/src/ai/types';
import type { ModelDiscovery, ModelTestResult } from '../../../../runtime/src/ai/model-connection';
import { api } from "../../api/client";
type Action = 'discover' | 'test';
interface Result { stamp: string; kind: Action; message: string; error?: boolean }
export function useModelConnection(form: ModelConfig, key: string, fail: (error: unknown) => void, purpose = 'chat') {
  const connectionStamp = JSON.stringify([form.id, form.provider, form.baseURL, key, purpose]);
  const testStamp = JSON.stringify([form, key, purpose]);
  const sequence = useRef(0), lastError = useRef<unknown>(undefined);
  const clearError = () => { if (lastError.current !== undefined) { dismissError(lastError.current); lastError.current = undefined; } };
  useEffect(() => { clearError(); return clearError; }, [connectionStamp, testStamp]);
  useEffect(() => () => { sequence.current++; }, []);
  const stamps = useRef({ discover: connectionStamp, test: testStamp });
  stamps.current = { discover: connectionStamp, test: testStamp };
  const [pending, setPending] = useState<{ stamp: string; kind: Action }>();
  const [result, setResult] = useState<Result>();
  const [list, setList] = useState<{ stamp: string; data: ModelDiscovery['models'] }>();
  const stampFor = (kind: Action) => kind === 'discover' ? connectionStamp : testStamp;
  async function run(kind: Action) {
    clearError();
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
      if (seq !== sequence.current || stamps.current[kind] !== stamp) return;
      if (kind === 'discover') setList(undefined);
      setResult(undefined); lastError.current = error; fail(error);
    } finally { if (seq === sequence.current) setPending(undefined); }
  }
  return {
    run,
    pending: pending && pending.stamp === stampFor(pending.kind) ? pending.kind : undefined,
    result: result && result.stamp === stampFor(result.kind) ? result : undefined,
    models: list?.stamp === connectionStamp ? list.data : [],
  };
}
