import type { QQMessageIssue } from "../../../../../runtime/src/channels/types";
import { ContentScroll, Card, Alert, Loading } from "../../../components/Surfaces";
import { Button } from "../../../components/Controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";

const issueLabels: Record<QQMessageIssue["kind"], string> = {
  reply_failed: "回复生成失败",
  send_failed: "消息发送失败",
  partial: "部分消息已发送，请到 QQ 核对",
  partial_unknown: "部分消息已发送，其余请到 QQ 核对",
  unknown: "未能确认是否送达，请到 QQ 核对",
  offline: "QQ 已离线，消息未发送",
  queue_full: "等待回复的消息过多，本条未回复",
};

export function QQMessages() {
  const [issues, setIssues] = useState<QQMessageIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const alive = useRef(true), sequence = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++sequence.current;
    try {
      const records = await api<QQMessageIssue[]>("/v1/channels/qq/message-issues");
      if (!alive.current || n !== sequence.current) return;
      setIssues(records);
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
      {issues.length > 0 && <ContentScroll label="操作记录" className="operation-record-list">
        {issues.map(issue => (
          <div key={issue.id} className="operation-record">
            <div className="operation-record-heading">
              <span>{issueLabels[issue.kind]}</span>
              {issue.target && <span className="operation-record-status">{issue.target.kind === "group" ? "群聊" : "私聊"} · {issue.target.id}</span>}
            </div>
            <time dateTime={issue.at}>{new Date(issue.at).toLocaleString()}</time>
          </div>
        ))}
      </ContentScroll>}
      {!loading && !historyError && !issues.length && <p className="muted">暂无需要处理的问题</p>}
      {issues.length === 20 && <p className="muted">仅显示最近 20 条异常记录</p>}
    </Card>
  );
}
