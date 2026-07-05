/**
 * Side-panel React entry point. Mounts <App/> into #root and pulls in the global
 * stylesheet. Store bootstrapping (broadcast subscription + initial state fetch)
 * happens inside App's mount effect via the zustand store's idempotent `init()`.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
