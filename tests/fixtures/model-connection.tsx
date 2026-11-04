import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Models } from '../../apps/desktop/src/components/Models';
import { api, errorText } from '../../apps/desktop/src/api';
import type { ModelConfig } from '../../apps/runtime/src/ai/types';
import '../../apps/desktop/src/style.css';
function Fixture() {
  const [models, setModels] = useState<(ModelConfig & { hasKey: boolean })[]>([]), [error, setError] = useState('');
  return <div className="app-shell"><div className="app-workspace"><header className="workspace-header"><h1 className="page-title">设置</h1></header><main className="workspace-main"><div className="content-page settings-page">
    {error && <p role="alert">{error}</p>}
    <Models models={models} reload={async () => setModels(await api('/v1/models'))} fail={error => setError(errorText(error))} />
  </div></main></div></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
