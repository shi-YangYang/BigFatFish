import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Models } from '../../apps/desktop/src/features/settings/Models';
import { api } from "../../apps/desktop/src/api/client";
import { errorText } from "../../apps/desktop/src/api/errors";
import type { ModelConfig } from '../../apps/runtime/src/ai/types';
import '../../apps/desktop/src/styles/style.css';
function Fixture() {
  const [models, setModels] = useState<(ModelConfig & { hasKey: boolean })[]>([]), [error, setError] = useState('');
  return <div className="app-shell"><div className="app-workspace"><header className="workspace-header"><h1 className="page-title">设置</h1></header><main className="workspace-main"><div className="content-page settings-page">
    {error && <p role="alert">{error}</p>}
    <Models models={models} reload={async () => setModels(await api('/v1/models'))} fail={error => setError(errorText(error))} />
  </div></main></div></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
