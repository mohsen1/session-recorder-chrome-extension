/**
 * Top-of-panel controls shown while a session is live: a REC/PAUSED indicator,
 * an elapsed timer ticking from `session.startedAt` (wall-clock), and the
 * Pause/Resume + Stop buttons.
 */

import React, { useEffect, useState } from 'react';
import { formatClock } from '@/lib/export/markdown';
import { useSidepanel } from '../store';

/** Live wall-clock elapsed ms since `startedAt`, frozen once not running. */
function useElapsed(
  startedAt: number,
  endedAt: number | undefined,
  running: boolean,
): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const ref = running ? now : (endedAt ?? now);
  return Math.max(0, ref - startedAt);
}

export function RecordingControls(): React.JSX.Element | null {
  const session = useSidepanel((s) => s.session);
  const paused = useSidepanel((s) => s.paused);
  const stopRecording = useSidepanel((s) => s.stopRecording);
  const pauseRecording = useSidepanel((s) => s.pauseRecording);
  const resumeRecording = useSidepanel((s) => s.resumeRecording);

  const running = session?.status === 'recording';
  const elapsed = useElapsed(
    session?.startedAt ?? Date.now(),
    session?.endedAt,
    running,
  );

  if (!session) return null;
  const stopping = session.status === 'stopping';

  return (
    <div className="rec-controls">
      <div className="rec-controls__status">
        <span
          className={`rec-badge ${paused ? 'rec-badge--paused' : 'rec-badge--live'}`}
        >
          <span className="rec-badge__dot" />
          {paused ? 'PAUSED' : 'REC'}
        </span>
        <span className="rec-controls__time">{formatClock(elapsed)}</span>
      </div>
      <div className="rec-controls__buttons">
        {paused ? (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void resumeRecording()}
            disabled={stopping}
          >
            Resume
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void pauseRecording()}
            disabled={stopping}
          >
            Pause
          </button>
        )}
        <button
          type="button"
          className="btn btn--stop"
          onClick={() => void stopRecording()}
          disabled={stopping}
        >
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  );
}
