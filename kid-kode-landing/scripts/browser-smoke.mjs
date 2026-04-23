#!/usr/bin/env node
// Playwright-driven runtime smoke test for the Prism mock app.
// Starts a production Next.js server, drives the page in headless Chromium,
// and reports pass/fail on every criterion that requires a running browser.
//
// Run: node scripts/browser-smoke.mjs   (will npx-install playwright on first run)

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const artifactsDir = join(repoRoot, 'notes', 'browser-smoke');
mkdirSync(artifactsDir, { recursive: true });

const PORT = 4777;
const URL = `http://localhost:${PORT}/`;

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const results = [];
function check(id, desc, pass, detail = '') {
  results.push({ id, desc, pass, detail });
  console.log(`[${pass ? GREEN + 'PASS' : RED + 'FAIL'}${RESET}] ${id.padEnd(30)} ${desc}${detail ? `\n        ${DIM}${detail}${RESET}` : ''}`);
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) { /* still booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  if (!existsSync(join(repoRoot, 'public', 'prism-assets', 'mock-app.prism'))) {
    console.error('mock-app.prism missing — run `npm run build:prism` first.');
    process.exit(1);
  }

  console.log(`[smoke] starting next start on :${PORT}…`);
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (b) => process.stderr.write(b));

  try {
    const ok = await waitForServer(URL);
    if (!ok) throw new Error('server did not come up in 30s');

    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    // Capture console + errors.
    const consoleLogs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });

    // Give the client-side Prism runtime time to boot. Atlas + .prism grew to ~955KB combined
    // after the Spatial/3D asset regeneration; cold boot in headless Chromium needs a touch
    // more runway before the loading spinner is expected to have been swapped out.
    await page.waitForTimeout(6000);

    // ─── §10.3 dev/prod serves split pane ───────────────────────────────────
    const canvases = await page.locator('canvas').count();
    check('canvases.present', '§10.3 — split pane renders both canvases', canvases >= 2, `found ${canvases}`);

    // ─── §10.4 Prism runtime booted (no "LOADING PRISM" still visible) ──────
    const loadingVisible = await page.locator('text=LOADING PRISM').isVisible().catch(() => false);
    const errorVisible = await page.locator('text=PRISM BOOT FAILED').isVisible().catch(() => false);
    check('runtime.mounted', '§10.4 — PrismHost mount progressed past loading',
      !loadingVisible && !errorVisible,
      errorVisible ? 'PRISM BOOT FAILED is visible' : loadingVisible ? 'still loading after 3.5s' : 'mounted');

    // ─── Page errors / console errors ───────────────────────────────────────
    const criticalErrors = [...pageErrors, ...consoleLogs.filter((l) => l.type === 'error').map((l) => l.text)]
      .filter((e) => !/Download the React DevTools/.test(e) && !/Warning:/.test(e));
    check('runtime.no-errors', 'no runtime errors in console / page',
      criticalErrors.length === 0,
      criticalErrors.length ? criticalErrors.slice(0, 2).join(' | ') : 'clean');

    // ─── §10.12 scroll with wheel ───────────────────────────────────────────
    const leftCanvas = page.locator('canvas').first();
    const bbox = await leftCanvas.boundingBox();
    if (bbox) {
      await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(400);
      check('scroll.wheel.handled', '§10.12 — wheel scroll consumed by canvas without throwing', pageErrors.length === 0, `pageErrors=${pageErrors.length}`);
    } else {
      check('scroll.wheel.handled', '§10.12 — wheel scroll', false, 'canvas bbox unavailable');
    }

    // ─── §10.20 SHR break+repair via dev tool ───────────────────────────────
    try {
      await page.evaluate(() => {
        // @ts-ignore
        const fn = window.__prismBreakNode;
        if (typeof fn !== 'function') throw new Error('__prismBreakNode not installed');
        fn('hero-card-cta');
      });
      check('shr.devtool.installed', '§10.20 — window.__prismBreakNode exists + accepts a nodeId', true, 'invoked');
    } catch (e) {
      check('shr.devtool.installed', '§10.20 — window.__prismBreakNode exists', false, (e).message);
    }

    // ─── §10.3 screenshot ───────────────────────────────────────────────────
    await page.screenshot({ path: join(artifactsDir, 'home-hub.png'), fullPage: false });
    check('screenshot.saved', 'homepage screenshot captured', true, join('notes/browser-smoke/home-hub.png'));

    await browser.close();
  } catch (e) {
    check('fatal', 'smoke test fatal error', false, e.message);
  } finally {
    server.kill('SIGTERM');
  }

  writeFileSync(join(artifactsDir, 'browser-smoke-report.json'), JSON.stringify(results, null, 2) + '\n');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\n${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
