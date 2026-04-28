#!/usr/bin/env node
// One-shot Playwright capture of the live production deployment.
// Saves a full screenshot to notes/ralph-snapshots/post-ralph-fix-up/live.png
// and a JSON sidecar with the deployment URL, commit, and capture timestamp.
//
// Run: node notes/ralph-snapshots/post-ralph-fix-up/capture.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.LIVE_URL ?? 'https://kid-kode-ai-landing.vercel.app/';
const COMMIT = process.env.COMMIT ?? '70a500e';

mkdirSync(__dirname, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

console.log(`[live-capture] navigating to ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(8000); // give the .prism runtime + 3D scene time to converge
const screenshotPath = join(__dirname, 'live.png');
await page.screenshot({ path: screenshotPath, fullPage: false });

const sidecar = {
  capturedAt: new Date().toISOString(),
  url: URL,
  commit: COMMIT,
  screenshot: 'live.png',
  pageErrors: errors,
};
writeFileSync(join(__dirname, 'capture.json'), JSON.stringify(sidecar, null, 2));

await browser.close();
console.log(`[live-capture] saved ${screenshotPath}`);
console.log(`[live-capture] page errors: ${errors.length}`);
if (errors.length) console.log(errors.map((e) => '  ' + e).join('\n'));
