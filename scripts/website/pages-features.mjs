// Feature hub and one page per feature. Claims here were checked against the
// extension source (lib/, entrypoints/) and docs/sharing.md on 2026-10-25.

import { esc } from './layout.mjs';

const LOCAL = '<span class="tag tag--local">Works without accounts</span>';
const BYO = '<span class="tag tag--byo">Uses your own account</span>';

const F = [
  {
    slug: 'browser-recording',
    name: 'Browser recording',
    short: 'Clicks, typing, navigation, console, network and new tabs on one timeline.',
    title: 'Browser Session Recording for Bug Reports: Clicks, Console and Network — Session Recorder',
    description:
      'Record a bug reproduction in Chrome with interactions, console errors, network requests and responses, and tabs the app opens, all on one timeline. Free and open source.',
    h1: 'Browser recording',
    lede: 'Press Record in the side panel and reproduce the bug normally. Interactions, console output and network traffic land on one timeline, in the order they happened.',
    local: true,
    facts: [
      ['Needs', 'Chrome or a Chromium browser. No account.'],
      ['Produces', 'A local session with a timeline, screenshots and captured request data'],
      ['Settings', 'Capture detail, redaction rules, telemetry filtering, API spec'],
    ],
    body: `
<h2 id="use">When to use it</h2>
<p>Use it whenever someone has to understand a bug they did not see: a QA finding headed for a developer, a product review note, or a failure you want an AI coding agent to trace. The recording replaces the usual pile of screenshots, copied console lines and “I clicked around a bit” in the ticket.</p>

<h2 id="captured">What gets captured</h2>
<ul>
<li><b>Interactions.</b> Clicks, typing, scrolls, text selections and page navigations, each with a short description of the element involved. Password fields are never recorded as text.</li>
<li><b>Console.</b> Log output, warnings, errors and uncaught exceptions from the recorded tabs.</li>
<li><b>Network.</b> Requests and responses, including headers, status, timing and bodies up to a size cap. Capture uses Chrome’s debugging protocol, which is why Chrome shows a “started debugging this browser” banner while you record.</li>
<li><b>Tabs the app opens.</b> When the recorded page opens a new tab or window, that tab joins the session. Switching back and forth stays on the same timeline.</li>
<li><b>Uploaded files.</b> Files you pick in the page’s file inputs are kept with the session. Files up to 25 MB are stored whole by default; larger ones keep only their name, type and size.</li>
<li><b>Screenshots and optional video.</b> Covered on <a href="~/features/screenshots-video/">Screenshots and video</a>.</li>
</ul>

<h2 id="detail">Choosing capture detail</h2>
<p>The Record button has a detail control with four presets. Each one changes how often screenshots are taken, whether hovering is recorded, and how much of each request body is kept.</p>
<div class="tablewrap" role="region" aria-label="Capture detail presets" tabindex="0">
<table>
<thead><tr><th scope="col">Preset</th><th scope="col">Screenshots</th><th scope="col">Hover tracking</th><th scope="col">Inline body cap</th></tr></thead>
<tbody>
<tr><th scope="row">Minimal</th><td>On demand</td><td>Off</td><td>64 KB</td></tr>
<tr><th scope="row">Standard</th><td>Key moments</td><td>Off</td><td>128 KB</td></tr>
<tr><th scope="row">Detailed (default)</th><td>Every interaction</td><td>After 700 ms</td><td>256 KB</td></tr>
<tr><th scope="row">Maximum</th><td>Every interaction</td><td>After 350 ms</td><td>1 MB</td></tr>
</tbody>
</table>
</div>
<p>Analytics and telemetry requests are still captured, but by default they are left out of Standard and smaller exports, so the network section stays about your app. Turn on <b>API spec</b> in capture settings and the export also includes an <code>openapi.json</code> inferred from the JSON traffic you exercised.</p>

<h2 id="limits">Limits</h2>
<ul>
<li>Chrome blocks extensions on its own pages (such as <code>chrome://</code> and the Chrome Web Store), so those cannot be recorded.</li>
<li>Only tabs in the session are recorded. A tab you open yourself from the address bar is not adopted.</li>
<li>Redaction runs on headers, bodies and URLs as they are captured, but it is pattern-based. Read <a href="~/features/privacy-redaction/">Local storage and redaction</a> before recording production data.</li>
</ul>
`,
    help: [],
    next: ['annotations', 'screenshots-video', 'export'],
  },
  {
    slug: 'annotations',
    name: 'Annotations',
    short: 'Click an element or drag a rectangle, then say what is wrong. Plus screenshot markup.',
    title: 'Live Page Annotations for Bug Reports: Click an Element, Add a Comment — Session Recorder',
    description:
      'Annotate the live page while recording: click an element or drag a freeform rectangle and type a comment. Numbered pins lead the report and the AI issue summary.',
    h1: 'Live annotations and screenshot markup',
    lede: 'Point at the exact thing that is wrong while the page is still live. Each annotation keeps your comment, a description of the element and a screenshot, and it leads the issue summary.',
    local: true,
    facts: [
      ['Needs', 'An active recording. No account.'],
      ['Produces', 'Numbered annotations with comment, element description and screenshot'],
      ['Shortcut', '<kbd>Enter</kbd> saves, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a line, <kbd>Esc</kbd> backs out'],
    ],
    body: `
<h2 id="use">When to use it</h2>
<p>Recordings show what happened. Annotations say what was wrong about it. A QA tester can pin the misaligned total, the label with the wrong copy, or the region where a spinner never stops, without stopping to explain the surrounding steps. Developers then read the concern first and the diagnostics second.</p>

<h2 id="live">Annotating the live page</h2>
<ol class="steps">
<li><h3>Turn on Annotate</h3><p>While recording, toggle <b>Annotate</b>. Elements highlight in blue as you move the pointer, and normal page clicks pause.</p></li>
<li><h3>Pick an element or an area</h3><p>Click a highlighted element, or drag a freeform rectangle across any region when the problem is not a single element.</p></li>
<li><h3>Write the comment</h3><p>Type into the anchored comment bar and press <kbd>Enter</kbd> or the check button. A numbered pin marks the spot. If the recording microphone is on, speech fills the comment as you talk; the comment’s mic button starts or stops that microphone.</p></li>
<li><h3>Get back to the page</h3><p>Choose <b>Turn off annotations</b> or toggle Annotate again. <kbd>Esc</kbd> first closes the comment, then leaves annotation mode. Pausing or stopping the recording also ends it.</p></li>
</ol>

<h2 id="markup">Screenshot markup</h2>
<p><b>Markup</b> opens a separate drawing editor on a frozen screenshot of the tab. It has pen, arrow, rectangle, ellipse, text and highlight tools. Use it when you want to draw relationships, such as an arrow from a button to the panel it should have opened, rather than leave a comment on one thing.</p>

<h2 id="report">What the report does with them</h2>
<ul>
<li>Annotations appear with their pin number, comment, element description and screenshot, at their point on the timeline.</li>
<li>When AI summaries are configured, annotations and notes are placed first in the evidence the model reads, so the issue title and summary describe your concern rather than unrelated console noise. See <a href="~/features/ai-summaries/">AI issue summaries</a>.</li>
</ul>

<h2 id="limits">Limits</h2>
<ul>
<li>Live annotation is available only while recording. Screenshot markup remains available for captured frames.</li>
<li>Spoken comments need a <a href="~/features/voice-notes/">transcription provider</a>. Deepgram and ElevenLabs fill the comment live; OpenAI fills it in segments, so text appears after a short pause. The audio stays part of the session’s voice recording.</li>
<li>With an AI model configured, selecting an element sends a short excerpt of visible page labels to that model to build a vocabulary list for Deepgram or ElevenLabs. See <a href="~/features/voice-notes/#vocabulary">page vocabulary</a>.</li>
</ul>
`,
    help: [],
    next: ['ai-summaries', 'voice-notes', 'github-issues'],
  },
  {
    slug: 'screenshots-video',
    name: 'Screenshots and video',
    short: 'Automatic or on-demand screenshots, near-duplicates skipped, and optional tab video with audio.',
    title: 'Screenshots and Tab Video for Bug Reports — Session Recorder',
    description:
      'Session Recorder takes screenshots at every interaction, at key moments or on demand, skips near-duplicate frames, and can record the tab as video with audio.',
    h1: 'Screenshots and video',
    lede: 'Screenshots are taken for you as you reproduce the bug, and tab video is one toggle away when motion or timing is the problem.',
    local: true,
    facts: [
      ['Needs', 'An active recording. No account.'],
      ['Produces', 'JPEG screenshots on the timeline; WebM video segments'],
      ['Settings', 'Screenshot policy, quality, duplicate threshold, video from start'],
    ],
    body: `
<h2 id="screenshots">Screenshots</h2>
<p>The screenshot policy follows the capture detail preset: <b>every interaction</b> (the default), <b>key moments</b>, or <b>on demand</b> when you only want frames you take yourself. Frames that are nearly identical to the previous one are skipped, so a long session does not fill up with copies of an unchanged page. Quality and the duplicate threshold are adjustable in capture settings.</p>
<p>Each screenshot sits on the timeline next to the interaction that triggered it. Any frame can be opened in <a href="~/features/annotations/#markup">screenshot markup</a>.</p>

<h2 id="video">Tab video</h2>
<p>Turn on video while recording, or set it to start automatically with every recording. Video captures the recorded tab, including its audio when the page plays sound. Pausing the recording finishes the current video segment and resuming starts a new one, so the timeline keeps the gaps honest. There is no fixed duration limit; long videos are limited by browser storage.</p>
<p>Use video for animation glitches, race conditions you can see, scrolling problems and anything where the exact sequence on screen matters. For most form and API bugs, screenshots plus the network timeline are smaller and easier to read.</p>

<h2 id="export">In exports and published reports</h2>
<ul>
<li>Full and Standard exports include video files. Compact and Minimal omit video to stay small. See <a href="~/features/export/">Exports</a>.</li>
<li>The optional standalone <code>report.html</code> embeds screenshots but not video, which keeps it a single file you can open anywhere.</li>
<li>Publishing to Cloudflare Pages has a 25 MiB per-file limit, so very long video segments may need a shorter take or a Compact report.</li>
</ul>
`,
    help: [],
    next: ['annotations', 'voice-notes', 'export'],
  },
  {
    slug: 'voice-notes',
    name: 'Voice notes and transcription',
    short: 'Narrate while you reproduce; transcripts land on the timeline with your own provider key.',
    title: 'Voice Narration and Transcription for Bug Reports — Session Recorder',
    description:
      'Narrate a bug while you record it. Audio stays local; add your own Deepgram, OpenAI or ElevenLabs key to get a timestamped transcript on the timeline.',
    h1: 'Voice notes and transcription',
    lede: 'Talking through a reproduction is faster than typing it up afterwards. Session Recorder records your microphone with the session and, if you add a provider key, places the transcript on the same timeline as everything else.',
    local: false,
    mixed: true,
    facts: [
      ['Without accounts', 'Microphone audio is recorded and kept as an audio file'],
      ['With your key', 'Deepgram or ElevenLabs (live streaming), or OpenAI (segments)'],
      ['Produces', 'Audio, <code>transcript.json</code> and narration lines on the timeline'],
    ],
    body: `
<h2 id="use">When to use it</h2>
<p>Narrate what you expected to happen while it fails: “I removed the coupon, the total should go back to 90.” Spoken intent is the part a log cannot capture, and a developer or agent reading the report gets it at the exact moment it was said.</p>

<h2 id="how">How it works</h2>
<ol class="steps">
<li><h3>Turn on the microphone</h3><p>Use the mic control in the side panel during a recording, or set it to start with every recording. Chrome asks for microphone permission the first time.</p></li>
<li><h3>Talk while you reproduce</h3><p>Audio is saved in the browser with the session.</p></li>
<li><h3>Get a transcript (optional)</h3><p>In <b>Settings → Transcription</b>, choose a provider and enter your API key. Deepgram and ElevenLabs stream live text; OpenAI transcribes the recorded audio in segments. Each utterance is placed on the timeline at the moment you began speaking.</p></li>
</ol>

<h2 id="providers">Providers and costs</h2>
<p>The default models are Deepgram Nova-3, ElevenLabs Scribe v2 Realtime and OpenAI gpt-4o-transcribe, and you can change the model. Audio goes directly from the extension to the provider you chose, under your account, and that provider’s pricing and data policies apply. Without a key, nothing is sent and the report keeps the raw audio instead of text.</p>

<h2 id="dictation">Speaking annotation comments</h2>
<p><a href="~/features/annotations/">Live annotation</a> comments use the same recording microphone and transcription provider. With the mic already on, speech fills the open comment automatically; the comment’s mic button starts or stops the recording microphone. Deepgram and ElevenLabs show interim text as you speak, and OpenAI adds text per segment. The narration audio remains in the recording. Typing never starts the microphone.</p>

<h2 id="vocabulary">Page vocabulary for better recognition</h2>
<p>Product names and internal jargon are where speech recognition fails most. When you select an annotation and an AI model is configured, the extension sends a bounded excerpt of the page’s visible headings, navigation and interface labels to that model, which picks out unusual terms. A short dictionary of those terms goes to Deepgram or ElevenLabs to bias recognition.</p>
<ul>
<li>Input values, editable fields and hidden content are excluded from the excerpt.</li>
<li>The excerpt and dictionary are kept in memory only. They are not saved with the session or published.</li>
<li>No API keys are exposed to the page you are recording.</li>
<li>If extraction fails, ordinary transcription continues without the dictionary.</li>
<li>The model call is billed by your AI provider, and ElevenLabs charges extra for keyterm prompting.</li>
</ul>
<p>Automated tests cover this flow with mocked provider streams; recognition quality depends on the provider and has not been benchmarked here.</p>

<h2 id="limits">Limits</h2>
<ul>
<li>Transcripts are only as good as the provider and the microphone. Proper nouns and product names may need correcting in the report.</li>
<li>Narration feeds AI issue summaries as context after annotations and notes. Background chatter will be read too, so pause the mic when you are not narrating.</li>
</ul>
`,
    help: [],
    next: ['annotations', 'ai-summaries', 'privacy-redaction'],
  },
  {
    slug: 'ai-summaries',
    name: 'AI issue summaries',
    short: 'Annotation-first issue drafts and automatic session names, using OpenAI, Anthropic, Google or a compatible endpoint.',
    title: 'AI Bug Report Summaries with Your Own API Key (OpenAI, Anthropic, Gemini) — Session Recorder',
    description:
      'Generate a GitHub issue title and summary from a recorded bug with your own OpenAI, Anthropic, Google Gemini or OpenAI-compatible model. Annotations lead; diagnostics support.',
    h1: 'AI issue summaries and session names',
    lede: 'With a model configured, filing writes the issue for you: a title, a summary and reproduction steps built from what you pointed at, said and did. Stopping a recording also gives it a readable name.',
    local: false,
    facts: [
      ['Needs', 'An API key and model ID from OpenAI, Anthropic or Google, or an OpenAI-compatible server'],
      ['Sends', 'Up to 60,000 characters of text evidence. No screenshots, files, audio or video.'],
      ['Help', '<a href="~/help/ai-summaries/">Set up AI summaries</a>'],
    ],
    body: `
<h2 id="use">What it is for</h2>
<p>Most of the time spent filing a bug goes into turning evidence into prose. The summary step does that from the recording and keeps your intent in charge: annotations and notes come first, then narration, then interactions. Repeated console and network diagnostics are condensed and kept separate as supporting evidence, so an issue about a wrong total does not turn into an issue about an unrelated warning.</p>

<h2 id="providers">Supported models</h2>
<ul>
<li><b>OpenAI</b>, <b>Anthropic</b> and <b>Google Gemini</b> through their native APIs.</li>
<li><b>OpenAI-compatible</b> servers that implement Chat Completions, including local ones. HTTPS is required except for <code>localhost</code>, and a local server can leave the key blank.</li>
</ul>
<p>You enter the model ID available in your account. Each provider keeps its own configuration, so switching does not lose settings.</p>

<h2 id="behaviour">How it behaves</h2>
<ul>
<li><b>File GitHub issue</b> generates the summary automatically when a model is configured. There is no separate review step, and <b>Review text sent to the model</b> shows the exact input.</li>
<li>Drafts you have edited, and drafts generated earlier, are kept. <b>Regenerate summary</b> replaces them only when you ask.</li>
<li>When you stop a recording, the same bounded evidence produces a short session title. The report opens immediately and the name appears when ready. A failed request keeps the original title, and a late reply never overwrites a name you typed.</li>
<li>While annotating with transcription on, the same model extracts unusual terms from visible page labels to help speech recognition. See <a href="~/features/voice-notes/#vocabulary">page vocabulary</a>.</li>
<li>Without a model, you write the issue yourself; everything else works the same.</li>
</ul>

<h2 id="costs">Data and costs</h2>
<p>Evidence goes directly from your browser to the provider you configured, never through a server of ours. The provider’s pricing, rate limits and retention policies apply. Generated text can be wrong: read the summary before you rely on it, especially in a public repository.</p>
`,
    help: [['Set up AI summaries', 'help/ai-summaries/']],
    next: ['github-issues', 'annotations', 'privacy-redaction'],
  },
  {
    slug: 'github-issues',
    name: 'One-click GitHub issues',
    short: 'File into one of several repositories, each with its own token, with progress and cancel.',
    title: 'File GitHub Issues from a Browser Recording in One Click — Session Recorder',
    description:
      'Choose File GitHub issue on a recorded bug: the extension summarizes it, publishes a protected report and creates the issue with a link. Multiple repositories, scoped tokens.',
    h1: 'One-click GitHub issues',
    lede: 'Configure the destination once. After that, a finished recording becomes a GitHub issue with one action: summary, protected report link and all.',
    local: false,
    facts: [
      ['Needs', 'A fine-grained GitHub token per repository and <a href="~/features/protected-publishing/">protected publishing</a>'],
      ['Optional', 'An <a href="~/features/ai-summaries/">AI model</a> to write the summary'],
      ['Help', '<a href="~/help/github/">Connect a repository</a>'],
    ],
    body: `
<h2 id="flow">What happens when you file</h2>
<ol class="steps">
<li><h3>Stop the recording</h3><p>The report opens with <b>File issue</b> in the header and the editable draft above the evidence.</p></li>
<li><h3>Choose File GitHub issue</h3><p>The extension checks the repository, prepares the summary if a model is configured, publishes the report to your Cloudflare project, and creates the issue with a link to it.</p></li>
<li><h3>Open the issue</h3><p>When it finishes, the issue opens. Later, the report shows <b>View issue</b> instead.</p></li>
</ol>
<p>A full-page progress view shows the current stage and has <b>Cancel</b>. Cancelling stops further work and keeps saved drafts and deployments. It cannot undo an upload or issue request that GitHub or Cloudflare already accepted.</p>

<h2 id="repos">Several repositories</h2>
<p>Add as many repositories as you file into, each with its own token scoped to that repository with <b>Issues: Read and write</b>. Saving checks access to each one. The arrow beside <b>File issue</b> picks the destination; new reports remember your last choice, and an existing draft keeps the repository it was started for.</p>

<h2 id="safety">Avoiding duplicates</h2>
<p>If the network fails after GitHub may have received the request, the extension does not post again automatically. <b>Check GitHub issue</b> looks for the earlier request first, and a retry reuses the existing deployment instead of uploading again.</p>

<h2 id="visibility">Who can see what</h2>
<ul>
<li>The issue title and summary are as visible as the repository. In a public repository, anyone can read them.</li>
<li>The linked report requires Cloudflare Access sign-in, independent of GitHub permissions.</li>
<li>Tokens stay in extension storage and are never included in exports or published reports. Unpublishing a report does not delete the issue.</li>
</ul>
<p>Prefer another tracker? Use <b>Publish report only</b> for a protected link, or <a href="~/features/export/">export a ZIP</a> and attach it anywhere.</p>
`,
    help: [['Connect a repository', 'help/github/']],
    next: ['protected-publishing', 'ai-summaries', 'export'],
  },
  {
    slug: 'protected-publishing',
    name: 'Protected report publishing',
    short: 'Publish to your own Cloudflare Pages project behind Cloudflare Access login.',
    title: 'Publish Bug Reports Behind Login on Your Own Cloudflare Account — Session Recorder',
    description:
      'Share a recorded bug as a web report hosted in your own Cloudflare Pages project. Readers sign in through Cloudflare Access, and a Pages Function checks every request.',
    h1: 'Protected report publishing',
    lede: 'Share a full report with people who were not there, without handing the recording to a third-party workspace. Reports are published to your Cloudflare account and require sign-in.',
    local: false,
    facts: [
      ['Needs', 'A Cloudflare account with a Pages project, an Access application and an API token'],
      ['Produces', 'An immutable, login-protected deployment URL per report'],
      ['Help', '<a href="~/help/cloudflare/">Set up protected publishing</a>'],
    ],
    body: `
<h2 id="use">When to use it</h2>
<p>Use it when the developer needs the screenshots, video and full timeline, not just the issue text. Publishing is also the step that makes <a href="~/features/github-issues/">one-click GitHub issues</a> possible, since each issue links to its report.</p>

<h2 id="protection">How reports are protected</h2>
<ul>
<li>Each report is a separate preview deployment with its own URL. Publishing never replaces an earlier report or your project’s production site.</li>
<li>Cloudflare Access handles sign-in using the policy you define, such as specific emails with one-time PINs or your identity provider.</li>
<li>Every deployment also includes a Pages Function that verifies the Access token’s signature, issuer, audience and expiry before serving any page, image, recording or download, and fails closed. A missing or bypassed Access rule does not expose the report.</li>
<li>Hosted pages are sanitized, run no scripts, are not cached, and serve captured files as downloads.</li>
</ul>

<h2 id="setup">Setup in brief</h2>
<p>Create a Direct Upload Pages project, protect its preview deployments with an Access application and an Allow policy, then enter the account ID, a scoped API token, the project name, the Access application ID and team domain in <b>Settings → Publishing</b>. <b>Verify Access &amp; save</b> checks the configuration. The <a href="~/help/cloudflare/">setup guide</a> has every step.</p>

<h2 id="limits">Limits and costs</h2>
<ul>
<li>Each file must be at most 25 MiB, and a report at most 20,000 files.</li>
<li>Reports use Pages Functions requests. Your Cloudflare plan’s limits and billing apply.</li>
<li><b>Unpublish report</b> deletes the deployment. It cannot recall copies readers already downloaded, and deleting the local recording does not unpublish it.</li>
<li>The extension does not set up identity providers or grant readers access for you.</li>
</ul>
`,
    help: [['Set up protected publishing', 'help/cloudflare/']],
    next: ['github-issues', 'privacy-redaction', 'export'],
  },
  {
    slug: 'privacy-redaction',
    name: 'Local storage and redaction',
    short: 'Sessions live in your browser. Secrets are masked at capture time, with honest limits.',
    title: 'Local Bug Recording and Capture-Time Redaction — Session Recorder',
    description:
      'Session Recorder stores recordings in your browser and masks auth headers, cookies, token-like fields and password inputs as they are captured. What leaves, and when.',
    h1: 'Local storage, privacy and redaction',
    lede: 'Recordings are written to your browser, not to a service we run. Data leaves only when you export it or use an integration you configured, and redaction reduces what is in it to begin with.',
    local: true,
    facts: [
      ['Storage', 'IndexedDB in your Chrome profile'],
      ['Telemetry', 'None. No analytics and no developer-operated backend.'],
      ['Policy', '<a href="~/privacy.html">Privacy policy</a>'],
    ],
    body: `
<h2 id="local">What stays local</h2>
<p>Sessions, screenshots, video, audio and drafts are stored in the browser’s IndexedDB. Deleting a session in the side panel deletes it there. Recording, annotating, markup and ZIP export never contact a server of ours, because there is none.</p>

<h2 id="leaves">What leaves, and only when you set it up</h2>
<div class="tablewrap" role="region" aria-label="Data sent by optional integrations" tabindex="0">
<table>
<thead><tr><th scope="col">Integration</th><th scope="col">What is sent</th><th scope="col">Where</th></tr></thead>
<tbody>
<tr><th scope="row">Transcription</th><td>Recorded microphone audio, including spoken annotation comments</td><td>Deepgram, OpenAI or ElevenLabs</td></tr>
<tr><th scope="row">AI summaries and names</th><td>Up to 60,000 characters of text evidence; no media</td><td>OpenAI, Anthropic, Google or your compatible endpoint</td></tr>
<tr><th scope="row">Publishing</th><td>The report, session data, transcripts and included media</td><td>Your Cloudflare Pages project</td></tr>
<tr><th scope="row">GitHub issues</th><td>Issue title, summary and report link</td><td>The repository you choose</td></tr>
<tr><th scope="row">Annotation vocabulary</th><td>A bounded excerpt of visible headings, navigation and labels (no input values, editable or hidden content); then a short term list</td><td>Your AI model; the term list to Deepgram or ElevenLabs</td></tr>
</tbody>
</table>
</div>
<p>API keys and tokens live in extension storage, separate from recordings, and are never written into exports or published reports.</p>

<h2 id="redaction">Redaction at capture time</h2>
<p>Redaction is on by default and runs before data is written to storage, so the unmasked value is never saved. By default it masks:</p>
<ul>
<li>Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token and proxy auth headers.</li>
<li>JSON and form fields whose names look like tokens, secrets, passwords, API keys, sessions, auth or credentials.</li>
<li>URL query parameters with names like those.</li>
<li>Password inputs.</li>
</ul>
<p>You can add header names, body key patterns and URL parameter patterns, or turn redaction off for a session, in capture settings.</p>

<h2 id="limits">What redaction does not do</h2>
<p>Redaction is pattern-based. It does not read screenshots, video or audio, and it cannot recognise personal data in ordinary fields, such as a customer name in a response body or an email typed into a form. Review evidence before publishing or attaching it anywhere, and use test accounts when you can.</p>
`,
    help: [],
    next: ['local-first', 'protected-publishing', 'export'],
  },
  {
    slug: 'export',
    name: 'Exports and AI handoff',
    short: 'A ZIP with Markdown, JSON and assets at four detail levels, ready for people or coding agents.',
    title: 'Export Bug Reports as Markdown for AI Coding Agents — Session Recorder',
    description:
      'Export a recorded bug as a ZIP with report.md, session.json, a manifest, transcript and assets, at Full, Standard, Compact or Minimal detail with live token estimates.',
    h1: 'Exports and AI handoff',
    lede: 'Every recording can be downloaded as a ZIP, with no account or integration. The Markdown report is written to be read by people and by coding agents like Claude Code, Cursor and Codex.',
    local: true,
    facts: [
      ['Needs', 'Nothing beyond the extension'],
      ['Produces', '<code>report.md</code>, <code>session.json</code>, <code>MANIFEST.md</code>, <code>transcript.json</code>, <code>assets/</code>'],
      ['Optional', '<code>report.html</code> and <code>openapi.json</code>'],
    ],
    body: `
<h2 id="contents">What is in the ZIP</h2>
<ul>
<li><b><code>report.md</code></b>: the timeline as Markdown, with <code>[mm:ss]</code> timestamps joining interactions, requests, console output, annotations and narration.</li>
<li><b><code>session.json</code></b>: the structured events for scripts and tools.</li>
<li><b><code>MANIFEST.md</code></b> and <b><code>transcript.json</code></b>: what is included and the narration text.</li>
<li><b><code>assets/</code></b>: screenshots, request bodies, uploaded files and, at higher levels, video and audio.</li>
<li><b><code>report.html</code></b> (optional): a standalone page with screenshots embedded, for someone who just wants to read it.</li>
<li><b><code>openapi.json</code></b> (optional): an API description inferred from observed JSON traffic when API spec capture is on.</li>
</ul>

<h2 id="levels">Detail levels</h2>
<p>Long sessions are large. Pick a level and the export panel shows an estimated token count for each, so the report fits the context window of the model you are using. Trimming is deterministic and makes no model call, and the same recording can be exported again at a different level.</p>
<div class="tablewrap" role="region" aria-label="Export detail levels" tabindex="0">
<table>
<thead><tr><th scope="col">Level</th><th scope="col">Use it for</th></tr></thead>
<tbody>
<tr><th scope="row">Full</th><td>Archiving everything, including hover events and video</td></tr>
<tr><th scope="row">Standard</th><td>A developer or agent with a large context window</td></tr>
<tr><th scope="row">Compact</th><td>Most agent handoffs; omits video and low-signal events</td></tr>
<tr><th scope="row">Minimal</th><td>Small context windows; interactions and the essentials only</td></tr>
</tbody>
</table>
</div>

<h2 id="handoff">Handing it to an agent</h2>
<p>Unzip the export inside the repository and point the agent at <code>report.md</code>. The guides for <a href="~/claude-code/">Claude Code</a>, <a href="~/cursor/">Cursor</a>, <a href="~/codex/">Codex</a> and <a href="~/chatgpt/">ChatGPT</a> include prompts that explain the timestamps. The <a href="~/example-report/">example report</a> shows the format in full.</p>

<h2 id="limits">Limits</h2>
<ul>
<li>Exports contain whatever was captured after redaction. Review them before sharing outside your team.</li>
<li>The standalone HTML report does not embed video or audio.</li>
</ul>
`,
    help: [],
    next: ['example-report', 'claude-code', 'github-issues'],
  },
];

function facts(f) {
  return `<dl class="facts">${f.facts.map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`).join('')}</dl>`;
}

function availability(f) {
  if (f.mixed) return `<p>${LOCAL} ${BYO}</p>`;
  return `<p>${f.local ? LOCAL : BYO}</p>`;
}

export function featurePages() {
  return F.map((f) => ({
    ...f,
    page: (links) => ({
      path: `features/${f.slug}/`,
      section: 'features',
      title: f.title,
      description: f.description,
      crumbs: [['Features', 'features/']],
      crumbLabel: f.name,
      llmsLabel: f.name,
      jsonld: {
        '@type': 'TechArticle',
        headline: f.h1,
        description: f.description,
        dateModified: '2026-10-25',
        author: { '@type': 'Person', name: 'Mohsen Azimi', url: 'https://azimi.me/' },
        about: { '@type': 'SoftwareApplication', name: 'Session Recorder', applicationCategory: 'DeveloperApplication' },
      },
      body: `<h1>${esc(f.h1)}</h1>
${availability(f)}
<p class="lede">${f.lede}</p>
${facts(f)}
${f.body.trim()}`,
      next: [
        ...f.help.map(([label, href]) => ({ href, label, text: 'Step-by-step setup and troubleshooting.' })),
        ...f.next.map((k) => links[k]).filter(Boolean),
      ],
    }),
  }));
}

export function featureHub(features) {
  const local = features.filter((f) => f.local || f.mixed);
  const byo = features.filter((f) => !f.local);
  const list = (items) =>
    `<ul class="index">${items
      .map((f) => `<li><a href="~/features/${f.slug}/"><b>${esc(f.name)}</b><span>${f.short}</span></a></li>`)
      .join('')}</ul>`;
  return {
    path: 'features/',
    section: 'features',
    title: 'Features: Record, Annotate and File Browser Bugs — Session Recorder',
    description:
      'Everything Session Recorder does: browser recording, live annotations, screenshots and video, voice notes, AI issue summaries, GitHub filing, protected publishing, redaction and exports.',
    crumbs: [],
    crumbLabel: 'Features',
    llmsLabel: 'All features',
    ogType: 'website',
    jsonld: {
      '@type': 'CollectionPage',
      name: 'Session Recorder features',
      hasPart: features.map((f) => ({ '@type': 'TechArticle', name: f.name, url: `https://azimi.me/session-recorder-chrome-extension/features/${f.slug}/` })),
    },
    body: `<h1>Features</h1>
<p class="lede">Session Recorder covers one workflow: record a bug, point at what is wrong, and hand it to whoever fixes it. Everything below serves that path.</p>
<h2 id="local">Works on its own</h2>
<p>These need only the extension. No account with us, no subscription, nothing sent anywhere unless you export it.</p>
${list(local)}
<h2 id="integrations">With your own accounts</h2>
<p>Configure these once with your credentials. Data goes directly to the services you choose, and their pricing and limits apply.</p>
${list(byo)}
<p>Voice notes appear in both lists: recording audio is local, and transcription uses your provider key.</p>`,
  };
}
