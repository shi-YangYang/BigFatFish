import { Badge } from '../../components/Surfaces';
import { Loader } from '../../components/beui/loader';
import { connectionTone } from './connection-status';

export function ConnectionStatus({ label, className }: { label: string; className?: string }) {
  const busy = /^(正在|连接中)/.test(label) || ['等待手机确认', '等待验证'].includes(label);
  return <Badge className={className} status={connectionTone(label)} showIcon={busy}
    icon={<Loader size={14} label="" />}>{label}</Badge>;
}
