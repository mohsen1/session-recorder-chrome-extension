/**
 * Generate branded Chrome Web Store screenshots (1280x800 each).
 *
 * Composes each product screenshot onto a clean, branded tile with a short
 * caption, rendered with Playwright (already a dev dep). Assets are inlined as
 * data URLs so the render is self-contained. Output: design/store/0N-<name>.png.
 *
 *   node design/generate-store.mjs   (or: pnpm store)
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataUrl = (rel, mime) =>
  `data:${mime};base64,${readFileSync(path.join(root, rel)).toString('base64')}`;

const logo = dataUrl('website/logo.png', 'image/png');

// The store shows one theme, so we use the light captures.
const TILES = [
  {
    out: '01-record.png',
    shot: 'docs/screenshots/record-light.png',
    lead: 'Record any tab',
    accent: 'in one click.',
  },
  {
    out: '02-recording.png',
    shot: 'docs/screenshots/recording-light.png',
    lead: 'Clicks, network, errors, voice —',
    accent: 'one timeline.',
  },
  {
    out: '03-annotate.png',
    shot: 'docs/screenshots/annotate-light.png',
    lead: 'Point right',
    accent: 'at the problem.',
  },
  {
    out: '04-export.png',
    shot: 'docs/screenshots/report-light.png',
    lead: 'One clean report',
    accent: 'your agent can read.',
  },
];

function html(tile) {
  const shot = dataUrl(tile.shot, 'image/png');
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 800px; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Inter, system-ui, sans-serif;
    background:
      radial-gradient(900px 500px at 92% -12%, rgba(255, 90, 77, 0.16), transparent 60%),
      #f7f7f5;
    color: #16181d;
    display: flex;
    flex-direction: column;
    padding: 44px 56px 0;
    overflow: hidden;
  }
  header { display: flex; align-items: center; gap: 11px; margin-bottom: 18px; }
  header img { width: 30px; height: 30px; }
  header span { font-size: 19px; font-weight: 650; letter-spacing: -0.01em; }
  h1 {
    font-size: 40px;
    line-height: 1.12;
    letter-spacing: -0.03em;
    font-weight: 700;
    max-width: 1000px;
  }
  h1 .hl { color: #ff5a4d; }
  .frame {
    margin-top: 30px;
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .frame img {
    width: 100%;
    max-height: 100%;
    object-fit: cover;
    object-position: top center;
    border-radius: 14px 14px 0 0;
    border: 1px solid #e7e7e3;
    border-bottom: none;
    box-shadow: 0 30px 70px rgba(22, 24, 29, 0.22);
  }
</style></head>
<body>
  <header><img src="${logo}" alt="" /><span>Session Recorder</span></header>
  <h1>${tile.lead} <span class="hl">${tile.accent}</span></h1>
  <div class="frame"><img src="${shot}" alt="" /></div>
</body></html>`;
}

/** Marquee promo (1400x560): headline left, tilted screenshot bleeding off right. */
function marqueeHtml() {
  const shot = dataUrl('docs/screenshots/report-light.png', 'image/png');
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1400px; height: 560px; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Inter, system-ui, sans-serif;
    background:
      radial-gradient(900px 500px at 92% -10%, rgba(255, 90, 77, 0.16), transparent 60%),
      #f7f7f5;
    color: #16181d;
    display: flex; align-items: center; padding: 70px; overflow: hidden; position: relative;
  }
  .copy { width: 620px; flex: 0 0 auto; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; }
  .brand img { width: 38px; height: 38px; }
  .brand span { font-size: 22px; font-weight: 650; letter-spacing: -0.01em; }
  h1 { font-size: 52px; line-height: 1.08; letter-spacing: -0.035em; font-weight: 700; }
  h1 .hl { color: #ff5a4d; }
  p { margin-top: 20px; font-size: 21px; line-height: 1.4; color: #3b3f47; max-width: 540px; }
  .shot {
    position: absolute; right: -110px; top: 78px; width: 640px;
    border-radius: 16px; border: 1px solid #e7e7e3;
    box-shadow: 0 40px 90px rgba(22, 24, 29, 0.26);
    transform: perspective(1500px) rotateY(-18deg) rotateX(5deg) rotate(-1deg);
  }
</style></head>
<body>
  <div class="copy">
    <div class="brand"><img src="${logo}" alt="" /><span>Session Recorder</span></div>
    <h1>Record a bug.<br /><span class="hl">Hand your agent<br />the whole story.</span></h1>
    <p>Clicks, network, errors, screenshots, and voice — one report your AI coding agent can read.</p>
  </div>
  <img class="shot" src="${shot}" alt="" />
</body></html>`;
}

/** Small promo (440x280): logo + wordmark + one line, no screenshot. */
function smallHtml() {
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 440px; height: 280px; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Inter, system-ui, sans-serif;
    background:
      radial-gradient(400px 240px at 100% 0%, rgba(255, 90, 77, 0.18), transparent 62%),
      #f7f7f5;
    color: #16181d;
    display: flex; flex-direction: column; justify-content: center;
    padding: 34px; overflow: hidden;
  }
  .brand { display: flex; align-items: center; gap: 11px; margin-bottom: 16px; }
  .brand img { width: 40px; height: 40px; }
  .brand span { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
  p { font-size: 20px; line-height: 1.3; color: #3b3f47; }
  p .hl { color: #ff5a4d; font-weight: 600; }
</style></head>
<body>
  <div class="brand"><img src="${logo}" alt="" /><span>Session Recorder</span></div>
  <p>Record a bug. <span class="hl">Hand your agent the whole story.</span></p>
</body></html>`;
}

const browser = await chromium.launch({ channel: 'chromium' });

for (const tile of TILES) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html(tile), { waitUntil: 'networkidle' });
  await page.screenshot({
    path: path.join(root, 'design/store', tile.out),
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  await page.close();
  console.log('Wrote design/store/' + tile.out);
}

const promos = [
  { out: 'promo-marquee-1400x560.jpg', w: 1400, h: 560, content: marqueeHtml() },
  { out: 'promo-small-440x280.jpg', w: 440, h: 280, content: smallHtml() },
];
for (const promo of promos) {
  const page = await browser.newPage({
    viewport: { width: promo.w, height: promo.h },
    deviceScaleFactor: 1,
  });
  await page.setContent(promo.content, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: path.join(root, 'design/store', promo.out),
    type: 'jpeg',
    quality: 92,
    clip: { x: 0, y: 0, width: promo.w, height: promo.h },
  });
  await page.close();
  console.log('Wrote design/store/' + promo.out);
}

await browser.close();
