import { Alert } from '../../components/Surfaces';
import { Button } from '../../components/Controls';

export function ConnectionReadError({ retry }: { retry: () => Promise<void> }) {
  return <Alert>暂时无法读取连接状态。<Button size="compact" onClick={() => void retry()}>重试</Button></Alert>;
}
