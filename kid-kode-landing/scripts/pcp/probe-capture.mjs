#!/usr/bin/env node
// W-PCP D6 — probe frame capture. W-2D capture discipline verbatim from
// W-BAKE capture-axis2.mjs (I-P3): WebGL2 fallback via navigator.gpu
// undefined initScript, FRESH PAGE per capture, fixed 2500ms settle, blind
// frames (status line hidden). Frames + metas land under
// notes/pcp-probe/frames/<arm>--<contestant>/.
//
// Usage: node scripts/pcp/probe-capture.mjs [--port 3106] [--no-server]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from '../bakeoff/contestants.mjs';

const require_ = createRequire(import.meta.url);
const { chromium } = require_(path.join(ROOT, 'node_modules', 'playwright'));

const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const FRAMES_DIR = path.join(PROBE, 'frames');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(argOf('--port', '3106'));
const NO_SERVER = args.includes('--no-server');

const index = JSON.parse(readFileSync(path.join(PROBE, 'bundles-index.json'), 'utf8')).bundles;

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
  const lane = `${b.arm}--${b.contestant}`;
  const outDir = path.join(FRAMES_DIR, lane);
  mkdirSync(outDir, { recursive: true });
  const tag = `${b.caseId}-r${b.run}`;
  const png = path.join(outDir, `${tag}.png`);
  const metaPath = path.join(outDir, `${tag}.meta.json`);
  if (existsSync(png) && existsSync(metaPath)) { done += 1; continue; }

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(String(msg.text()).slice(0, 300)); });
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); } catch { /* ignore */ }
  });
  let probe = null;
  try {
    await page.goto(`http://localhost:${PORT}/bakeoff-lab?bundle=${encodeURIComponent(b.id)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
    try { await page.screenshot({ path: png, timeout: 15000 }); } catch { /* leave missing */ }
    probe = probe ?? { status: 'capture-error', error: String(err?.message ?? err).slice(0, 300) };
  }
  writeFileSync(metaPath, JSON.stringify({
    bundle: b.id, arm: b.arm, contestant: b.contestant, capturedAt: new Date().toISOString(),
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
