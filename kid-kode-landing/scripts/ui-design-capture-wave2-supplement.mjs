#!/usr/bin/env node
// Wave-2 supplemental captures: detail card, expanded keyframe tracks,
// add-node dialog, throttled boot shell. JS-click fallbacks where
// Playwright actionability is too strict.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ui-design');
mkdirSync(outDir, { recursive: true });
const PORT = process.argv[2] || '4860';
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const shot = async (p, n) => { await p.screenshot({ path: join(outDir, `${n}.png`) }); console.log(`✓ ${n}.png`); };
const jsClick = (p, sel) => p.evaluate((s) => {
  const el = [...document.querySelectorAll('button')].find((b) => b.matches(s) || b.textContent.includes(s));
  if (!el) return `no match for ${s}`;
  el.click(); return 'clicked';
}, sel);
const step = async (label, fn) => { try { await fn(); } catch (e) { console.log(`✗ ${label}: ${e.message.split('\n')[0]}`); } };

// throttled boot shell first (fresh page, cold-ish)
await step('boot throttled', async () => {
  const p = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 400 * 1024, uploadThroughput: 200 * 1024 });
  await p.goto(BASE, { waitUntil: 'commit', timeout: 90000 });
  await p.waitForTimeout(1600);
  await shot(p, 'wave2d-boot-loading');
  await p.close();
});

const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2000);

// galaxy, select node, close inspector -> DetailCard
await step('detail-card', async () => {
  await page.click('button:has-text("Galaxy")');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Meta+k'); await page.waitForTimeout(350);
  await page.keyboard.type('a'); await page.waitForTimeout(350);
  await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  console.log('  close:', await page.evaluate(() => {
    const el = document.querySelector('[title="Close inspector"]');
    if (!el) return 'not found';
    el.click(); return 'clicked';
  }));
  await page.waitForTimeout(700);
  await shot(page, 'wave2c-detail-card');
});

// canvas -> Animation flyout -> expand Keyframe Editor
await step('keyframe-tracks', async () => {
  await page.click('button:has-text("Canvas")');
  await page.waitForTimeout(2000);
  console.log('  anim:', await jsClick(page, 'button[title="Animation"]'));
  await page.waitForTimeout(600);
  console.log('  kf:', await jsClick(page, 'Keyframe Editor'));
  await page.waitForTimeout(800);
  await shot(page, 'wave2a-keyframe-tracks');
  await page.keyboard.press('Escape');
});

// Add Node dialog
await step('add-node', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  console.log('  add:', await jsClick(page, 'Add Node'));
  await page.waitForTimeout(700);
  await shot(page, 'wave2c-add-node');
  await page.keyboard.press('Escape');
});

await page.close();
await browser.close();
