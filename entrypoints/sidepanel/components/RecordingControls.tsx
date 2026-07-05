/**
 * Top-of-panel controls shown while a session is live: a REC/PAUSED indicator,
 * an elapsed timer ticking from `session.startedAt` (wall-clock), and the
 * Pause/Resume + Stop buttons.
 */

import React, { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
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
      <span
        className={`rec-badge ${paused ? 'rec-badge--paused' : 'rec-badge--live'}`}
      >
        <span className="rec-badge__dot" />
        {paused ? 'Paused' : 'REC'}
      </span>
      <span className="rec-controls__time">{formatClock(elapsed)}</span>
      <div className="rec-controls__buttons">
        <button
          type="button"
          className="icon-btn"
          onClick={() =>
            void (paused ? resumeRecording() : pauseRecording())
          }
          disabled={stopping}
          aria-label={paused ? 'Resume' : 'Pause'}
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          type="button"
          className="btn btn--stop"
          onClick={() => void stopRecording()}
          disabled={stopping}
        >
          <Square size={13} fill="currentColor" strokeWidth={0} />
          {stopping ? 'Stopping…' : 'Stop'}
        </button>
      </div>
    </div>
  );
}
