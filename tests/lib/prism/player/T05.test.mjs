#!/usr/bin/env node
// T05 — Verify §10.4: "Navigating to `/editor` shows the split pane with
// PixiJS rendering on the left, 3D graph on the right."
//
// Spec (extract line 1172):
//   "Navigating to `/editor` shows the split pane with PixiJS rendering on
//    the left, 3D graph on the right"
//
// This project mounts the editor at `/` (see kid-kode-landing/CLAUDE.md: the
// left pane of the editor at `/` renders a PixiJS-based mock app from a
// `.prism` artifact; the right pane is the 3D knowledge-graph viewer). So
// §10.4 is satisfied for this repo iff:
//   (a) `/` returns HTTP 200.
//   (b) The DOM exposes two distinct <canvas> elements — one per pane.
//   (c) Each canvas has non-zero width × height (it is actually rendering,
//       not collapsed or display:none).
//   (d) The left pane is reachable via `[data-pane="preview"]` and contains
//       a <canvas> (the PrismHost / PixiJS surface).
//   (e) The right pane is reachable via `[data-pane="graph"]` and contains
//       a <canvas> (the react-three-fiber 3D graph surface).
//   (f) The left pane's viewport x-origin is strictly less than the right
//       pane's — enforcing the "PixiJS on the LEFT, 3D graph on the RIGHT"
//       ordering named in the spec.
//   (g) The two canvases are distinct DOM elements (no single canvas is
//       being reused for both panes).
//
// Strategy: spawn `npm run dev -- -p 4781`, wait for the dev server, drive
// Playwright at 1920×1080 (desktop viewport — `page.tsx` switches to a
// vertical stack below 900px, which would violate the left/right contract).
// Port 4781 is chosen to avoid collision with 4777 (browser-smoke), 4778
// (T01), 4779 (T02), 4780 (T04).
//
// Fails closed: if any of (a)–(g) isn't true, at least one assertion flunks.
//
// Run: node tests/lib/prism/player/T05.test.mjs

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4781;
const URL = `http://localhost:${PORT}/`;

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* still booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  const serverLog = [];
  server.stdout.on('data', (b) => serverLog.push(b.toString()));
  server.stderr.on('data', (b) => { serverLog.push(b.toString()); });

  try {
    const ok = await waitForServer(URL);
    check('§10.4 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      // Desktop viewport: page.tsx uses horizontal split at >= 900px width.
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T05 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'networkidle' });
    check('§10.4 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200,
      `status=${response?.status()}`);

    // Give PrismHost and r3f a moment to mount their canvases.
    await page.waitForSelector('[data-pane="preview"] canvas', { timeout: 20000 }).catch(() => { /* handled below */ });
    await page.waitForSelector('[data-pane="graph"] canvas',   { timeout: 20000 }).catch(() => { /* handled below */ });

    // (b) Two distinct <canvas> elements in the DOM.
    const canvasCount = await page.locator('canvas').count();
    check('§10.4 — DOM exposes ≥ 2 <canvas> elements',
      canvasCount >= 2, `count=${canvasCount}`);

    // (d) Left pane tagged and contains a canvas.
    const previewPaneCount = await page.locator('[data-pane="preview"]').count();
    check('§10.4 — left pane is tagged [data-pane="preview"]',
      previewPaneCount === 1, `count=${previewPaneCount}`);

    const previewCanvasCount = await page.locator('[data-pane="preview"] canvas').count();
    check('§10.4 — left pane contains a PixiJS <canvas>',
      previewCanvasCount >= 1, `count=${previewCanvasCount}`);

    // (e) Right pane tagged and contains a canvas.
    const graphPaneCount = await page.locator('[data-pane="graph"]').count();
    check('§10.4 — right pane is tagged [data-pane="graph"]',
      graphPaneCount === 1, `count=${graphPaneCount}`);

    const graphCanvasCount = await page.locator('[data-pane="graph"] canvas').count();
    check('§10.4 — right pane contains a 3D-graph <canvas>',
      graphCanvasCount >= 1, `count=${graphCanvasCount}`);

    // (c) Non-zero dimensions on each pane's canvas.
    const previewBox = await page.locator('[data-pane="preview"] canvas').first().boundingBox().catch(() => null);
    check('§10.4 — preview canvas has non-zero width × height',
      !!previewBox && previewBox.width > 0 && previewBox.height > 0,
      previewBox ? `${Math.round(previewBox.width)}×${Math.round(previewBox.height)}` : 'no boundingBox');

    const graphBox = await page.locator('[data-pane="graph"] canvas').first().boundingBox().catch(() => null);
    check('§10.4 — graph canvas has non-zero width × height',
      !!graphBox && graphBox.width > 0 && graphBox.height > 0,
      graphBox ? `${Math.round(graphBox.width)}×${Math.round(graphBox.height)}` : 'no boundingBox');

    // (f) Ordering: preview x-origin strictly less than graph x-origin.
    check('§10.4 — left pane is LEFT of the right pane (preview.x < graph.x)',
      !!previewBox && !!graphBox && previewBox.x < graphBox.x,
      (previewBox && graphBox) ? `preview.x=${Math.round(previewBox.x)} graph.x=${Math.round(graphBox.x)}` : 'missing boundingBox');

    // (g) Distinct DOM nodes.
    const sameNode = await page.evaluate(() => {
      const a = document.querySelector('[data-pane="preview"] canvas');
      const b = document.querySelector('[data-pane="graph"] canvas');
      return !!a && !!b && a === b;
    });
    check('§10.4 — preview and graph canvases are distinct DOM nodes',
      !sameNode, sameNode ? 'same element reused' : '');

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T05: all §10.4 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T05: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
