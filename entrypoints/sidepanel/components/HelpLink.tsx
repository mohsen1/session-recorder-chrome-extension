import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

export function HelpLink({ topic, children }: {
  topic: 'cloudflare' | 'github' | 'ai-summaries';
  children: ReactNode;
}) {
  return (
    <a
      className="sharing-link"
      href={`https://proofline.sh/session-recorder-chrome-extension/help/${topic}/`}
      target="_blank"
      rel="noreferrer"
    >
      {children}<ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
