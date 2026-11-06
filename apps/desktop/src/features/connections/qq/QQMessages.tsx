import { qqAuditText } from "./qq-feedback";
import { ContentScroll, Card, Alert, Loading } from "../../../components/Surfaces";
import { Button } from "../../../components/Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";

export function QQMessages() {
  const [audit, setAudit] = useState<{ event: string; at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const alive = useRef(true), sequence = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++sequence.current;
    try {
      const records = await api<{ event: string; at: string }[]>("/v1/channels/qq/audit");
      if (!alive.current || n !== sequence.current) return;
      setAudit(records);
      setHistoryError(false);
    } catch {
      if (alive.current && n === sequence.current) setHistoryError(true);
    } finally {
      if (alive.current && n === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    let active = true, timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      await refresh();
      if (active) timer = setTimeout(() => void poll(), 3000);
    };
    void poll();
    return () => {
      active = false;
      alive.current = false;
      ++sequence.current;
      clearTimeout(timer);
    };
  }, [refresh]);

  return (
    <Card>
      <h3>操作记录</h3>
      {historyError && (
        <Alert>
          暂时无法更新操作记录
          <Button size="compact" onClick={() => void refresh()}>刷新</Button>
        </Alert>
      )}
      {loading && <Loading />}
      <ContentScroll label="操作记录" className="qq-history">
        {audit.map((item, index) => (
          <div key={index}>
            <span>{qqAuditText(item.event)}</span>
            <time>{new Date(item.at).toLocaleString()}</time>
          </div>
        ))}
      </ContentScroll>
      {!loading && !historyError && !audit.length && <p className="muted">暂无操作记录</p>}
    </Card>
  );
}
