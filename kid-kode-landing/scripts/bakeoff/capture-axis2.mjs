#!/usr/bin/env node
// W-BAKE D3 — headless frame capture for Axis 2 renders.
//
// Real ConductorRuntime-path renders via /bakeoff-lab (W-2D honesty gate: a
// black/blank/error frame is a scored artifact, never retouched). Proven
// capture discipline from W-2D/W-BG:
//   - WebGL2 fallback via addInitScript(navigator.gpu = undefined) — headless
//     WebGPU screenshots come out blank/dithered;
//   - FRESH PAGE per capture (GPU process degrades across reuses);
//   - fixed settle delay (2500ms) after the probe reports ready so motion
//     states are comparable across contestants.
//
// Spawns its own `next dev` on --port (default 3105). Outputs:
//   notes/bakeoff/renders/frames/<contestant>/<case>-r<n>.png
//   notes/bakeoff/renders/frames/<contestant>/<case>-r<n>.meta.json
//
// Usage: node scripts/bakeoff/capture-axis2.mjs [--port 3105] [--contestant <id>] [--no-server]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants.mjs';

const require_ = createRequire(import.meta.url);
const { chromium } = require_(path.join(ROOT, 'node_modules', 'playwright'));

const BUNDLES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles');
const FRAMES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'frames');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(argOf('--port', '3105'));
const onlyContestant = argOf('--contestant', null);
const NO_SERVER = args.includes('--no-server');

const index = JSON.parse(readFileSync(path.join(BUNDLES_DIR, 'index.json'), 'utf8')).bundles
  .filter((b) => (onlyContestant ? b.contestant === onlyContestant : true));

async function waitForServer(url, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  throw new Error('dev server did not come up');
}

let server = null;
if (!NO_SERVER) {
  console.log(`starting next dev on :${PORT}...`);
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
}
await waitForServer(`http://localhost:${PORT}/bakeoff-lab`);
console.log('dev server ready');

const browser = await chromium.launch({ headless: true });
let done = 0;
for (const b of index) {
  const outDir = path.join(FRAMES_DIR, b.contestant);
  mkdirSync(outDir, { recursive: true });
  const tag = path.basename(b.id); // bundle id tail (keeps seeded-defect names distinct)
  const png = path.join(outDir, `${tag}.png`);
  const metaPath = path.join(outDir, `${tag}.meta.json`);
  if (existsSync(png) && existsSync(metaPath)) { done += 1; continue; }

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(String(msg.text()).slice(0, 300)); });
  // W-2D proven capture path: force the WebGL2 fallback for readable frames.
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); } catch { /* ignore */ }
  });
  let probe = null;
  try {
    await page.goto(`http://localhost:${PORT}/bakeoff-lab?bundle=${encodeURIComponent(b.id)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Judge-blindness + clean frames: hide the status line (it names the
    // contestant) and the Next dev-tools portal before shooting.
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important} [data-bakeoff-status]{display:none!important}' }).catch(() => {});
    await page.waitForFunction(
      () => window.__BAKEOFF__ && window.__BAKEOFF__.status !== 'loading',
      null,
      { timeout: 30000 },
    ).catch(() => {});
    await page.waitForTimeout(2500); // fixed settle — comparable motion state
    probe = await page.evaluate(() => window.__BAKEOFF__ ?? null);
    const canvas = page.locator('canvas[data-bakeoff-canvas]');
    await canvas.screenshot({ path: png, timeout: 15000 });
  } catch (err) {
    // Honest failure: full-page shot if the canvas shot failed.
    try { await page.screenshot({ path: png, timeout: 15000 }); } catch { /* leave missing */ }
    probe = probe ?? { status: 'capture-error', error: String(err?.message ?? err).slice(0, 300) };
  }
  writeFileSync(metaPath, JSON.stringify({
    bundle: b.id, capturedAt: new Date().toISOString(),
    probe, consoleErrors: consoleErrors.slice(0, 10),
    depViolations: b.depViolations, parsed: b.parsed, fenced: b.fenced,
    transformError: b.transformError ?? null,
    capturePath: 'WebGL2 fallback (navigator.gpu undefined initScript), fresh page, 2500ms settle',
  }, null, 2));
  await context.close();
  done += 1;
  if (done % 10 === 0) console.log(`  ...${done}/${index.length} frames`);
}
await browser.close();
if (server) server.kill('SIGTERM');
console.log(`captured ${done}/${index.length} frames -> ${FRAMES_DIR}`);
