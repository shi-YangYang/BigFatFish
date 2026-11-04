import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { errorText } from '../api';
import { Alert } from './Surfaces';
import { Button } from './Controls';
type Notice = { id: number; text: string };
let items: Notice[] = [], sequence = 0;
const listeners = new Set<() => void>();
const publish = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function notifyMessage(text: string) {
  if (items.some(item => item.text === text)) return;
  items = [...items.slice(-2), { id: ++sequence, text }]; publish();
}
export const notifyError = (error: unknown) => notifyMessage(errorText(error));
export function dismissError(error: unknown) { const text = errorText(error); items = items.filter(item => item.text !== text); publish(); }
export function clearNotifications() { items = []; publish(); }
function dismiss(id: number) { items = items.filter(item => item.id !== id); publish(); }
function Notification({ item }: { item: Notice }) {
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false), remaining = useRef(5000);
  useEffect(() => {
    if (hover || focus) return;
    const started = Date.now(), timer = setTimeout(() => dismiss(item.id), remaining.current);
    return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - started)); };
  }, [hover, focus, item.id]);
  return <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocusCapture={() => setFocus(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}>
    <Alert className="notification"><span>{item.text}</span><Button variant="ghost" size="compact" aria-label="关闭提示" onClick={() => dismiss(item.id)}>关闭</Button></Alert>
  </div>;
}
export function Notifications() {
  const notices = useSyncExternalStore(subscribe, () => items);
  return createPortal(<div className="notification-region" aria-label="操作提示">{notices.map(item => <Notification item={item} key={item.id} />)}</div>, document.body);
}
