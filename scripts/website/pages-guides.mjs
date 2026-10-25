import { relatedList } from './layout.mjs';

export function guidesHub(links) {
  const pick = (keys) => keys.map((k) => links[k]);
  return {
    path: 'guides/',
    section: 'guides',
    title: 'Guides: Browser Bug Reports for Teams and AI Coding Agents — Session Recorder',
    description:
      'Guides for using Session Recorder reports with Claude Code, Cursor, Codex and ChatGPT, a browser bug report template, an example report, and what makes a bug report fixable.',
    crumbs: [],
    crumbLabel: 'Guides',
    llmsLabel: 'All guides',
    ogType: 'website',
    body: `<h1>Guides</h1>
<p class="lede">How to write bug reports a developer or a coding agent can act on, and how to hand Session Recorder exports to the tools you use.</p>
<h2 id="agents">Coding agents</h2>
${relatedList(pick(['claude-code', 'cursor', 'codex', 'chatgpt']))}
<h2 id="reports">Writing better bug reports</h2>
${relatedList(pick(['ai-bug-report', 'bug-report-template', 'example-report']))}
<h2 id="privacy">Privacy</h2>
${relatedList(pick(['local-first']))}`,
    next: [],
  };
}

export function localFirstPage(links) {
  return {
    path: 'local-first/',
    section: 'guides',
    title: 'Local-First Bug Recorder: No Account, Optional Integrations on Your Own Terms',
    description:
      'Session Recorder keeps recordings in your browser with no account or developer-operated backend. Transcription, AI summaries and publishing are optional and use your own providers.',
    crumbs: [['Guides', 'guides/']],
    crumbLabel: 'Local by default',
    llmsLabel: 'Local-first design',
    jsonld: {
      '@type': 'TechArticle',
      headline: 'A local-first bug recorder',
      dateModified: '2026-10-25',
      author: { '@type': 'Person', name: 'Mohsen Azimi', url: 'https://azimi.me/' },
    },
    body: `<h1>A local-first bug recorder</h1>
<p class="lede">Most bug-capture tools upload every recording to the vendor’s cloud. Session Recorder stores recordings in your browser, and anything that leaves goes to an account you configured, not to us.</p>
<div class="definition"><p><b>Session Recorder is a free, open-source Chrome extension for recording browser bugs.</b> It has no account system, no developer-operated backend and no telemetry. Sessions are written to IndexedDB in your Chrome profile.</p></div>

<h2 id="what">What “local-first” means here</h2>
<ul>
<li><b>No account.</b> Install it and press Record. There is no sign-up, workspace or seat.</li>
<li><b>No backend of ours.</b> The extension makes no requests to any server operated by its author.</li>
<li><b>No telemetry.</b> No analytics, crash reporting or usage counts.</li>
<li><b>Storage is your browser.</b> Deleting a session deletes the local data.</li>
<li><b>Export is a file.</b> A ZIP in your Downloads folder, shared however you choose.</li>
<li><b>No remote code.</b> Everything the extension runs ships in the package.</li>
</ul>

<h2 id="optional">Optional integrations, on your accounts</h2>
<p>Four features send data out, and only after you configure them with your own credentials. Each sends directly from the extension to that service:</p>
<ul>
<li><b>Transcription</b> sends recorded audio to Deepgram, OpenAI or ElevenLabs.</li>
<li><b>AI summaries and session names</b> send up to 60,000 characters of text evidence, never media, to OpenAI, Anthropic, Google or your compatible endpoint.</li>
<li><b>Publishing</b> uploads the report and its media to your Cloudflare Pages project, behind your Cloudflare Access policy.</li>
<li><b>GitHub issues</b> send the title, summary and report link to the repository you choose.</li>
</ul>
<p>Spoken annotation comments use the same transcription provider. With an AI model configured, selecting an annotation also sends a bounded excerpt of visible page labels (never input values or hidden content) to the model to build a short vocabulary list for Deepgram or ElevenLabs; neither is saved. Provider pricing, limits and retention policies apply to all of these. The <a href="~/privacy.html">privacy policy</a> lists them in full.</p>

<h2 id="redaction">Secrets are masked before they are written</h2>
<p>Redaction runs at capture time. Authorization headers, cookies, token-like JSON and form fields, sensitive URL parameters and password inputs are masked on the way into storage, so the unmasked value is never saved. You can add rules or turn redaction off per session.</p>
<p>It is not a guarantee. Redaction is pattern-based and does not inspect screenshots, video or audio, or recognise personal data in ordinary fields. Review evidence before sharing it. <a href="~/features/privacy-redaction/">Details and limits</a>.</p>

<h2 id="who">Who this design suits</h2>
<ul>
<li><b>Internal and regulated apps</b>, where recordings of production screens should not land in a third-party workspace.</li>
<li><b>Pre-release work</b>, where a recording of an unannounced feature should stay with the team.</li>
<li><b>Teams already on GitHub and Cloudflare</b>, who would rather use those accounts than add another vendor.</li>
<li><b>Agent workflows</b> with <a href="~/claude-code/">Claude Code</a>, <a href="~/cursor/">Cursor</a> or <a href="~/codex/">Codex</a> against a local checkout.</li>
</ul>

<h2 id="tradeoffs">The trade-offs</h2>
<div class="tablewrap" role="region" aria-label="Trade-offs of a local-first design" tabindex="0">
<table>
<thead><tr><th scope="col">You give up</th><th scope="col">What to do instead</th></tr></thead>
<tbody>
<tr><th scope="row">A shared vendor workspace</th><td>Publish protected reports to your Cloudflare account and discuss them in GitHub issues.</td></tr>
<tr><th scope="row">Integrations beyond GitHub</th><td>Use Publish report only for a link, or attach the ZIP to any tracker.</td></tr>
<tr><th scope="row">Cross-device history</th><td>Sessions live in one Chrome profile. Export or publish what others need.</td></tr>
<tr><th scope="row">Reports from customers</th><td>Use a widget-based tool. See the <a href="~/compare/">comparisons</a>.</td></tr>
</tbody>
</table>
</div>`,
    next: [links['privacy-redaction'], links['protected-publishing'], { href: 'privacy.html', label: 'Privacy policy', text: 'Exactly what is stored and what is sent, per integration.' }],
  };
}
