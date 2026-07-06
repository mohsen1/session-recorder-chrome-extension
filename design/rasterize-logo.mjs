/**
 * Regenerate every logo raster from design/logo.svg (the single source).
 * Run: node design/rasterize-logo.mjs   (uses the Playwright Chromium already
 * installed for the E2E suite; renders the SVG with a transparent background).
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'design/logo.svg'), 'utf8');

const targets = {
  'public/icon/16.png': 16,
  'public/icon/32.png': 32,
  'public/icon/48.png': 48,
  'public/icon/96.png': 96,
  'public/icon/128.png': 128,
  'design/logo.png': 512,
  'design/logo-256.png': 256,
  'website/logo.png': 256,
};

const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
for (const [rel, size] of Object.entries(targets)) {
  await page.setViewportSize({ width: size, height: size });
  const scaled = svg.replace(
    'width="128" height="128"',
    `width="${size}" height="${size}"`,
  );
  await page.setContent(`<body style="margin:0">${scaled}</body>`, {
    waitUntil: 'load',
  });
  await page.locator('svg').screenshot({
    path: path.join(root, rel),
    omitBackground: true,
  });
  console.log('wrote', rel, `${size}px`);
}
await browser.close();
