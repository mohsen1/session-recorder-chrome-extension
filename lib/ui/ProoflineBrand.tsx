import React from 'react';
import { ProoflineMark } from './ProoflineMark';
export function ProoflineBrand({
  compact = false,
}: {
  compact?: boolean;
}): React.JSX.Element {
  return (
    <span className="proofline-brand">
      <ProoflineMark />
      <span>
        {compact ? 'Recorder' : 'Session Recorder'}
        <small>by Proofline</small>
      </span>
    </span>
  );
}
