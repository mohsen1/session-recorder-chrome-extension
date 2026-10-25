import { INSTALL, GITHUB, SITE, relatedList } from './layout.mjs';

// Illustrative report built in HTML with synthetic data. It is labelled as
// such on the page; it is not a screenshot of a real session.
export const DEMO = `<figure class="demo" aria-labelledby="demo-cap">
<div class="rpt">
<div class="rpt__bar">
<span class="rpt__title">Order total keeps the discount after removing a coupon</span>
<span class="rpt__meta">1:42 · 2 tabs · 3 annotations</span>
<span class="rpt__file" aria-hidden="true"><span>File issue</span><span>acme/storefront <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span></span>
</div>
<div class="rpt__body">
<div class="rpt__draft">
<p class="rpt__h">Summary</p>
<p>After removing coupon SAVE10 at checkout, the coupon chip disappears but the total stays at $81.00 instead of returning to $90.00. The coupon removal request fails with a 500 and the UI does not recover.</p>
<p class="rpt__h">Annotations</p>
<ul class="rpt__anns">
<li><span class="pin">1</span><span>Total should be $90.00 after removing the code</span></li>
<li><span class="pin">2</span><span>Discount line is still listed</span></li>
</ul>
<p class="rpt__h">Evidence</p>
<ul class="rpt__ev">
<li><time>00:31</time><span>click “Remove” on coupon SAVE10</span></li>
<li><time>00:31</time><span class="err">DELETE /api/cart/coupon → 500 (212 ms)</span></li>
<li><time>00:32</time><span class="err">TypeError: Cannot read properties of undefined (reading 'amount')</span></li>
<li><time>00:44</time><span>annotation 1 on span.order-total</span></li>
</ul>
</div>
<div class="rpt__page" aria-hidden="true">
<p class="rpt__h">Annotated page</p>
<div class="mock">
<div class="mock__row"><span>Subtotal</span><span>$90.00</span></div>
<div class="mock__row ann ann--rect"><span>Discount (SAVE10)</span><span>−$9.00</span><span class="pin">2</span></div>
<div class="mock__row"><span>Shipping</span><span>Free</span></div>
<div class="mock__row mock__total ann"><span>Total</span><span>$81.00</span><span class="pin">1</span></div>
<span class="mock__chip">SAVE10</span>
</div>
<div class="rpt__comment"><span class="pin">1</span><span>Total should be $90.00 after removing the code</span></div>
</div>
</div>
</div>
<figcaption id="demo-cap">Illustration with synthetic checkout data, drawn in HTML. Not a screenshot of a real session.</figcaption>
</figure>`;

export function homePage(links) {
  const pick = (keys) => keys.map((k) => links[k]);
  return {
    path: '',
    section: null,
    raw: true,
    mainClass: '',
    ogType: 'website',
    title: 'Session Recorder: Record, Annotate and File Browser Bugs to GitHub',
    description:
      'Free open-source Chrome extension for QA and product teams. Record a bug, annotate the exact element, and file a GitHub issue with an AI summary and a protected report link.',
    crumbs: [],
    crumbLabel: 'Session Recorder',
    llmsLabel: 'Overview',
    jsonld: {
      '@type': 'SoftwareApplication',
      name: 'Session Recorder',
      alternateName: 'Session Recorder Chrome Extension',
      description:
        'A free, open-source Chrome extension for recording browser bugs. It captures interactions, console output, network requests, screenshots, video and voice, supports live element annotations, and files GitHub issues with AI summaries and links to login-protected reports using the user’s own accounts.',
      applicationCategory: 'DeveloperApplication',
      applicationSubCategory: 'Browser Extension',
      operatingSystem: 'Chrome, Chromium',
      softwareVersion: '0.2.1',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: SITE,
      installUrl: INSTALL,
      downloadUrl: INSTALL,
      codeRepository: GITHUB,
      license: 'https://www.gnu.org/licenses/agpl-3.0',
      privacyPolicy: SITE + 'privacy.html',
      author: { '@type': 'Person', name: 'Mohsen Azimi', url: 'https://azimi.me/' },
      featureList: [
        'Browser interaction, console and network recording across tabs',
        'Live element and freeform-area annotations with numbered pins',
        'Screenshot markup with pen, arrow, rectangle, ellipse, text and highlight',
        'Screenshots with near-duplicate skipping and tab video with audio',
        'Voice narration with optional transcription (Deepgram, OpenAI, ElevenLabs)',
        'AI issue summaries and session names with OpenAI, Anthropic, Google or compatible models',
        'One-click GitHub issues across multiple repositories',
        'Protected report publishing to your own Cloudflare Pages with Cloudflare Access',
        'Capture-time redaction of secrets',
        'ZIP export with Markdown, JSON and assets at four detail levels',
      ],
      screenshot: SITE + 'og-image.png',
    },
    body: `
<section class="hero" aria-labelledby="hero-h">
<h1 id="hero-h">Record the bug. Point at it. File the issue.</h1>
<p class="hero__lede">Session Recorder is a free, open-source Chrome extension for QA and product teams. Reproduce a bug, annotate exactly what is wrong, and file a GitHub issue that arrives written, with the full recording behind a login.</p>
<div class="btnrow"><a class="btn btn--primary" href="${INSTALL}">Add to Chrome</a><a class="btn" href="~/features/">See all features</a></div>
<p class="hero__note">No account or subscription with us. Recording and ZIP export work entirely in your browser. AI summaries and publishing use your own model provider and Cloudflare account, where their charges apply.</p>
</section>

${DEMO}

<section class="home-sec" aria-labelledby="flow-h">
<h2 id="flow-h">One path from bug to issue</h2>
<p>Configure your integrations once. After that, filing is a single action on a finished recording.</p>
<ol class="flow">
<li><h3>Record</h3><p>Reproduce the bug in Chrome. Clicks, typing, console errors, network requests and screenshots go onto one timeline, including tabs the app opens.</p><a class="more" href="~/features/browser-recording/">Browser recording</a></li>
<li><h3>Annotate</h3><p>Turn on Annotate, click an element or drag a rectangle, and say what is wrong. Numbered pins lead the report.</p><a class="more" href="~/features/annotations/">Live annotations</a></li>
<li><h3>File</h3><p>Choose File GitHub issue. Your model writes the summary, the report publishes behind Cloudflare Access, and the issue opens with a link.</p><a class="more" href="~/features/github-issues/">GitHub issues</a></li>
</ol>
</section>

<section class="home-sec" aria-labelledby="split-h">
<h2 id="split-h">Useful on its own. Better connected.</h2>
<p>Nothing here requires an integration. Each one you add removes a manual step.</p>
<div class="split">
<div>
<h3>Works without any account</h3>
<p>Stays in your browser until you export it.</p>
<ul>
<li><a href="~/features/browser-recording/">Interactions, console and network capture</a></li>
<li><a href="~/features/annotations/">Live annotations and screenshot markup</a></li>
<li><a href="~/features/screenshots-video/">Screenshots and tab video</a></li>
<li><a href="~/features/privacy-redaction/">Local storage and capture-time redaction</a></li>
<li><a href="~/features/export/">ZIP export for people and coding agents</a></li>
</ul>
</div>
<div>
<h3>With your own accounts</h3>
<p>Configured once; data goes directly to the service you choose.</p>
<ul>
<li><a href="~/features/ai-summaries/">AI issue summaries and session names</a></li>
<li><a href="~/features/github-issues/">One-click GitHub issues, several repositories</a></li>
<li><a href="~/features/protected-publishing/">Reports on your Cloudflare Pages, behind Access</a></li>
<li><a href="~/features/voice-notes/">Voice note transcription</a></li>
</ul>
</div>
</div>
</section>

<section class="home-sec" aria-labelledby="trust-h">
<h2 id="trust-h">Evidence you can share with care</h2>
<p>Authorization headers, cookies, token-like fields, sensitive URL parameters and password inputs are masked before anything is stored. Redaction is pattern-based and does not read screenshots, video or audio, so review a report before it leaves your team. Published reports require sign-in through your Cloudflare Access policy, and API keys are never written into exports or reports. <a href="~/features/privacy-redaction/">How privacy and redaction work</a>.</p>
</section>

<section class="home-sec" aria-labelledby="cmp-h">
<h2 id="cmp-h">Compared with hosted bug tools</h2>
<p>Jam, Marker.io, BugHerd, Userback and BrowserStack Bug Capture offer shared workspaces, client feedback, broad integrations and team administration. Session Recorder is narrower: free, open source, GitHub-first, and run on accounts you already control. <a href="~/compare/">Read the comparisons</a>, including when each tool is the better choice.</p>
</section>

<section class="home-sec" aria-labelledby="agents-h">
<h2 id="agents-h">Hand bugs to coding agents</h2>
<p>Exports are Markdown with a shared clock across every event, sized to fit a context window. The guides show how to use them.</p>
${relatedList(pick(['claude-code', 'cursor', 'codex', 'chatgpt', 'example-report']))}
</section>
<div class="home-end"></div>
`,
  };
}
