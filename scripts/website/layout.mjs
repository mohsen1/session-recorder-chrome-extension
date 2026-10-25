// Shared frame for every page. Links inside page bodies may use the "~/" root
// token; it is rewritten to a relative prefix so the site works both at
// azimi.me/session-recorder-chrome-extension/ and at a local server root.

export const SITE = 'https://azimi.me/session-recorder-chrome-extension/';
export const INSTALL = 'https://chromewebstore.google.com/detail/session-recorder/dboiheheijgmfpfhbmjggiijpgondghh';
export const GITHUB = 'https://github.com/mohsen1/session-recorder-chrome-extension';
export const DATE = '2026-10-25';
export const CHECKED = 'October 25, 2026';
const VERIFY = '4HAVCdoxXjx6F1gDZtovZwCbhuNM7j4c6EJaLfmrUs4';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rootOf(path) {
  const depth = path.split('/').length - 1;
  return depth ? '../'.repeat(depth) : './';
}

const NAV = [
  ['features', 'Features', 'features/'],
  ['compare', 'Compare', 'compare/'],
  ['guides', 'Guides', 'guides/'],
  ['help', 'Help', 'help/'],
];

function breadcrumbLd(p) {
  const items = [['Session Recorder', ''], ...p.crumbs.map(([l, h]) => [l, h]), [p.crumbLabel, p.path]];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + href })),
  };
}

function head(p) {
  const url = SITE + p.path;
  const ld = [];
  if (p.jsonldRaw && p.jsonldRaw.length) ld.push(...p.jsonldRaw);
  else {
    const graph = [];
    if (p.path !== '') graph.push(breadcrumbLd(p));
    if (p.jsonld) graph.push(...[].concat(p.jsonld));
    if (graph.length) ld.push(JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2));
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${p.path === '' ? `<meta name="google-site-verification" content="${VERIFY}">\n` : ''}<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1b1d" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${esc(p.ogType || 'article')}">
<meta property="og:site_name" content="Session Recorder">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Session Recorder: record a browser bug, annotate it, and file a GitHub issue.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${SITE}og-image.png">
<link rel="icon" href="~/logo.png">
<link rel="apple-touch-icon" href="~/logo.png">
<link rel="stylesheet" href="~/site.css">
${ld.map((j) => `<script type="application/ld+json">\n${j}\n</script>`).join('\n')}
</head>`;
}

function header(p) {
  const links = NAV.map(
    ([key, label, href]) => `<a href="~/${href}"${p.section === key ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<a class="skip" href="#content">Skip to content</a>
<header class="top">
<div class="top__in">
<a class="brand" href="~/"><img src="~/logo.png" width="22" height="22" alt=""><span>Session Recorder</span></a>
<nav class="top__nav" aria-label="Primary">${links}<a href="${GITHUB}">GitHub</a></nav>
<a class="btn btn--primary btn--sm top__cta" href="${INSTALL}">Add to Chrome</a>
</div>
</header>`;
}

function band() {
  return `<section class="band" aria-labelledby="install-band">
<div class="band__in">
<div>
<h2 id="install-band">Record your next bug instead of describing it</h2>
<p>Free and open source. Recording and ZIP export need no account with us. AI, transcription and publishing are optional and use your own providers, whose charges apply.</p>
</div>
<div class="btnrow"><a class="btn btn--primary" href="${INSTALL}">Add to Chrome</a><a class="btn" href="${GITHUB}">Source on GitHub</a></div>
</div>
</section>`;
}

function footer() {
  const col = (title, items) =>
    `<div><h2>${title}</h2><ul>${items.map(([l, h]) => `<li><a href="${h.startsWith('http') ? h : '~/' + h}">${l}</a></li>`).join('')}</ul></div>`;
  return `<footer class="foot">
<div class="foot__in">
<div class="foot__about">
<a class="brand" href="~/"><img src="~/logo.png" width="22" height="22" alt=""><span>Session Recorder</span></a>
<p class="foot__note">A Chrome extension by Mohsen Azimi, licensed AGPL-3.0. Recordings stay in your browser unless you use transcription, AI summaries or publishing you have configured.</p>
</div>
${col('Product', [['All features', 'features/'], ['Annotations', 'features/annotations/'], ['GitHub issues', 'features/github-issues/'], ['AI summaries', 'features/ai-summaries/'], ['Export', 'features/export/']])}
${col('Compare', [['All comparisons', 'compare/'], ['vs Jam', 'jam-alternative/'], ['vs Marker.io', 'compare/marker-io/'], ['vs BugHerd', 'compare/bugherd/'], ['vs Userback', 'compare/userback/'], ['vs BrowserStack Bug Capture', 'compare/browserstack-bug-capture/']])}
${col('Guides', [['All guides', 'guides/'], ['Claude Code', 'claude-code/'], ['Cursor', 'cursor/'], ['Codex', 'codex/'], ['ChatGPT', 'chatgpt/'], ['Example report', 'example-report/']])}
${col('Project', [['Help', 'help/'], ['Privacy policy', 'privacy.html'], ['Source code', GITHUB], ['Report a problem', GITHUB + '/issues'], ['License', GITHUB + '/blob/main/LICENSE'], ['Chrome Web Store', INSTALL]])}
</div>
</footer>`;
}

function crumbs(p) {
  if (p.path === '' || !p.crumbLabel) return '';
  const items = [['Home', ''], ...p.crumbs];
  return `<!-- gen:crumbs --><nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map(([l, h]) => `<li><a href="~/${h}">${esc(l)}</a></li>`)
    .join('')}<li aria-current="page">${esc(p.crumbLabel)}</li></ol></nav><!-- /gen:crumbs -->`;
}

export function relatedList(items) {
  return `<ul class="index">${items
    .map((l) => `<li><a href="~/${l.href}"><b>${esc(l.label)}</b><span>${l.text}</span></a></li>`)
    .join('')}</ul>`;
}

function next(p) {
  if (!p.next || !p.next.length) return '';
  return `<!-- gen:next --><nav class="next" aria-labelledby="next-h"><h2 id="next-h">Related</h2>${relatedList(p.next)}</nav><!-- /gen:next -->`;
}

export function page(p) {
  const r = rootOf(p.path);
  const mainClass = p.mainClass ?? 'doc';
  const inner = p.raw
    ? p.body
    : `\n${crumbs(p)}\n${p.body}\n${next(p)}\n`;
  const html = `${head(p)}
<body>
${header(p)}
<main id="content"${mainClass ? ` class="${mainClass}"` : ''}>${inner}</main>
${band()}
${footer()}
</body>
</html>
`;
  return html.replace(/(href|src|srcset)="~\//g, `$1="${r}`);
}
