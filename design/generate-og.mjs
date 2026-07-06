/**
 * Generate the website's Open Graph / Twitter share image.
 *
 * Renders a branded 1200x630 card with Playwright (already a dev dep) and writes
 * it to website/og-image.png. Assets are inlined as data URLs so the render is
 * self-contained. Re-run after changing the logo, screenshots, or copy:
 *
 *   node design/generate-og.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataUrl = (rel, mime) =>
  `data:${mime};base64,${readFileSync(path.join(root, rel)).toString('base64')}`;

const logo = dataUrl('website/logo.png', 'image/png');
const shot = dataUrl('website/shots/02-recording.png', 'image/png');

const html = `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Inter, system-ui, sans-serif;
    background:
      radial-gradient(1100px 600px at 88% -10%, rgba(255, 90, 77, 0.14), transparent 60%),
      #f7f7f5;
    color: #16181d;
    display: flex;
    align-items: center;
    padding: 78px;
    overflow: hidden;
    position: relative;
  }
  .copy { width: 620px; flex: 0 0 auto; }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
  .brand img { width: 46px; height: 46px; }
  .brand span { font-size: 27px; font-weight: 650; letter-spacing: -0.01em; }
  h1 {
    font-size: 62px;
    line-height: 1.06;
    letter-spacing: -0.035em;
    font-weight: 700;
  }
  h1 .hl { color: #ff5a4d; }
  p {
    margin-top: 26px;
    font-size: 25px;
    line-height: 1.42;
    color: #3b3f47;
    max-width: 560px;
  }
  .url {
    position: absolute;
    left: 78px;
    bottom: 62px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 19px;
    color: #767b85;
  }
  .shot {
    position: absolute;
    right: -120px;
    top: 96px;
    width: 620px;
    border-radius: 18px;
    border: 1px solid #e7e7e3;
    box-shadow: 0 40px 90px rgba(22, 24, 29, 0.28);
    transform: perspective(1600px) rotateY(-19deg) rotateX(5deg) rotate(-1deg);
  }
</style></head>
<body>
  <div class="copy">
    <div class="brand"><img src="${logo}" alt="" /><span>Session Recorder</span></div>
    <h1>Record a bug.<br /><span class="hl">Hand your agent the whole story.</span></h1>
    <p>Clicks, network, errors, screenshots, and voice — exported as one clean report your AI coding agent can read.</p>
  </div>
  <img class="shot" src="${shot}" alt="" />
  <div class="url">github.com/mohsen1/session-recorder-chrome-extension</div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: 'networkidle' });
await page.screenshot({
  path: path.join(root, 'website/og-image.png'),
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
console.log('Wrote website/og-image.png');
