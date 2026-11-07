import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Personality } from '../../apps/desktop/src/features/fish/Personality';
import { Media } from '../../apps/desktop/src/features/settings/Media';
import { Plugins } from '../../apps/desktop/src/features/settings/Plugins';
import { Setup, Backup } from '../../apps/desktop/src/features/settings/Setup';
import { Bilibili } from '../../apps/desktop/src/features/connections/Bilibili';
import { Douyin } from '../../apps/desktop/src/features/connections/Douyin';
import { Home, Life } from '../../apps/desktop/src/features/fish/Life';
import '../../apps/desktop/src/styles/style.css';
function Fixture() {
  const [error, fail] = useState<unknown>();
  const [models, showModels] = useState(false);
  return <main className="app-workspace"><div className="content-page">
    {error ? <p role="alert">{String(error)}</p> : null}
    {location.search.includes('life') ? <Life fail={fail}/> : location.search.includes('bili') ? <Bilibili fail={fail} /> : location.search.includes('douyin') ? <Douyin fail={fail} /> : location.search.includes('home') ? <Home /> : location.search.includes('plugins') ? <Plugins fail={fail} /> : location.search.includes('media') ? models ? <h2>模型设置</h2> : <Media fail={fail} configureModel={() => showModels(true)} /> : location.search.includes('backup') ? <Backup fail={fail} /> : location.search.includes('setup') ? <Setup fail={fail} done={() => {}} /> : <Personality fail={fail} />}
  </div></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
