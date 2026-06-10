#!/usr/bin/env node
// Wave-2 evidence capture — walks every restyled editor surface in REAL
// Chrome (Metal GPU, WebGPU on) and saves frames to
// notes/verification/ui-design/. Resilient: each step is try/catch'd and
// logs; a missed step never aborts the run.
//
// Usage: node scripts/ui-design-capture-wave2.mjs [--port 4860]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ui-design');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = getArg('port', '4860');
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

const consoleErrors = [];
async function newPage(viewport, isMobile = false) {
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
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

// ---------- DESKTOP ----------
const page = await newPage({ width: 1680, height: 1100 });

// 1. boot loading shell (best effort — races the .prism load)
await step('boot-loading', async () => {
  await page.goto(BASE, { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(250);
  await shot(page, 'wave2d-boot-loading');
});

// 2. preview-app default boot
await step('preview-app', async () => {
  await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, 'wave2d-preview-app');
});

// 3. galaxy mode (2E retint + TopBar + toggle)
await step('galaxy', async () => {
  await page.click('button:has-text("Galaxy")', { timeout: 8000 });
  await page.waitForTimeout(2000);
  await shot(page, 'wave2e-galaxy');
});

// 4. galaxy filter dock open
await step('galaxy-filter', async () => {
  await page.click('[title="Open filter"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  await shot(page, 'wave2c-galaxy-filter');
  await page.click('[title="Close filter"]', { timeout: 3000 }).catch(() => {});
});

// 5. search palette (Cmd+K) with results
await step('search-palette', async () => {
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(400);
  await page.keyboard.type('a');
  await page.waitForTimeout(500);
  await shot(page, 'wave2c-search-palette');
});

// 6. select first result -> Inspector
await step('inspector', async () => {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await shot(page, 'wave2b-inspector');
});

// 7. close inspector -> DetailCard (selected node, inspector closed)
await step('detail-card', async () => {
  const closeBtn = page.locator('[title="Close inspector"]').first();
  await closeBtn.click({ timeout: 4000 });
  await page.waitForTimeout(600);
  await shot(page, 'wave2c-detail-card');
});

// 8. canvas mode (2A dock + TopBar + minimap + hub nav)
await step('canvas', async () => {
  await page.click('button:has-text("Canvas")', { timeout: 8000 });
  await page.waitForTimeout(2500);
  await shot(page, 'wave2a-canvas-toolbar');
});

// 9. dump toolbar group titles, open first flyout (hero refract) + keyframe shell
await step('toolbar-flyout', async () => {
  const titles = await page.$$eval('button[title]', (els) => els.map((e) => e.getAttribute('title')).filter(Boolean));
  console.log(`  toolbar/button titles: ${[...new Set(titles)].slice(0, 40).join(' | ')}`);
  const groups = titles.filter((t) => /light|keyframe|anim|build|material|layout|element/i.test(t));
  const target = groups.find((t) => /light/i.test(t)) || groups[0];
  if (!target) throw new Error('no group button found');
  await page.click(`button[title="${target}"]`, { timeout: 4000 });
  await page.waitForTimeout(700);
  await shot(page, 'wave2a-toolbar-flyout');
  const kf = titles.find((t) => /keyframe|timeline|anim/i.test(t));
  if (kf && kf !== target) {
    await page.click(`button[title="${kf}"]`, { timeout: 4000 });
    await page.waitForTimeout(700);
    await shot(page, 'wave2a-keyframe-shell');
  }
});

// 10. Add Node dialog
await step('add-node', async () => {
  await page.click('button:has-text("Add Node")', { timeout: 5000 });
  await page.waitForTimeout(600);
  await shot(page, 'wave2c-add-node');
  await page.keyboard.press('Escape');
});

const tier = await page.evaluate(() => document.documentElement.dataset.dsTier).catch(() => '?');
await page.close();

// ---------- MOBILE (390x844) ----------
const mob = await newPage({ width: 390, height: 844 }, true);

await step('mobile preview-app', async () => {
  await mob.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await mob.waitForTimeout(2500);
  await shot(mob, 'wave2d-preview-app-mobile');
});

// The mobile branch renders no mode toggle (pre-existing gap) — switch
// modes at desktop width, then resize down; isDesktop flips reactively
// while the store's viewMode persists.
await step('mobile canvas', async () => {
  await mob.setViewportSize({ width: 1680, height: 1100 });
  await mob.waitForTimeout(400);
  await mob.click('button:has-text("Canvas")', { timeout: 8000 });
  await mob.waitForTimeout(1500);
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.waitForTimeout(1500);
  await shot(mob, 'wave2a-canvas-toolbar-mobile');
});

await step('mobile inspector', async () => {
  await mob.keyboard.press('Meta+k');
  await mob.waitForTimeout(400);
  await mob.keyboard.type('a');
  await mob.waitForTimeout(500);
  await mob.keyboard.press('Enter');
  await mob.waitForTimeout(1200);
  await shot(mob, 'wave2b-inspector-mobile');
});

await mob.close();
await browser.close();

console.log(`\ntier=${tier} · consoleErrors=${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 10).map((e) => `  · ${e.slice(0, 200)}`).join('\n'));
