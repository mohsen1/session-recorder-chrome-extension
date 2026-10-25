import React from 'react';
export function ProoflineBrand({
  compact = false,
}: {
  compact?: boolean;
}): React.JSX.Element {
  return (
    <span className="proofline-brand">
      <img src="/proofline-mark.svg" width="22" height="22" alt="" />
      <span>
        {compact ? 'Recorder' : 'Session Recorder'}
        <small>by Proofline</small>
      </span>
    </span>
  );
}
