/**
 * Side-panel React entry point. Mounts <App/> into #root and pulls in the global
 * stylesheet. Store bootstrapping (broadcast subscription + initial state fetch)
 * happens inside App's mount effect via the zustand store's idempotent `init()`.
 * An error boundary wraps the app so an unexpected render crash shows a
 * readable message with a reload button instead of a blank panel.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

interface BoundaryState {
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app__crash" role="alert">
        <p className="app__crash-title">Something went wrong.</p>
        <p className="app__crash-detail">{this.state.error.message}</p>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => location.reload()}
        >
          Reload panel
        </button>
      </div>
    );
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
