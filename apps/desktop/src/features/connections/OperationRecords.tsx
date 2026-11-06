import type { ReactNode } from "react";
import { ActionRow } from "../../components/Controls";
import { Alert, Card, ContentScroll, Loading } from "../../components/Surfaces";

export interface OperationRecord {
  id: string;
  action: string;
  title?: string;
  status: string;
  createdAt: string;
  error?: string;
  actions?: ReactNode;
}

export function OperationRecords({ records, error, children }: {
  records?: OperationRecord[];
  error?: string;
  children?: ReactNode;
}) {
  return <Card className="operation-records">
    <h3>操作记录</h3>
    {children}
    {error && <Alert role="alert">操作记录读取失败：{error}</Alert>}
    {!records && !error && <Loading/>}
    {records?.length === 0 && !error && <p className="muted">暂无操作记录</p>}
    {!!records?.length && <ContentScroll label="操作记录" className="operation-record-list">
      {records.map(record => <div className="operation-record" key={record.id}>
        <div className="operation-record-heading">
          <span>{record.action}{record.title && <> · {record.title}</>}</span>
          <span className="operation-record-status">{record.status}</span>
        </div>
        <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>
        {record.error && <p className="operation-record-error">{record.error}</p>}
        {record.actions && <ActionRow>{record.actions}</ActionRow>}
      </div>)}
    </ContentScroll>}
  </Card>;
}
