#!/usr/bin/env node
// Static checks for the website: local links and assets resolve, in-page
// anchors exist, metadata is complete and canonical, JSON-LD parses, the
// sitemap matches the pages, and nothing local or secret leaked in.
//
//   node scripts/website/check.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'website');
const SITE = 'https://azimi.me/session-recorder-chrome-extension/';
const errors = [];
const err = (f, m) => errors.push(`${f}: ${m}`);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n.startsWith('_') || n.startsWith('.')) return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(WEB);
const html = files.filter((f) => f.endsWith('.html'));
const idsOf = new Map(html.map((f) => [f, new Set([...readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));

function target(fromFile, href) {
  const [path] = href.split('#');
  let p = resolve(dirname(fromFile), decodeURI(path));
  if (path === '' ) p = fromFile;
  else if (href.endsWith('/') || path.endsWith('/') || (existsSync(p) && statSync(p).isDirectory())) p = join(p, 'index.html');
  return p;
}

for (const f of html) {
  const rel = relative(WEB, f);
  const s = readFileSync(f, 'utf8');
  const urlPath = rel === 'index.html' ? '' : rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;

  if (!/<html lang="en">/.test(s)) err(rel, 'missing lang');
  const title = s.match(/<title>([^<]+)<\/title>/)?.[1];
  if (!title) err(rel, 'missing title');
  else if (title.length > 110) err(rel, `long title (${title.length})`);
  const desc = s.match(/<meta name="description" content="([^"]+)"/)?.[1];
  if (!desc) err(rel, 'missing description');
  else if (desc.length < 70 || desc.length > 260) err(rel, `description length ${desc.length}`);
  const canon = s.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canon !== SITE + urlPath) err(rel, `canonical ${canon} != ${SITE + urlPath}`);
  if (!s.includes(`<meta property="og:url" content="${SITE + urlPath}">`)) err(rel, 'og:url mismatch');
  for (const m of ['og:title', 'og:description', 'og:image', 'twitter:card']) if (!s.includes(m)) err(rel, `missing ${m}`);
  const h1s = (s.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) err(rel, `${h1s} h1 elements`);
  if (!s.includes('id="content"')) err(rel, 'missing skip target');
  if (/class="eyebrow"/.test(s)) err(rel, 'eyebrow label');
  if (/~\//.test(s.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[^<]*<\/code>/g, ''))) err(rel, 'unresolved ~/ root token');
  if (/\/Users\/|file:\/\/|localhost:\d/.test(s)) err(rel, 'local path or localhost URL');
  if (/\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/.test(s)) err(rel, 'secret-like token');
  if (rel === 'index.html' && !s.includes('google-site-verification')) err(rel, 'lost Google verification');

  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { err(rel, 'invalid JSON-LD: ' + e.message); }
  }

  // Heading order: never skip a level going down.
  let last = 1;
  for (const m of s.matchAll(/<h([1-6])[\s>]/g)) {
    const n = +m[1];
    if (n > last + 1) err(rel, `heading jumps h${last} -> h${n}`);
    last = n;
  }

  for (const m of s.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(href)) {
      if (href.startsWith(SITE) && !/canonical|og:|twitter:/.test(s.slice(Math.max(0, m.index - 80), m.index))) {
        // absolute self-links are fine in metadata only
        const ctx = s.slice(Math.max(0, m.index - 40), m.index);
        if (!/<link|<meta/.test(ctx)) err(rel, `absolute self link ${href}`);
      }
      continue;
    }
    if (href.startsWith('/')) { err(rel, `root-absolute link breaks subpath: ${href}`); continue; }
    const t = target(f, href);
    if (!existsSync(t)) { err(rel, `broken ${href}`); continue; }
    const hash = href.split('#')[1];
    if (hash && t.endsWith('.html') && !idsOf.get(t)?.has(hash)) err(rel, `missing anchor ${href}`);
  }
}

// Sitemap and llms.txt coverage.
const sitemap = readFileSync(join(WEB, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const p = loc.slice(SITE.length);
  const f = p === '' ? join(WEB, 'index.html') : p.endsWith('/') ? join(WEB, p, 'index.html') : join(WEB, p);
  if (!existsSync(f)) err('sitemap.xml', `missing page for ${loc}`);
}
for (const f of html) {
  const rel = relative(WEB, f);
  const url = SITE + (rel === 'index.html' ? '' : rel.replace(/index\.html$/, ''));
  if (!locs.includes(url)) err('sitemap.xml', `page not listed: ${rel}`);
}
const llms = readFileSync(join(WEB, 'llms.txt'), 'utf8');
for (const loc of locs) if (!llms.includes(`(${loc})`)) err('llms.txt', `missing ${loc}`);
for (const f of files.filter((f) => /\.(txt|xml|md)$/.test(f))) {
  if (/\/Users\//.test(readFileSync(f, 'utf8'))) err(relative(WEB, f), 'local path');
}

console.log(`Checked ${html.length} HTML pages, ${locs.length} sitemap URLs.`);
if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}
console.log('All checks passed.');
