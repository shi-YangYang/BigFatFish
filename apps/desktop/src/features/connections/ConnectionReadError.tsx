import { Alert } from '../../components/Surfaces';
import { Button } from '../../components/Controls';
import { useState } from 'react';

export function ConnectionReadError({ retry }: { retry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <Alert>暂时无法读取连接状态。<Button size="compact" busy={busy} onClick={() => { setBusy(true); void retry().finally(() => setBusy(false)); }}>重试</Button></Alert>;
}
