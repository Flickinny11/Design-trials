#!/usr/bin/env node
// UI-design evidence capture — screenshots an editor route in REAL Chrome
// (Metal GPU, WebGPU on) at a desktop and/or mobile viewport, with optional
// hover/click steps. Used by the UI design overhaul waves.
//
// Usage:
//   node scripts/ui-design-screenshot.mjs --url /design-system --out wave0-token-sheet \
//     [--port 4860] [--full] [--mobile] [--hover SELECTOR] [--click SELECTOR] \
//     [--wait MS] [--settle MS]
// Writes notes/verification/ui-design/<out>.png (+ <out>-mobile.png with --mobile)
// and prints console-error count (non-zero exit on page crash only).

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ui-design');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const hasFlag = (k) => args.includes(`--${k}`);

const PORT = getArg('port', '4860');
const URL_PATH = getArg('url', '/');
const OUT = getArg('out', 'shot');
const HOVER = getArg('hover', '');
const CLICK = getArg('click', '');
const WAIT = parseInt(getArg('wait', '1500'), 10);
const SETTLE = parseInt(getArg('settle', '400'), 10);
const FULL = hasFlag('full');
const MOBILE = hasFlag('mobile');

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

async function capture(viewport, suffix, isMobile) {
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}${URL_PATH}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(WAIT);
  if (CLICK) { await page.click(CLICK, { timeout: 5000 }).catch((e) => console.log(`click failed: ${e.message}`)); await page.waitForTimeout(SETTLE); }
  if (HOVER) { await page.hover(HOVER, { timeout: 5000 }).catch((e) => console.log(`hover failed: ${e.message}`)); await page.waitForTimeout(SETTLE); }
  await page.screenshot({ path: join(outDir, `${OUT}${suffix}.png`), fullPage: FULL });
  const tier = await page.evaluate(() => document.documentElement.dataset.dsTier).catch(() => '?');
  console.log(`${OUT}${suffix}.png · tier=${tier} · consoleErrors=${errors.length}${errors.length ? ' :: ' + errors.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}

await capture({ width: 1680, height: 1100 }, '', false);
if (MOBILE) await capture({ width: 390, height: 844 }, '-mobile', true);
await browser.close();
