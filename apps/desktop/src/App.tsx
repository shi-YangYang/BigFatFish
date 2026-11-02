import { useCallback, useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { RuntimeStatus } from '../../runtime/src/connection';
const errors: Record<string, string> = {
  NOT_RUNNING: '服务尚未启动', INVALID_CONNECTION: '连接信息无效，请重新启动服务',
  INSECURE_CONNECTION: '连接文件权限不安全', UNAUTHORIZED: '连接凭据已失效，请刷新重试',
  UNAVAILABLE: '暂时无法连接服务，请检查服务是否仍在运行',
  DESKTOP_REQUIRED: '请打开桌面应用查看服务状态',
};
export function App() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isTauri()) throw new Error('DESKTOP_REQUIRED');
      const result = await invoke<RuntimeStatus>('runtime_status');
      setStatus(result); setError(null);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : String(reason);
      setStatus(null); setError(errors[code] ?? errors.UNAVAILABLE!);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 5000); return () => clearInterval(timer); }, [refresh]);
  return <main>
    <header><span className="brand">BigFatFish</span><span className="tag">大肥鱼</span></header>
    <section className="panel" aria-labelledby="title">
      <div className="fish" aria-hidden="true">🐟</div>
      <h1 id="title">服务状态</h1>
      <p className={status ? 'state online' : 'state'} role="status">{status ? '已连接' : error ?? '正在连接…'}</p>
      {status && <dl><div><dt>运行时间</dt><dd>{Math.floor(status.uptimeSeconds / 60)} 分钟</dd></div><div><dt>启动于</dt><dd>{new Date(status.startedAt).toLocaleString('zh-CN')}</dd></div></dl>}
      <button onClick={() => void refresh()} disabled={loading}>{loading ? '连接中…' : '刷新状态'}</button>
    </section>
    <footer>关闭窗口后，已启动的服务会继续运行。</footer>
  </main>;
}
