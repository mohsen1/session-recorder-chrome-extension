#!/usr/bin/env node
// Regenerates the static site. Dependency-free; the generated HTML is
// committed, so browsing the site never needs this step.
//
//   node scripts/website/build.mjs
//
// New pages are defined in ./pages-*.mjs. Legacy hand-written pages keep their
// own <main> content and JSON-LD; this script only re-wraps them in the shared
// head, header, install band and footer, so running it twice is a no-op.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, INSTALL, GITHUB, DATE, esc, rootOf, page as layout } from './layout.mjs';
import { homePage } from './pages-home.mjs';
import { featurePages, featureHub } from './pages-features.mjs';
import { comparePages, compareHub } from './pages-compare.mjs';
import { guidesHub, localFirstPage } from './pages-guides.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'website');

function fileFor(path) {
  if (path === '' || path.endsWith('/')) return join(WEB, path, 'index.html');
  return join(WEB, path);
}

function write(path, html) {
  const file = fileFor(path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---- Legacy pages: keep content, replace the frame ----

const LEGACY = [
  { path: 'claude-code/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['export', 'example-report', 'ai-bug-report'] },
  { path: 'cursor/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['export', 'example-report', 'claude-code'] },
  { path: 'codex/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['export', 'example-report', 'claude-code'] },
  { path: 'chatgpt/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['export', 'privacy-redaction', 'example-report'] },
  { path: 'ai-bug-report/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['ai-summaries', 'export', 'bug-report-template'] },
  { path: 'bug-report-template/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['github-issues', 'ai-bug-report', 'example-report'] },
  { path: 'example-report/', section: 'guides', crumbs: [['Guides', 'guides/']], next: ['export', 'claude-code', 'ai-bug-report'] },
  { path: 'privacy.html', section: null, crumbs: [], next: ['privacy-redaction', 'local-first', 'protected-publishing'] },
  { path: 'help/', section: 'help', crumbs: [], next: [] },
  { path: 'help/cloudflare/', section: 'help', crumbs: [['Help', 'help/']], next: ['protected-publishing', 'github-issues'] },
  { path: 'help/github/', section: 'help', crumbs: [['Help', 'help/']], next: ['github-issues', 'ai-summaries'] },
  { path: 'help/ai-summaries/', section: 'help', crumbs: [['Help', 'help/']], next: ['ai-summaries', 'github-issues'] },
];

const pick = (re, s) => (s.match(re) || [])[1];
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function stripGenerated(main) {
  return main
    .replace(/<!-- gen:(\w+) -->[\s\S]*?<!-- \/gen:\1 -->\s*/g, '')
    .replace(/\s*<p class="eyebrow">[\s\S]*?<\/p>/g, '')
    .replace(/\s*<p class="crumbs">[\s\S]*?<\/p>/g, '')
    .replace(/\s*<section class="(cta|related)">[\s\S]*?<\/section>/g, '')
    .replace(/^\s+|\s+$/g, '');
}

function rewrapLegacy(cfg, linkTable) {
  const src = readFileSync(fileFor(cfg.path), 'utf8');
  const title = decode(pick(/<title>([\s\S]*?)<\/title>/, src).trim());
  const description = decode(pick(/<meta\s+name="description"\s+content="([^"]*)"/, src));
  const ogType = pick(/<meta\s+property="og:type"\s+content="([^"]*)"/, src) || 'article';
  const jsonld = [...src.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((m) => m[1]);
  const main = stripGenerated(pick(/<main[^>]*>([\s\S]*?)<\/main>/, src));
  const h1 = decode(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/, main).replace(/<[^>]+>/g, '').trim());
  return {
    path: cfg.path,
    section: cfg.section,
    title,
    description,
    ogType,
    jsonldRaw: jsonld,
    crumbs: cfg.crumbs,
    crumbLabel: h1,
    body: main,
    next: cfg.next.map((k) => linkTable[k]).filter(Boolean),
    sitemap: true,
  };
}

// ---- Assemble ----

const features = featurePages();
const compares = comparePages();

// Short descriptions used by "related" lists anywhere on the site.
const linkTable = {};
for (const f of features) linkTable[f.slug] = { href: `features/${f.slug}/`, label: f.name, text: f.short };
for (const c of compares) linkTable[`vs-${c.key}`] = { href: c.path, label: c.navLabel, text: c.short };
Object.assign(linkTable, {
  'claude-code': { href: 'claude-code/', label: 'With Claude Code', text: 'Unzip the report in the repo and point Claude Code at it.' },
  'cursor': { href: 'cursor/', label: 'With Cursor', text: 'Attach report.md to Cursor’s Agent.' },
  'codex': { href: 'codex/', label: 'With Codex', text: 'Give Codex the browser evidence it cannot collect itself.' },
  'chatgpt': { href: 'chatgpt/', label: 'With ChatGPT', text: 'Upload one report instead of screenshots and log fragments.' },
  'example-report': { href: 'example-report/', label: 'Example report', text: 'A complete, sanitized report.md as an agent receives it.' },
  'ai-bug-report': { href: 'ai-bug-report/', label: 'Bug reports agents can fix', text: 'Which signals matter, ordering, token budgets and redaction.' },
  'bug-report-template': { href: 'bug-report-template/', label: 'Browser bug report template', text: 'Copyable Markdown with repro steps, console and network evidence.' },
  'local-first': { href: 'local-first/', label: 'Local by default', text: 'What stays in the browser, and what leaves only when you configure it.' },
});

const pages = [
  homePage(linkTable),
  featureHub(features),
  ...features.map((f) => f.page(linkTable)),
  compareHub(compares),
  ...compares.map((c) => c.page(linkTable)),
  guidesHub(linkTable),
  localFirstPage(linkTable),
  ...LEGACY.map((cfg) => rewrapLegacy(cfg, linkTable)),
];

for (const p of pages) write(p.path, layout(p));

// ---- sitemap.xml ----

const prio = (p) => (p.path === '' ? '1.0' : p.path.startsWith('features/') || p.path.startsWith('compare/') ? '0.8' : p.path.startsWith('help/') || p.path === 'privacy.html' ? '0.4' : '0.7');
const urls = pages
  .filter((p) => p.sitemap !== false)
  .map((p) => `  <url>\n    <loc>${SITE}${p.path}</loc>\n    <lastmod>${DATE}</lastmod>\n    <priority>${prio(p)}</priority>\n  </url>`)
  .join('\n');
writeFileSync(
  join(WEB, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/website/build.mjs. Covers only the
     /session-recorder-chrome-extension/ path; submit it directly in Google
     Search Console and Bing Webmaster Tools. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
);

// ---- llms.txt ----

const line = (p) => `- [${p.llmsLabel || p.crumbLabel || p.title}](${SITE}${p.path}): ${p.description}`;
const byPrefix = (prefix) => pages.filter((p) => p.path.startsWith(prefix) && p.path !== prefix);
const find = (path) => pages.find((p) => p.path === path);
writeFileSync(
  join(WEB, 'llms.txt'),
  `# Session Recorder

> Session Recorder is a free, open-source (AGPL-3.0) Chrome extension for QA
> and product teams. Record a bug in the browser, annotate the exact element or
> area, and file a GitHub issue in one action with an AI-written summary and a
> link to a login-protected report.

Key facts: recording, annotation, local storage and ZIP export work without
any account, subscription or developer-operated server. Recordings are stored
in the browser (IndexedDB). Redaction of authorization headers, cookies,
token-like fields, sensitive URL parameters and password inputs is on by
default at capture time; it does not catch everything, so review evidence
before sharing. Optional integrations use the user's own credentials and send
data directly to those services: AI summaries and session names (OpenAI,
OpenAI-compatible endpoints, Anthropic, Google Gemini), voice transcription
(Deepgram, OpenAI, ElevenLabs; also used for spoken annotation comments,
with an optional page-vocabulary hint built by the configured model from
visible interface labels), report publishing (the user's Cloudflare
Pages project behind Cloudflare Access) and issue filing (GitHub). Those
providers' charges and limits apply. Exports are ZIP files containing
report.md, session.json, MANIFEST.md, transcript.json and assets (plus an
optional standalone report.html), at four detail levels (Full, Standard,
Compact, Minimal). Developed by Mohsen
Azimi.

## Product

${line(find(''))}
- [Chrome Web Store listing](${INSTALL}): install the extension.
- [Source on GitHub](${GITHUB}): source code, issues and README. AGPL-3.0.
${line(find('privacy.html'))}

## Features

${line(find('features/'))}
${byPrefix('features/').map(line).join('\n')}

## Comparisons

${line(find('compare/'))}
${[find('jam-alternative/'), ...byPrefix('compare/')].map(line).join('\n')}

## Guides

${line(find('guides/'))}
${['claude-code/', 'cursor/', 'codex/', 'chatgpt/', 'ai-bug-report/', 'bug-report-template/', 'example-report/', 'local-first/'].map((p) => line(find(p))).join('\n')}

## Setup help

${['help/', 'help/github/', 'help/ai-summaries/', 'help/cloudflare/'].map((p) => line(find(p))).join('\n')}
`,
);

console.log(`Wrote ${pages.length} pages, sitemap.xml and llms.txt`);
for (const p of pages) console.log('  ' + (p.path || '(home)'));
