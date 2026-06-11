#!/usr/bin/env node
// UI-FIDELITY-2 BASELINE capture — the "before" evidence. Walks every editor
// chrome surface in REAL Chrome (Metal GPU, WebGPU on) at deviceScaleFactor 2
// (the run's evidence bar: every before/after judged at DPR 2) and saves
// frames to notes/verification/fidelity2/baseline/.
//
// Usage: node scripts/fidelity2-baseline.mjs [--port 4870] [--outdir baseline]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = getArg('port', '4870');
const OUTDIR = getArg('outdir', 'baseline');
const BASE = `http://localhost:${PORT}`;

const outDir = join(repoRoot, 'notes', 'verification', 'fidelity2', OUTDIR);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

const consoleErrors = [];
async function newPage(viewport, isMobile = false) {
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${isMobile ? 'mobile' : 'desktop'}] ${m.text()}`); });
  return page;
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

async function step(label, fn) {
  try { await fn(); } catch (e) { console.log(`✗ ${label}: ${e.message.split('\n')[0]}`); }
}

// ---------- DESKTOP (DPR 2) ----------
const page = await newPage({ width: 1680, height: 1100 });

await step('boot-loading', async () => {
  await page.goto(BASE, { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(250);
  await shot(page, 'before-boot-loading');
});

await step('preview-app', async () => {
  await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, 'before-preview-app');
});

await step('galaxy', async () => {
  await page.click('button:has-text("Galaxy")', { timeout: 8000 });
  await page.waitForTimeout(2000);
  await shot(page, 'before-galaxy');
});

await step('galaxy-filter', async () => {
  await page.click('[title="Open filter"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await shot(page, 'before-galaxy-filter');
  await page.click('[title="Close filter"]', { timeout: 3000 }).catch(() => {});
});

await step('search-palette', async () => {
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(400);
  await page.keyboard.type('a');
  await page.waitForTimeout(500);
  await shot(page, 'before-search-palette');
});

await step('inspector', async () => {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await shot(page, 'before-inspector');
});

await step('detail-card', async () => {
  const closeBtn = page.locator('[title="Close inspector"]').first();
  await closeBtn.click({ timeout: 4000 });
  await page.waitForTimeout(600);
  await shot(page, 'before-detail-card');
});

await step('canvas', async () => {
  await page.click('button:has-text("Canvas")', { timeout: 8000 });
  await page.waitForTimeout(2500);
  await shot(page, 'before-canvas-toolbar');
});

await step('toolbar-flyout+keyframe', async () => {
  const titles = await page.$$eval('button[title]', (els) => els.map((e) => e.getAttribute('title')).filter(Boolean));
  console.log(`  toolbar/button titles: ${[...new Set(titles)].slice(0, 40).join(' | ')}`);
  const groups = titles.filter((t) => /light|keyframe|anim|build|material|layout|element|text|image|object/i.test(t));
  const target = groups.find((t) => /light/i.test(t)) || groups[0];
  if (!target) throw new Error('no group button found');
  await page.click(`button[title="${target}"]`, { timeout: 4000 });
  await page.waitForTimeout(700);
  await shot(page, 'before-toolbar-flyout');
  const kf = titles.find((t) => /keyframe|timeline/i.test(t));
  if (kf && kf !== target) {
    await page.click(`button[title="${kf}"]`, { timeout: 4000 });
    await page.waitForTimeout(700);
    await shot(page, 'before-keyframe-shell');
  }
});

await step('animation-catalog', async () => {
  const titles = await page.$$eval('button[title]', (els) => els.map((e) => e.getAttribute('title')).filter(Boolean));
  const anim = titles.find((t) => /anim/i.test(t));
  if (!anim) throw new Error('no animation button');
  await page.click(`button[title="${anim}"]`, { timeout: 4000 });
  await page.waitForTimeout(800);
  // catalog gallery may need a second click ("Browse"/"Catalog")
  const browse = page.locator('button:has-text("Catalog"), button:has-text("Browse")').first();
  await browse.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, 'before-animation-catalog');
  await page.keyboard.press('Escape');
});

await step('add-node', async () => {
  await page.click('button:has-text("Add Node")', { timeout: 5000 });
  await page.waitForTimeout(600);
  await shot(page, 'before-add-node');
  await page.keyboard.press('Escape');
});

const tier = await page.evaluate(() => document.documentElement.dataset.dsTier).catch(() => '?');
const backend = await page.evaluate(() => window.__prismRig?.backend ?? document.querySelector('canvas')?.dataset?.backend ?? '?').catch(() => '?');
await page.close();

// ---------- MOBILE (390x844, DPR 2) ----------
const mob = await newPage({ width: 390, height: 844 }, true);

await step('mobile preview-app', async () => {
  await mob.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await mob.waitForTimeout(2500);
  await shot(mob, 'before-preview-app-mobile');
});

await step('mobile canvas', async () => {
  await mob.setViewportSize({ width: 1680, height: 1100 });
  await mob.waitForTimeout(400);
  await mob.click('button:has-text("Canvas")', { timeout: 8000 });
  await mob.waitForTimeout(1500);
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.waitForTimeout(1500);
  await shot(mob, 'before-canvas-toolbar-mobile');
});

await mob.close();
await browser.close();

console.log(`\ntier=${tier} · backend=${backend} · consoleErrors=${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 10).map((e) => `  · ${e.slice(0, 200)}`).join('\n'));
