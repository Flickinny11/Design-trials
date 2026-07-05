#!/usr/bin/env node
// UI-FIDELITY-2 W1 evidence — pilot rendered-chrome shots at DPR2 with zoom
// crops (the run's evidence bar). Captures the dock (brushed metal), flyout
// (refractive glass), TopBar, Inspector, plus pointer-hover states so the
// pointer light + magnetic border glow are visible in stills.
//
// Usage: node scripts/fidelity2-w1-capture.mjs [--port 4870] [--outdir w1-after]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = getArg('port', '4870');
const OUTDIR = getArg('outdir', 'w1-after');
const outDir = join(repoRoot, 'notes', 'verification', 'fidelity2', OUTDIR);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = async (name, clip) => {
  await page.screenshot({ path: join(outDir, `${name}.png`), clip });
  console.log(`✓ ${name}.png${clip ? ` (crop ${clip.width}x${clip.height}@2x)` : ''}`);
};
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log(`✗ ${label}: ${e.message.split('\n')[0]}`); } };

await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(4000);

// canvas mode → dock + transform flyout
await step('canvas', async () => {
  await page.click('button:has-text("Canvas")', { timeout: 8000 });
  await page.waitForTimeout(3500);
  await shot('w1-canvas-full');
});

// rect helpers
const rectOf = async (sel) => {
  const el = page.locator(sel).first();
  const b = await el.boundingBox();
  return b;
};

await step('dock-crop', async () => {
  const b = await rectOf('[data-component="canvas-toolbar"]');
  if (!b) throw new Error('no toolbar rect');
  // pointer parked away — static state
  await page.mouse.move(1400, 900);
  await page.waitForTimeout(600);
  await shot('w1-dock-static-zoom', { x: Math.max(0, b.x - 12), y: b.y + 40, width: 110, height: 360 });
  // hover the dock — pointer light + magnetic band
  await page.mouse.move(b.x + 30, b.y + b.height / 2);
  await page.waitForTimeout(700);
  await shot('w1-dock-hover-zoom', { x: Math.max(0, b.x - 12), y: b.y + 40, width: 110, height: 360 });
});

await step('flyout-crop', async () => {
  const b = await rectOf('[data-component="canvas-toolbar-flyout"]');
  if (!b) throw new Error('no flyout rect');
  await page.mouse.move(b.x + b.width / 2, b.y + 60);
  await page.waitForTimeout(700);
  await shot('w1-flyout-hover-zoom', { x: b.x - 20, y: b.y - 16, width: Math.min(320, b.width + 40), height: 320 });
  // edge detail: top-left corner ultra-zoom
  await shot('w1-flyout-corner-ultra', { x: b.x - 14, y: b.y - 14, width: 120, height: 120 });
});

await step('topbar-crop', async () => {
  await page.mouse.move(500, 28);
  await page.waitForTimeout(700);
  await shot('w1-topbar-hover-zoom', { x: 0, y: 0, width: 760, height: 64 });
});

// Inspector (glass hero): select a node via search
await step('inspector', async () => {
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(400);
  await page.keyboard.type('headline');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await shot('w1-inspector-full');
  const b = await rectOf('[data-component="top-bar"]'); // anchor for width
  const vw = 1680;
  await page.mouse.move(vw - 230, 300);
  await page.waitForTimeout(700);
  await shot('w1-inspector-edge-zoom', { x: vw - 480, y: 60, width: 480, height: 420 });
});

const tier = await page.evaluate(() => document.documentElement.dataset.dsTier).catch(() => '?');
const backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? '?').catch(() => '?');
console.log(`\ntier=${tier} · backend=${backend} · consoleErrors=${errors.length}`);
if (errors.length) console.log(errors.slice(0, 6).map((e) => `  · ${e.slice(0, 200)}`).join('\n'));
await browser.close();
