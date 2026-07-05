/**
 * Past-sessions list for the idle view: name, date, duration and asset size for
 * each recorded session. Clicking a row opens the export/review panel; the
 * delete button removes the session (cascading its events + assets).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { sendMessage } from '@/lib/messaging';
import { formatClock } from '@/lib/export/markdown';
import type { Session } from '@/lib/session/types';
import { formatBytes, useSidepanel } from '../store';

interface SessionListProps {
  onOpen: (sessionId: string) => void;
}

export function SessionList({ onOpen }: SessionListProps): React.JSX.Element {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  // Re-fetch whenever the live session id changes (a session just ended).
  const liveSessionId = useSidepanel((s) => s.session?.id);
  const recording = useSidepanel((s) => s.recording);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sendMessage({ kind: 'session/list' });
      setSessions(res.sessions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, liveSessionId, recording]);

  const onDelete = async (id: string) => {
    await sendMessage({ kind: 'session/delete', sessionId: id });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  if (loading && sessions.length === 0) {
    return <p className="sessions__empty">Loading…</p>;
  }

  if (sessions.length === 0) {
    return <p className="sessions__empty">No recordings yet.</p>;
  }

  return (
    <div className="sessions">
      <div className="sessions__head">Sessions</div>
      <ul className="sessions__list">
        {sessions.map((s) => (
          <li key={s.id} className="session-row">
            <button
              type="button"
              className="session-row__main"
              onClick={() => onOpen(s.id)}
            >
              <span className="session-row__name">{s.name}</span>
              <span className="session-row__meta">
                {formatDate(s.startedAt)} · {formatClock(durationOf(s))} ·{' '}
                {formatBytes(s.assetBytes)}
              </span>
            </button>
            <button
              type="button"
              className="session-row__delete"
              aria-label={`Delete ${s.name}`}
              title="Delete"
              onClick={() => void onDelete(s.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function durationOf(s: Session): number {
  return Math.max(0, (s.endedAt ?? s.startedAt) - s.startedAt);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
