import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chat } from '../../../apps/desktop/src/features/chat/Chat';
import { MyFish } from "../../../apps/desktop/src/features/fish/MyFish";
import type { PlanIntent } from "../../../apps/desktop/src/features/fish/activities/Activities";
import { Memories } from '../../../apps/desktop/src/features/fish/memory/Memories';
import { BounceSidebar } from '../../../apps/desktop/src/components/beui/bounce-sidebar';
import { Badge, Menu } from '../../../apps/desktop/src/components/Surfaces';
import { Button, Checkbox } from '../../../apps/desktop/src/components/Controls';
import { Activities } from '../../../apps/desktop/src/features/fish/activities/Activities';
import { Tabs } from '../../../apps/desktop/src/components/UI';
import '../../../apps/desktop/src/styles/style.css';
function Fixture() {
  const [tab, setTab] = useState('聊天'), [error, setError] = useState('');
  const fail = useCallback((error: unknown) => setError(String(error)), []);
  return <div className="content-page">
    {error && <p role="alert">{error}</p>}
    <BounceSidebar className="primary-nav" value={tab} onValueChange={setTab} items={[{ id: '聊天', label: '聊天导航' }, { id: '记忆', label: '记忆导航' }]} indicatorClassName="hidden" />
    <div className="sidebar-bottom"><button className={tab === '设置' ? 'active' : ''} onClick={() => setTab('设置')}>设置样例</button></div>
    <Badge data-testid="current-status">{tab}</Badge>
    <Tabs items={['聊天', '记忆']} value={tab} onChange={setTab} label="检查页面">
      {tab === '聊天' ? <Chat models={[{ id: 'fixture', label: 'Fixture', model: 'fixture', provider: 'openai', baseURL: 'https://example.invalid/v1' }]} fail={fail} configureModel={() => {}} renderHeader={content => <header>{content}</header>} /> : <Memories fail={fail} />}
    </Tabs>
  </div>;
}
function StateFixture() {
  const [selection, setSelection] = useState<'off' | 'on' | 'mixed'>('off');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const fail = useCallback((error: unknown) => setError(String(error)), []);
  return <div className="content-page">
    {error && <p role="alert">{error}</p>}
    <Checkbox label="动态选择" checked={selection === 'on'} indeterminate={selection === 'mixed'} onCheckedChange={checked => setSelection(checked ? 'on' : 'off')} />
    <Checkbox label="已选样例" checked onCheckedChange={() => {}} disabled />
    {(['off', 'on', 'mixed'] as const).map(state => <button key={state} onClick={() => setTimeout(() => setSelection(state), 0)}>{state}</button>)}
    <Menu open={menuOpen} onOpenChange={setMenuOpen} trigger={<Button>菜单样例</Button>}>
      <Button>操作样例</Button>
    </Menu>
    <Activities fail={fail} />
  </div>;
}
function FishFixture() {
  const [intent, setIntent] = useState<PlanIntent>();
  const [sequence, setSequence] = useState(0);
  const [chat, setChat] = useState(false);
  const [error, setError] = useState("");
  return <main className="content-page">
    {(["bilibili", "douyin"] as const).map(platform => <button key={platform} onClick={() => {
      setSequence(sequence + 1); setIntent({ id: sequence + 1, platform });
    }}>从{platform}创建计划</button>)}
    {chat ? <h1>回到聊天</h1> : <MyFish onChat={() => setChat(true)} fail={e => setError(String(e))}
      planIntent={intent} onPlanHandled={id => setIntent(current => current?.id === id ? undefined : current)} />}
    {error && <p role="alert">{error}</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('states') ? <StateFixture /> : new URLSearchParams(location.search).has('fish') ? <FishFixture /> : <Fixture />);
