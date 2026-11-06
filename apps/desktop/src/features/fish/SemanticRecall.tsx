import { useEffect, useRef, useState } from "react";
import { loadRecall, setRecallEnabled, type RecallStatus } from "../../api/memory-recall";
import { Button } from "../../components/Controls";
import { Card } from "../../components/Surfaces";

function caption(status: RecallStatus) {
  if (status.state === "failed") return "模型准备失败，可重新下载";
  if (status.state === "downloading") {
    const { downloadedBytes, totalBytes } = status;
    if (downloadedBytes && totalBytes && downloadedBytes < totalBytes) {
      return `正在下载 · ${Math.floor(100 * downloadedBytes / totalBytes)}%`;
    }
    return "正在准备模型…";
  }
  if (status.state === "ready") {
    if (status.failed) return "索引暂时不可用，仍可按关键词回忆";
    return status.indexing ? "正在整理已有记忆…" : "已启用";
  }
  return "模型约 24 MB，首次启用时下载";
}

export function SemanticRecall({ fail }: { fail: (error: unknown) => void }) {
  const [status, setStatus] = useState<RecallStatus>();
  const [readFailed, setReadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, reload] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const observed = version.current;
    async function refresh() {
      try {
        const next = await loadRecall();
        if (!active || observed !== version.current) return;
        setStatus(next);
        setReadFailed(false);
        if (next.state === "downloading" || next.indexing) timer = setTimeout(refresh, 1000);
      } catch {
        if (active && observed === version.current) setReadFailed(true);
      }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [revision]);

  async function toggle() {
    if (!status || busy) return;
    version.current++;
    setBusy(true);
    try {
      const next = await setRecallEnabled(status.state === "off" || status.state === "failed");
      setStatus(next);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
      reload(v => v + 1);
    }
  }

  const action = status?.state === "ready" ? "停用" : status?.state === "downloading" ? "取消" : status?.state === "failed" ? "重试" : "启用";
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="summary-entry">
        <strong>按语义回忆</strong>
        <span className="muted" role="status">{readFailed ? "暂时无法读取状态" : status ? caption(status) : "正在读取…"}</span>
      </div>
      {readFailed
        ? <Button size="compact" onClick={() => reload(v => v + 1)}>刷新状态</Button>
        : <Button size="compact" disabled={!status || busy} onClick={() => void toggle()}>{action}</Button>}
    </div>
  </Card>;
}
