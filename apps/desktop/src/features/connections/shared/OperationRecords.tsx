import type { ReactNode } from "react";
import { ActionRow } from "../../../components/Controls";
import { EmptyState, SectionCard } from "../../../components/PageLayout";
import { Alert, ContentScroll, Loading } from "../../../components/Surfaces";

export interface OperationRecord {
  id: string;
  action: string;
  title?: string;
  status?: string;
  createdAt: string;
  error?: string;
  actions?: ReactNode;
}

export function RecordList({ records }: { records: OperationRecord[] }) {
  return <ContentScroll label="操作记录" className="operation-record-list">
    {records.map(record => <div className="operation-record" key={record.id}>
      <div className="operation-record-heading">
        <span className="channel-record-title">{record.action}</span>
        {record.status && <span className="operation-record-status">{record.status}</span>}
      </div>
      {record.title && <span className="channel-record-body">{record.title}</span>}
      <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>
      {record.error && <p className="operation-record-error">{record.error}</p>}
      {record.actions && <ActionRow>{record.actions}</ActionRow>}
    </div>)}
  </ContentScroll>;
}

export function OperationRecords({ records, error, children, empty = "暂无操作记录", footer }: {
  records?: OperationRecord[];
  error?: ReactNode;
  children?: ReactNode;
  empty?: string;
  footer?: ReactNode;
}) {
  return <SectionCard className="operation-records channel-records" level={3} title="操作记录">
    {children}
    {typeof error === "string" ? error && <Alert role="alert">操作记录读取失败：{error}</Alert> : error}
    {!records && !error && <Loading/>}
    {records?.length === 0 && !error && <EmptyState title={empty}/>}
    {!!records?.length && <RecordList records={records}/>}
    {footer}
  </SectionCard>;
}
