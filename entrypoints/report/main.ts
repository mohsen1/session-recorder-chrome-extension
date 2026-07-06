/**
 * Rendered report viewer.
 *
 * Opened in a new tab when a recording stops (report.html?session=<id>). Loads
 * the session from IndexedDB, renders `report.md` to HTML with the screenshots
 * shown inline, and styles it as a clean, readable document. A Download button
 * re-exports the same session as a zip.
 *
 * The markdown is rendered with `marked` and sanitized with DOMPurify before it
 * touches the DOM — captured page content (console text, request bodies) is
 * untrusted, and this page runs with extension privileges.
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  getSession,
  getEvents,
  getAssets,
} from '@/lib/storage';
import { renderReport, formatClock } from '@/lib/export/markdown';
import {
  dropStaticAssets,
  collapseRepeatedRequests,
  truncateBodies,
  type Transform,
  type TrimContext,
} from '@/lib/export/trimmer';
import { buildBundle } from '@/lib/export/bundle';
import { zipFiles } from '@/lib/export/zip';
import type { AssetMeta, SessionEvent } from '@/lib/session/types';

const params = new URLSearchParams(location.search);
const sessionId = params.get('session');

const reportEl = document.getElementById('report') as HTMLElement;
const titleEl = document.getElementById('bar-title') as HTMLElement;
const metaEl = document.getElementById('bar-meta') as HTMLElement;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;

function fail(message: string): void {
  reportEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = message;
  reportEl.appendChild(p);
}

/**
 * Viewer trim: keep every screenshot, annotation, voice note, marker, and error
 * (this is a page for humans), but drop static assets + telemetry, collapse
 * repeated requests, and cap body sizes so it stays readable.
 */
function viewerPipeline(): Transform[] {
  return [dropStaticAssets(), collapseRepeatedRequests(), truncateBodies(8192)];
}

async function main(): Promise<void> {
  if (!sessionId) return fail('No session specified.');

  const session = await getSession(sessionId);
  if (!session) return fail('Session not found.');

  const [events, assets] = await Promise.all([
    getEvents(sessionId),
    getAssets(sessionId),
  ]);

  titleEl.textContent = session.name;
  document.title = `${session.name} — Session report`;

  const duration = Math.max(0, (session.endedAt ?? session.startedAt) - session.startedAt);
  const total = Object.values(session.counts).reduce((a, n) => a + (n ?? 0), 0);
  metaEl.textContent = `${formatClock(duration)} · ${total} events`;

  // Object URLs for image assets (screenshots + annotation shots).
  const imageUrls = new Map<string, string>();
  for (const a of assets) {
    if (a.kind === 'screenshot' || a.mime.startsWith('image/')) {
      imageUrls.set(a.id, URL.createObjectURL(a.blob));
    }
  }

  const assetsMeta: AssetMeta[] = assets.map(({ blob: _blob, ...m }) => m);
  const ctx: TrimContext = {
    assetsById: new Map(assetsMeta.map((m) => [m.id, m])),
    settings: session.settings,
  };
  const trimmed: SessionEvent[] = viewerPipeline().reduce(
    (acc, t) => t(acc, ctx),
    events,
  );

  const md = renderReport({
    session,
    events: trimmed,
    assets: assetsMeta,
    level: 'L0',
    assetPath: (id) => imageUrls.get(id),
  });

  const rawHtml = await marked.parse(md, { gfm: true, breaks: false });
  const clean = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'],
    // Allow blob: (our screenshot object URLs) alongside the safe defaults.
    ALLOWED_URI_REGEXP: /^(?:blob:|https?:|mailto:|tel:|#|\/)/i,
  });
  reportEl.innerHTML = clean;

  // Open captured screenshots full-size on click.
  reportEl.querySelectorAll('img').forEach((img) => {
    img.addEventListener('click', () => window.open(img.src, '_blank'));
  });

  // Fold long network appendix + big code blocks are already readable; nothing else.

  wireDownload(session.name);
}

function wireDownload(name: string): void {
  downloadBtn.addEventListener('click', async () => {
    if (!sessionId) return;
    downloadBtn.disabled = true;
    const label = downloadBtn.textContent;
    downloadBtn.textContent = 'Preparing…';
    try {
      const [session, events, assets] = await Promise.all([
        getSession(sessionId),
        getEvents(sessionId),
        getAssets(sessionId),
      ]);
      if (!session) return;
      const files = await buildBundle({ session, events, assets, level: 'L1' });
      const folder = safeName(name);
      const bytes = await zipFiles(files, folder);
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: `${folder}.zip` });
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = label;
    }
  });
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase() || 'session';
}

void main().catch((e) => fail(String(e?.message ?? e)));
