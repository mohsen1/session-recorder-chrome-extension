// Comparison hub and "Session Recorder vs X" pages. Vendor facts come only from
// the primary sources listed per vendor and in docs/website/COMPARISONS.md, checked
// on CHECKED. Keep vendor descriptions short and factual; put general workflow
// analysis in our own words. Never claim a vendor lacks AI or integrations.

import { esc, CHECKED } from './layout.mjs';

const cite = (url, label = 'source') => `<a class="cite" href="${url}">${label}</a>`;

const US = {
  workflow: 'Record in Chrome, annotate the live page, file a GitHub issue that links to a protected report',
  reporters: 'Internal QA, product and engineering people with the extension installed',
  where: 'Your browser; optionally your own Cloudflare Pages project and GitHub repository',
  trackers: 'GitHub issues; ZIP or protected link for anything else',
  context: 'Interactions, console, network bodies, screenshots, optional video and voice',
  ai: 'Optional, with your own OpenAI, Anthropic, Google or compatible model',
  price: 'Free (AGPL-3.0). Your model, transcription and Cloudflare usage is billed by those providers.',
  source: 'Open source',
};

const ROWS = [
  ['workflow', 'Core workflow'],
  ['reporters', 'Typical reporters'],
  ['where', 'Where reports live'],
  ['trackers', 'Issue tracker output'],
  ['context', 'Developer context'],
  ['ai', 'AI assistance'],
  ['price', `Paid pricing (checked ${CHECKED})`],
  ['source', 'Source code'],
];

const V = [
  {
    key: 'jam',
    vendor: 'Jam',
    path: 'jam-alternative/',
    title: 'Session Recorder vs Jam: Free Open-Source Jam Alternative for GitHub Bug Reports',
    description:
      'An honest comparison of Session Recorder and Jam: hosted bug-reporting workspace with integrations versus a free open-source extension that files GitHub issues from your own accounts.',
    summary: `<p>Jam is a hosted bug-reporting product. Its browser extension captures screen recordings, screenshots with annotations, console and network data, and instant replay of the last moments before a bug, then shares them through Jam’s cloud workspace and integrations. It also offers AI summaries. ${cite('https://jam.dev/pricing', 'Jam pricing')}</p>`,
    them: {
      workflow: 'Capture a bug, share a link from Jam’s workspace, send it on through integrations',
      reporters: 'Engineering, QA, product, and people outside the team via shared links',
      where: 'Jam’s cloud workspace',
      trackers: 'Built-in integrations',
      context: 'Console and network evidence, recordings, instant replay',
      ai: 'AI summaries',
      price: `Free: $0, 30 Jams per month. Team: $14 per creator per month, billed yearly. Enterprise: custom, with SAML/SSO. ${cite('https://jam.dev/pricing')}`,
      source: 'Proprietary',
    },
    pricing: `<p>Jam’s Free plan is $0 for 30 Jams per month. Team is $14 per creator per month, billed yearly. Enterprise is custom-priced and adds SAML single sign-on. Jam’s pricing page lists recording-duration limits that were inconsistent when we checked, so we do not quote them. ${cite('https://jam.dev/pricing', `jam.dev/pricing, checked ${CHECKED}`)}</p>`,
    chooseThem: [
      'Bugs come from many people, including outside your engineering team, and you want one shared place to view them.',
      'You want instant replay of what happened just before someone pressed the button.',
      'You need integrations beyond GitHub, or enterprise sign-on, without running anything yourself.',
    ],
    chooseUs: [
      'Your team files into GitHub and wants each issue to arrive already written, with a protected link to the evidence.',
      'Recordings should stay in your browser or your own Cloudflare account rather than a vendor workspace.',
      'You want to use your own AI model, or hand Markdown reports to coding agents.',
    ],
    sources: [['Jam pricing', 'https://jam.dev/pricing']],
  },
  {
    key: 'marker-io',
    vendor: 'Marker.io',
    path: 'compare/marker-io/',
    title: 'Session Recorder vs Marker.io: Visual Website Feedback or Recorded Bug Reports',
    description:
      'Compare Session Recorder and Marker.io for bug reporting: a website feedback widget for clients and UAT versus a free open-source recorder that files GitHub issues.',
    summary: `<p>Marker.io collects visual feedback through a widget on your website or a browser extension. Reporters annotate screenshots, Marker.io adds technical metadata, and issues go into your tracker. Its Team plan adds session replay, console and network logs, and more advanced integrations. It suits client feedback and user acceptance testing. ${cite('https://marker.io/pricing', 'Marker.io pricing')}</p>`,
    them: {
      workflow: 'Reporters annotate a screenshot in a website widget or extension; issues sync to your tracker',
      reporters: 'Clients, stakeholders and QA, often without an engineering account',
      where: 'Marker.io’s service and your issue tracker',
      trackers: 'Native issue tracker integrations',
      context: 'Screenshot metadata; session replay and devtools data on Team',
      ai: 'See vendor for current AI features',
      price: `Starter: $39/month billed annually or $59 monthly, 3 members. Team: $149/month billed annually or $199 monthly, 15 members. ${cite('https://help.marker.io/en/articles/14625673-plans-and-pricing')}`,
      source: 'Proprietary',
    },
    pricing: `<p>Starter costs $39 per month billed annually, or $59 month to month, and includes 3 members. Team costs $149 per month billed annually, or $199 month to month, for 15 members, and adds session replay and developer context. There is a 15-day trial. Guest and project limits differ between Marker.io’s help centre and marketing page, so check them directly. ${cite('https://help.marker.io/en/articles/14625673-plans-and-pricing', 'Marker.io plans')} ${cite('https://marker.io/pricing', `marker.io/pricing, checked ${CHECKED}`)}</p>`,
    chooseThem: [
      'Clients or non-technical stakeholders report issues on a site you build, and installing an extension is too much to ask.',
      'You run structured UAT and want feedback to flow into Jira, Linear or another tracker you already use.',
      'You want a vendor to host and administer the feedback workflow.',
    ],
    chooseUs: [
      'The reporters are your own QA and product people, and the destination is GitHub.',
      'You want full network bodies, console output and a timeline in every report rather than on a higher tier.',
      'You prefer free, open-source tooling that keeps recordings out of a third-party workspace.',
    ],
    sources: [
      ['Marker.io plans and pricing (help centre)', 'https://help.marker.io/en/articles/14625673-plans-and-pricing'],
      ['Marker.io pricing', 'https://marker.io/pricing'],
    ],
  },
  {
    key: 'bugherd',
    vendor: 'BugHerd',
    path: 'compare/bugherd/',
    title: 'Session Recorder vs BugHerd: Client Website Feedback or GitHub Bug Reports',
    description:
      'Compare Session Recorder and BugHerd: pinned website feedback and a task board for agencies and client projects versus a free open-source recorder that files GitHub issues.',
    summary: `<p>BugHerd lets reviewers pin feedback directly on a website. Each pin carries a screenshot and browser metadata, video feedback is available, and items land on a shared task board. It integrates with GitHub and other tools, has AI features, and is built around agencies reviewing sites with clients. ${cite('https://bugherd.com/pricing', 'BugHerd pricing')}</p>`,
    them: {
      workflow: 'Reviewers pin comments on the live site; the team triages them on a board',
      reporters: 'Clients, designers, project managers and QA',
      where: 'BugHerd’s hosted board',
      trackers: 'Integrations, including GitHub',
      context: 'Screenshots, browser metadata, video feedback',
      ai: 'AI features available',
      price: `Standard: $42/month billed annually or $50 monthly, 5 members. ${cite('https://bugherd.com/pricing')}`,
      source: 'Proprietary',
    },
    pricing: `<p>BugHerd Standard is $42 per month billed annually, or $50 month to month, for 5 members. Higher plans are listed on the same page. Older third-party articles quote lower prices; use the vendor page. ${cite('https://bugherd.com/pricing', `bugherd.com/pricing, checked ${CHECKED}`)}</p>`,
    chooseThem: [
      'You are an agency or web team collecting feedback from clients during site reviews.',
      'You want a shared task board where non-developers can follow what happened to their feedback.',
      'Pinning comments to a page matters more than network and console detail.',
    ],
    chooseUs: [
      'The bug is in application behaviour, and the developer needs requests, responses and console output to fix it.',
      'Your team already triages in GitHub and does not need a second board.',
      'You want reports in your own accounts and no per-member subscription.',
    ],
    sources: [['BugHerd pricing', 'https://bugherd.com/pricing']],
  },
  {
    key: 'userback',
    vendor: 'Userback',
    path: 'compare/userback/',
    title: 'Session Recorder vs Userback: Customer Feedback Platform or Focused Bug Recorder',
    description:
      'Compare Session Recorder and Userback: a customer feedback platform with widgets, surveys and session replay versus a free open-source recorder for internal bug reports to GitHub.',
    summary: `<p>Userback is a user feedback platform. A website widget and a browser extension collect annotated visual feedback; higher plans add session replay, console and network context, AI analysis and surveys. Its scope covers customer feedback as well as internal QA. ${cite('https://support.userback.io/en/articles/14730112-how-to-choose-the-right-userback-plan', 'Userback plans')}</p>`,
    them: {
      workflow: 'Collect visual feedback from users and teams through a widget or extension; manage it in Userback',
      reporters: 'Customers, beta users, clients and internal teams',
      where: 'Userback’s hosted workspace',
      trackers: 'Integrations',
      context: 'Session replay and console/network context on Business',
      ai: 'AI analysis on Business',
      price: `Free plan available. Team: $29/month billed annually or $39 monthly. Business: $79/month billed annually or $99 monthly. ${cite('https://support.userback.io/en/articles/14730112-how-to-choose-the-right-userback-plan')}`,
      source: 'Proprietary',
    },
    pricing: `<p>Userback has a free plan. Team is $29 per month billed annually, or $39 month to month. Business is $79 per month billed annually, or $99 month to month, and is the plan that includes session replay, developer context, AI analysis and surveys. ${cite('https://support.userback.io/en/articles/14730112-how-to-choose-the-right-userback-plan', `Userback plan guide, checked ${CHECKED}`)} ${cite('https://userback.io/ai-info/', 'Userback AI info')}</p>`,
    chooseThem: [
      'You want feedback from customers and beta users, not just your own team.',
      'Surveys and feature requests belong in the same tool as bug reports.',
      'You want a hosted workspace for triaging feedback across a product team.',
    ],
    chooseUs: [
      'You only need internal bug reports, and a feedback platform is more than you want to run.',
      'Network bodies and console output should be in every report, at no cost.',
      'Reports should go straight to GitHub with your own AI model and storage.',
    ],
    sources: [
      ['Userback: how to choose the right plan', 'https://support.userback.io/en/articles/14730112-how-to-choose-the-right-userback-plan'],
      ['Userback AI information', 'https://userback.io/ai-info/'],
    ],
  },
  {
    key: 'browserstack',
    vendor: 'BrowserStack Bug Capture',
    path: 'compare/browserstack-bug-capture/',
    title: 'Session Recorder vs BrowserStack Bug Capture (Bird Eats Bug)',
    description:
      'Compare Session Recorder and BrowserStack Bug Capture, formerly Bird Eats Bug: a capture tool bundled with BrowserStack plans versus a free open-source recorder that files GitHub issues.',
    summary: `<p>BrowserStack Bug Capture, previously Bird Eats Bug, records browser bugs with video, clicks, console and network logs and instant replay, and sends them to GitHub, Jira, Linear, Slack and other tools. It is now part of BrowserStack and is offered with BrowserStack plans. ${cite('https://www.browserstack.com/bug-capture', 'Bug Capture')}</p>`,
    them: {
      workflow: 'Capture a bug with replay and logs; share it and send it to your tracker',
      reporters: 'QA, developers and product teams, often already using BrowserStack',
      where: 'BrowserStack’s service',
      trackers: 'GitHub, Jira, Linear, Slack and more',
      context: 'Video, clicks, console, network, instant replay',
      ai: 'See vendor for current AI features',
      price: `Bundled with eligible BrowserStack plans; check the current package. ${cite('https://www.browserstack.com/pricing')}`,
      source: 'Proprietary',
    },
    pricing: `<p>Bug Capture is bundled with eligible BrowserStack plans rather than sold at a separate list price we could verify. Legacy Bird Eats Bug pricing pages no longer match the current offer. Check BrowserStack’s pricing page for which package includes it. ${cite('https://www.browserstack.com/pricing', `browserstack.com/pricing, checked ${CHECKED}`)} ${cite('https://birdeatsbug.com/pricing', 'Bird Eats Bug pricing')}</p>`,
    chooseThem: [
      'Your team already pays for BrowserStack and testing across real browsers and devices.',
      'You file into Jira, Linear or Slack as well as GitHub.',
      'You want instant replay and a hosted place to share captures.',
    ],
    chooseUs: [
      'You do not use BrowserStack and want a free, standalone recorder.',
      'You want reports stored in your own Cloudflare account, behind your own Access policy.',
      'Annotations should drive an AI summary from the model you choose.',
    ],
    sources: [
      ['BrowserStack Bug Capture', 'https://www.browserstack.com/bug-capture'],
      ['BrowserStack pricing', 'https://www.browserstack.com/pricing'],
      ['Bird Eats Bug pricing (legacy)', 'https://birdeatsbug.com/pricing'],
    ],
  },
];

const WORKFLOW = `
<h2 id="workflow">How the workflows differ</h2>
<p><b>Hosted workspace or your own accounts.</b> Hosted tools give everyone one place to view, comment on and route reports, with no setup beyond inviting people. Session Recorder has no workspace. Reports live in the browser that recorded them, and when you share them they go to your own Cloudflare Pages project and GitHub repository. That means a one-time setup and fewer collaboration features, in exchange for keeping the data under accounts you already control.</p>
<p><b>Who is reporting.</b> Widget-based tools let clients and customers report without installing anything. Session Recorder assumes the reporter can install a Chrome extension, which fits internal QA and product teams.</p>
<p><b>What the developer gets.</b> Session Recorder puts annotations first, then the full timeline of interactions, console output and network requests with bodies. Exports are Markdown designed for coding agents as well as people.</p>
<p><b>Cost model.</b> Paid tools charge per member, creator or plan tier. Session Recorder costs nothing, but optional AI summaries, transcription and publishing run on your provider accounts, where usage charges and limits apply.</p>`;

const NOT_US = `<p>Session Recorder does not offer a hosted shared workspace, client review boards, surveys, broad native integrations beyond GitHub, or enterprise administration such as SSO and seat management. If you need those, a hosted product is the better choice.</p>`;

function table(v) {
  return `<div class="tablewrap" role="region" aria-label="Session Recorder and ${esc(v.vendor)} compared" tabindex="0">
<table class="comparison-table">
<thead><tr><th scope="col"><span class="vh">Aspect</span></th><th scope="col">Session Recorder</th><th scope="col">${esc(v.vendor)}</th></tr></thead>
<tbody>
${ROWS.map(([k, label]) => `<tr><th scope="row">${label}</th><td><span class="cell-label" aria-hidden="true">Session Recorder</span>${US[k]}</td><td><span class="cell-label" aria-hidden="true">${esc(v.vendor)}</span>${v.them[k]}</td></tr>`).join('\n')}
</tbody>
</table>
</div>`;
}

export function comparePages() {
  return V.map((v) => ({
    ...v,
    navLabel: `vs ${v.vendor}`,
    short: v.chooseThem[0].replace(/\.$/, '') + ': consider ' + v.vendor + '.',
    page: (links) => ({
      path: v.path,
      section: 'compare',
      title: v.title,
      description: v.description,
      crumbs: [['Compare', 'compare/']],
      crumbLabel: `vs ${v.vendor}`,
      llmsLabel: `Session Recorder vs ${v.vendor}`,
      jsonld: {
        '@type': 'Article',
        headline: `Session Recorder vs ${v.vendor}`,
        description: v.description,
        dateModified: '2026-10-25',
        author: { '@type': 'Person', name: 'Mohsen Azimi', url: 'https://azimi.me/' },
      },
      body: `<h1>Session Recorder vs ${esc(v.vendor)}</h1>
<p class="lede">Both help a developer see a bug they did not witness. They make different assumptions about who reports, where reports live and what you pay for. Prices and plans were checked on ${CHECKED}.</p>
<h2 id="short">The short answer</h2>
<p><b>Choose ${esc(v.vendor)} if:</b></p>
<ul>${v.chooseThem.map((x) => `<li>${x}</li>`).join('')}</ul>
<p><b>Choose Session Recorder if:</b></p>
<ul>${v.chooseUs.map((x) => `<li>${x}</li>`).join('')}</ul>
<h2 id="vendor">About ${esc(v.vendor)}</h2>
${v.summary}
<h2 id="table">Side by side</h2>
${table(v)}
<h2 id="pricing">Pricing</h2>
${v.pricing}
<p>Session Recorder is free and open source under the AGPL-3.0, with no plan tiers. Optional integrations use your own accounts: model providers and transcription services bill usage, and published reports use Cloudflare Pages Functions, where your Cloudflare plan’s limits and billing apply.</p>
${WORKFLOW}
<h2 id="not">What Session Recorder does not do</h2>
${NOT_US}
<h2 id="sources">Sources</h2>
<ul class="sources">${v.sources.map(([l, u]) => `<li><a href="${u}">${l}</a>, checked ${CHECKED}</li>`).join('')}<li><a href="~/features/">Session Recorder features</a> and <a href="https://github.com/prooflinedev/session-recorder-chrome-extension">source code</a></li></ul>
<p>Vendors change plans often. If something here is out of date, <a href="https://github.com/prooflinedev/session-recorder-chrome-extension/issues">open an issue</a> and we will correct it.</p>`,
      next: [links['github-issues'], links['protected-publishing'], { href: 'compare/', label: 'All comparisons', text: 'Jam, Marker.io, BugHerd, Userback and BrowserStack Bug Capture.' }],
    }),
  }));
}

export function compareHub(vs) {
  const priceShort = {
    jam: 'Free tier; Team $14 per creator/month, billed yearly',
    'marker-io': 'From $39/month billed annually (3 members)',
    bugherd: 'From $42/month billed annually (5 members)',
    userback: 'Free plan; Team $29/month billed annually',
    browserstack: 'Bundled with eligible BrowserStack plans',
  };
  const fit = {
    jam: 'Teams sharing bug captures across a hosted workspace and integrations',
    'marker-io': 'Client feedback and UAT into an existing tracker',
    bugherd: 'Agencies reviewing websites with clients',
    userback: 'Customer feedback, surveys and replay in one platform',
    browserstack: 'Teams already on BrowserStack',
  };
  return {
    path: 'compare/',
    section: 'compare',
    title: 'Bug Reporting Tools Compared: Jam, Marker.io, BugHerd, Userback, BrowserStack — Session Recorder',
    description:
      'Honest comparisons of Session Recorder with Jam, Marker.io, BugHerd, Userback and BrowserStack Bug Capture: who each suits, workflow differences and current paid pricing.',
    crumbs: [],
    crumbLabel: 'Compare',
    llmsLabel: 'All comparisons',
    ogType: 'website',
    body: `<h1>Compare bug reporting tools</h1>
<p class="lede">Several good paid tools capture browser bugs. Most are hosted workspaces with integrations and team features. Session Recorder is a free, open-source extension that files GitHub issues using your own accounts. Here is where each one fits.</p>
<div class="tablewrap" role="region" aria-label="Tools at a glance" tabindex="0">
<table class="comparison-table">
<thead><tr><th scope="col">Tool</th><th scope="col">Best fit</th><th scope="col">Entry paid pricing</th></tr></thead>
<tbody>
<tr><th scope="row">Session Recorder</th><td><span class="cell-label" aria-hidden="true">Best fit</span>Internal QA and product teams filing into GitHub</td><td><span class="cell-label" aria-hidden="true">Entry paid pricing</span>Free; your own AI and Cloudflare usage may cost</td></tr>
${vs.map((v) => `<tr><th scope="row"><a href="~/${v.path}">${esc(v.vendor)}</a></th><td><span class="cell-label" aria-hidden="true">Best fit</span>${fit[v.key]}</td><td><span class="cell-label" aria-hidden="true">Entry paid pricing</span>${priceShort[v.key]}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
<p class="updated">Prices from each vendor’s own pages, checked ${CHECKED}. Each comparison links its sources.</p>
<h2 id="pages">Comparisons</h2>
<ul class="index">${vs.map((v) => `<li><a href="~/${v.path}"><b>Session Recorder vs ${esc(v.vendor)}</b><span>${fit[v.key]}.</span></a></li>`).join('')}</ul>
${WORKFLOW}
<h2 id="not">What Session Recorder does not do</h2>
${NOT_US}`,
    next: [],
  };
}
