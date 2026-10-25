import type { FilingStage } from '@/lib/sharing/file-issue';

/** Small, stage-specific loops; the adjacent text provides the accessible status. */
export function FilingActivity({ stage }: { stage: FilingStage }) {
  return (
    <svg className={`filing-activity filing-activity--${stage}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {stage === 'connection' && <>
        <path d="M7 12h10" opacity=".3" />
        <circle cx="4" cy="12" r="2.5" />
        <circle cx="20" cy="12" r="2.5" />
        <circle className="filing-packet" cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" />
      </>}
      {stage === 'summary' && <>
        <path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7zM15 3v4h4" opacity=".5" />
        <path className="filing-ink filing-ink--one" pathLength="1" d="M8 11h8" />
        <path className="filing-ink filing-ink--two" pathLength="1" d="M8 14h8" />
        <path className="filing-ink filing-ink--three" pathLength="1" d="M8 17h5" />
      </>}
      {stage === 'publish' && <>
        <path d="M4 15v5h16v-5" opacity=".5" />
        <g className="filing-lift"><path d="M12 15V4m-4 4 4-4 4 4" /></g>
        <path className="filing-trail" d="M9 17v1m6-1v1" opacity=".4" />
      </>}
      {stage === 'issue' && <>
        <rect x="4" y="4" width="16" height="16" rx="4" opacity=".5" />
        <path className="filing-check" pathLength="1" d="m8 12 3 3 5-6" />
      </>}
    </svg>
  );
}
