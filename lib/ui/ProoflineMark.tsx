import type { SVGProps } from 'react';

/** The four-part Proofline mark, in the current foreground color. */
export function ProoflineMark({ size = 22, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 460 460" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <rect x="31" y="23" width="181" height="181" rx="11" />
      <rect x="243" y="23" width="181" height="181" rx="11" />
      <rect x="31" y="236" width="181" height="181" rx="11" />
      <path d="M333.5 228 440 334.5 333.5 440 227 334.5Z" />
    </svg>
  );
}
