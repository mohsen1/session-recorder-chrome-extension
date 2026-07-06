/**
 * Self-contained HTML rendering of a session report, for inclusion in the zip.
 *
 * Renders `report.md` (via the markdown renderer) to HTML with `marked`,
 * embedding screenshots as data URLs and inlining a stylesheet, so the file
 * opens and reads on its own with no external assets. Text is already escaped by
 * the markdown renderer (`escapeInline`/`escapeCell`), and marked escapes fenced
 * bodies, so captured page content is rendered as text, not markup.
 */
import { marked } from 'marked';
import { renderReport } from './markdown';
import type { AssetMeta, Session, SessionEvent, VerbosityLevel } from '@/lib/session/types';

export interface ReportHtmlInput {
  session: Session;
  events: SessionEvent[];
  assets: AssetMeta[];
  level: VerbosityLevel;
  /** Data URL for an image asset id, or undefined to omit the image. */
  imageUrl: (assetId: string) => string | undefined;
  /**
   * Sanitize the marked-rendered body HTML before it is embedded. Required in
   * any real use: captured page content (and even the session name) is
   * untrusted, and this file is opened in a browser. Callers pass
   * `DOMPurify.sanitize` (the side panel has a DOM).
   */
  sanitize: (html: string) => string;
}

const CSS = `
:root{--ink:#16181d;--ink-2:#3b3f47;--muted:#767b85;--line:#e7e7e3;--bg:#f7f7f5;--surface:#fff;--surface-2:#f2f2ef;--accent:#ff5a4d;--danger:#e5484d;--font:ui-sans-serif,-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;--mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,monospace;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--ink:#ececea;--ink-2:#b9bcc2;--muted:#878b93;--line:#262a31;--bg:#0e1013;--surface:#16181d;--surface-2:#1b1e24;--accent:#ff6355;--danger:#ff6b6f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
.doc{max-width:860px;margin:0 auto;padding:48px 24px 120px}
h1{font-size:30px;letter-spacing:-.02em;margin:0 0 18px}
h2{font-size:15px;margin:36px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
h2:first-of-type{border-top:none;padding-top:0}
h3{font-size:14px;color:var(--ink-2);margin:24px 0 8px}
p{margin:4px 0;color:var(--ink-2)}a{color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:12px 0 20px;font-size:14px}
th,td{text-align:left;padding:7px 12px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-size:12px}td{color:var(--ink-2)}td:first-child{font-family:var(--mono);color:var(--ink)}
ul{margin:8px 0 16px;padding-left:22px}li{margin:3px 0;color:var(--ink-2)}
img{display:block;max-width:100%;margin:10px 0 20px;border-radius:10px;border:1px solid var(--line);box-shadow:0 2px 12px rgba(0,0,0,.08)}
blockquote{margin:12px 0;padding:10px 16px;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:0 8px 8px 0;color:var(--ink)}
blockquote p{color:var(--ink);margin:2px 0}blockquote strong{color:var(--accent)}
pre{margin:8px 0 18px;padding:14px 16px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;overflow-x:auto;font-size:12.5px;line-height:1.5;max-height:360px}
pre code{font-family:var(--mono);color:var(--ink);background:none;padding:0;border:none}
code{font-family:var(--mono);font-size:.88em;background:var(--surface-2);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
`;

/** Build a full, self-contained HTML document for the session report. */
export function buildReportHtml(input: ReportHtmlInput): string {
  const md = renderReport({
    session: input.session,
    events: input.events,
    assets: input.assets,
    level: input.level,
    assetPath: (id) => input.imageUrl(id),
  });
  const body = input.sanitize(marked.parse(md, { async: false, gfm: true }) as string);
  const title = escapeHtml(input.session.name);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Session report</title>
<style>${CSS}</style>
</head>
<body>
<main class="doc">
${body}
</main>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
