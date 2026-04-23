#!/usr/bin/env node
// One-shot live smoke: point Playwright at the production Vercel URL and confirm
// the mock-app pane renders (no PRISM BOOT FAILED, canvas present, __prism handle
// installed). Screenshot saved to notes/browser-smoke/live-vercel.png.

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const artifactsDir = join(repoRoot, 'notes', 'browser-smoke');
mkdirSync(artifactsDir, { recursive: true });

const URL = process.env.PRISM_LIVE_URL || 'https://kid-kode-ai-landing.vercel.app/';
const GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[0m';
const results = [];
const check = (id, pass, detail = '') => {
  results.push({ id, pass, detail });
  console.log(`[${pass ? GREEN + 'PASS' : RED + 'FAIL'}${RESET}] ${id}${detail ? ` — ${detail}` : ''}`);
};

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

console.log(`[live-smoke] loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

// Longer runway for production cold-boot + real-network fetch of the .prism.
await page.waitForTimeout(10000);

const canvases = await page.locator('canvas').count();
check('canvases.present', canvases >= 2, `found ${canvases}`);

const loadingVisible = await page.locator('text=LOADING PRISM').isVisible().catch(() => false);
const errorVisible = await page.locator('text=PRISM BOOT FAILED').isVisible().catch(() => false);
check('runtime.mounted', !loadingVisible && !errorVisible,
  errorVisible ? 'PRISM BOOT FAILED visible' : loadingVisible ? 'still loading after 10s' : 'mounted');

const prismHandle = await page.evaluate(() => typeof window.__prism);
check('window.__prism.exposed', prismHandle === 'object', `typeof=${prismHandle}`);

const filterable = (e) => !/Download the React DevTools/.test(e) && !/Warning:/.test(e);
const criticalErrors = [...pageErrors, ...consoleErrors].filter(filterable);
check('runtime.no-errors', criticalErrors.length === 0, criticalErrors.length ? criticalErrors.slice(0, 2).join(' | ') : 'clean');

const screenshotPath = join(artifactsDir, 'live-vercel.png');
await page.screenshot({ path: screenshotPath, fullPage: false });
check('screenshot.saved', true, screenshotPath);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
