import React from 'react';
import { Settings, X } from 'lucide-react';
import { GitHubIcon } from '@/lib/ui/GitHubIcon';
import { useSidepanel } from './store';
import { usePanelView } from './usePanelView';
import { RecordButton } from './components/RecordButton';
import { RecordingControls } from './components/RecordingControls';
import { CaptureBar } from './components/CaptureBar';
import { Timeline } from './components/Timeline';
import { SessionList } from './components/SessionList';

export function App(): React.JSX.Element {
  const {
    ready,
    error,
    dismissError,
    openSettings,
    live,
    openReport,
  } = usePanelView();
  return (
    <div className="app">
      <div className="app__actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Settings"
          onClick={openSettings}
        >
          <Settings size={16} />
        </button>
      </div>
      {error && (
        <div className="app__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
      <main className="app__body">
        {!ready ? (
          <p className="app__loading">Loading…</p>
        ) : live ? (
          <div className="view view--recording">
            <RecordingControls />
            <TabChips />
            <Timeline />
            <CaptureBar />
          </div>
        ) : (
          <div className="view view--idle">
            <RecordButton />
            <SessionList onOpen={openReport} />
            <IdleFooter />
          </div>
        )}
      </main>
    </div>
  );
}

function IdleFooter(): React.JSX.Element {
  const repository = 'https://github.com/mohsen1/session-recorder-chrome-extension';
  return (
    <footer className="idle-foot">
      <a href={repository} target="_blank" rel="noreferrer">
        <GitHubIcon size={13} /> GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a href="https://azimi.me/session-recorder-chrome-extension/" target="_blank" rel="noreferrer">
        Website
      </a>
      <span aria-hidden="true">·</span>
      <a href={`${repository}/issues/new`} target="_blank" rel="noreferrer">
        Feedback
      </a>
    </footer>
  );
}

function TabChips(): React.JSX.Element | null {
  const attachedTabIds = useSidepanel((s) => s.attachedTabIds);
  const session = useSidepanel((s) => s.session);
  if (attachedTabIds.length === 0) return null;

  const titleFor = (tabId: number): string => {
    const info = session?.tabs.find((t) => t.tabId === tabId);
    if (!info) return `Tab ${tabId}`;
    if (info.title) return info.title;
    try {
      return new URL(info.url).host || `Tab ${tabId}`;
    } catch {
      return `Tab ${tabId}`;
    }
  };

  return (
    <div className="tab-chips">
      {attachedTabIds.map((id) => (
        <span key={id} className="tab-chip" title={titleFor(id)}>
          <span className="tab-chip__dot" />
          {truncateLabel(titleFor(id))}
        </span>
      ))}
    </div>
  );
}

function truncateLabel(s: string): string {
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}
