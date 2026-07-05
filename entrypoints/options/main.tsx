/**
 * Options page bootstrap: mounts the React <App/> into #root.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../sidepanel/styles.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('[options] #root element not found');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
