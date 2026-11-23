import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/style.css';

const root = createRoot(document.getElementById('root')!);
function renderDesktop() {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
if ("__TAURI_INTERNALS__" in window) {
  renderDesktop();
} else if (import.meta.env.DEV) {
  void import('./dev-preview').then(({ installPreview }) => { installPreview(); renderDesktop(); });
} else {
  root.render(<p>请在大肥鱼桌面应用中打开。</p>);
}
