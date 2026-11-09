import {connectionReadMessage} from '../connection-errors';
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
  const [actions,setActions]=useState<{id:string;kind:string;status:string;at:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string[]>([]);
  const [refreshing,setRefreshing]=useState(false);
  const alive = useRef(true), pending=useRef(false);
  const refresh = useCallback(async (manual=false) => {
    if(manual)setRefreshing(true);
    if(pending.current)return;pending.current=true;
    try {
      const [records,operations] = await Promise.allSettled([api<QQMessageIssue[]>("/v1/channels/qq/message-issues"),api<{id:string;kind:string;status:string;at:string}[]>("/v1/channels/qq/action-issues")]);
      if (!alive.current) return;
      if(records.status==='fulfilled')setIssues(records.value);
      if(operations.status==='fulfilled')setActions(operations.value);
      setHistoryError([...new Set([records,operations].flatMap(result=>result.status==='rejected'?[connectionReadMessage(result.reason,'部分记录暂时无法更新，请重试。')]:[]))]);
    } finally {
      pending.current=false;
      if (alive.current){setLoading(false);setRefreshing(false);}
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

      clearTimeout(timer);
    };
  }, [refresh]);

  const rows=[...issues.map(issue=>({id:String(issue.id),at:issue.at,label:issueLabels[issue.kind],target:issue.target})),...actions.map(a=>({id:a.id,at:a.at,label:({post:"说说发布",profile:"资料更新",avatar:"头像更新",space_profile:"空间资料更新",recall:"消息撤回",group_card:"群名片更新",like:"名片点赞",reaction:"表情回应"}[a.kind]??"QQ操作")+(a.status==='unknown'?"结果待核实":"未完成"),target:undefined}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,20);
  return (
    <Card>
      <h3>操作记录</h3>
      {historyError.length>0 && (
        <Alert>
          {historyError.join(" ")}
          <Button size="compact" busy={refreshing} onClick={() => void refresh(true)}>重试</Button>
        </Alert>
      )}
      {loading && <Loading />}
      {rows.length > 0 && <ContentScroll label="操作记录" className="operation-record-list">
        {rows.map(issue => (
          <div key={issue.id} className="operation-record">
            <div className="operation-record-heading">
              <span>{issue.label}</span>
              {issue.target && <span className="operation-record-status">{issue.target.kind === "group" ? "群聊" : "私聊"} · {issue.target.id}</span>}
            </div>
            <time dateTime={issue.at}>{new Date(issue.at).toLocaleString()}</time>
          </div>
        ))}
      </ContentScroll>}
      {!loading && !historyError.length && !rows.length && <p className="muted">暂无需要处理的问题</p>}
      {rows.length === 20 && <p className="muted">仅显示最近 20 条异常记录</p>}
    </Card>
  );
}
