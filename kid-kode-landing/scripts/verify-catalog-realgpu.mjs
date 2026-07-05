#!/usr/bin/env node
// REAL-GPU spot-check for the transmissive-glass / IBL primitive family.
//
// The standard verify-catalog.mjs runs headless ANGLE+swiftshader, which
// UNDER-RENDERS transmission/IBL (glass looks near-empty). This script instead
// drives the REAL, installed Google Chrome (channel:'chrome') in HEADED mode
// with hardware GPU (Metal/WebGPU) so transmissive glass actually refracts and
// sparkles. Logan authorized using his Mac GPU for this.
//
// It focuses each flagged glass primitive into the shared-rig detail viewport,
// lets it play to a mid-animation hold, and captures a frame that should show
// the real refraction/sparkle. Reports the rig backend (expect 'webgpu').
//
// Artifacts: notes/verification/catalog-batch-2/real-gpu/<name>.png + report.json
//
// Usage: node scripts/verify-catalog-realgpu.mjs [--port 4793] [--only a,b,c]

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'catalog-batch-2', 'real-gpu');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = parseInt(getArg('port', '4793'), 10);
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/animation-catalog`;

// The transmissive-glass / IBL family that under-renders headless.
const DEFAULT_GLASS = [
  // batch-1 flagged
  'dispersion', 'refraction-warp', 'iridescent-glass', 'frosted-glass', 'liquid-glass', 'crystal-facet',
  // pre-existing
  'glass-refraction',
  // batch-2 new (flagRealGpu)
  'chromatic-aberration', 'bevel-glass', 'water-droplet', 'ice-glass',
];
const ONLY = getArg('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const TARGETS = ONLY.length ? ONLY : DEFAULT_GLASS;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', X = '\x1b[0m';
const log = (...a) => console.log(...a);

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return true; } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function main() {
  log(`${Y}[realgpu]${X} starting next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  let serverLog = '';
  server.stdout.on('data', (b) => { serverLog += b.toString(); });
  server.stderr.on('data', (b) => { serverLog += b.toString(); });

  const report = { url: URL, startedAt: new Date().toISOString(), mode: 'real-gpu headed Chrome', rig: {}, primitives: [], notes: [] };

  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up in 90s\n' + serverLog.slice(-1200));

    const { chromium } = await import('playwright');
    // REAL Chrome, HEADED, hardware GPU. NO swiftshader. Enable WebGPU.
    let browser;
    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
        args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
      });
    } catch (e) {
      report.notes.push('real Chrome channel launch failed: ' + e.message);
      throw e;
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    const shotRegion = async (locator) => {
      const box = await locator.boundingBox().catch(() => null);
      if (!box) return null;
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, Math.min(box.width, 1440 - Math.max(0, box.x))), height: Math.max(1, Math.min(box.height, 1200 - Math.max(0, box.y))) };
      return page.screenshot({ clip }).catch(() => null);
    };

    log(`${Y}[realgpu]${X} navigating ${URL} (first compile ~20s)…`);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('[data-component="animation-picker"]', { timeout: 120000 });
    await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 60000 });
    await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 60000 });
    await page.waitForTimeout(1500);

    const rigInfo = await page.evaluate(() => ({ ready: window.__catalogRig?.ready, backend: window.__catalogRig?.backend, tileCount: window.__catalogRig?.tileCount, deviceLostCount: window.__catalogRig?.deviceLostCount, adapter: (window.__catalogRig?.adapterInfo || null) }));
    report.rig = rigInfo;
    log(`${Y}[realgpu]${X} rig backend=${rigInfo.backend} tiles=${rigInfo.tileCount} deviceLost=${rigInfo.deviceLostCount}`);

    await page.screenshot({ path: join(outDir, '_picker-full.png') });

    const detail = page.locator('[data-component="primitive-detail"]');
    const detailPreview = page.locator('[data-component="detail-preview"]');

    for (const name of TARGETS) {
      const entry = { name, captured: false, notes: [] };
      try {
        const exists = await page.evaluate((n) => !!document.querySelector(`[data-tile][data-primitive="${n}"]`), name);
        if (!exists) { entry.notes.push('tile not registered'); report.primitives.push(entry); log(`  [${R}--${X}] ${name.padEnd(20)} not registered`); continue; }
        await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), name);
        await page.waitForFunction((n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n, name, { timeout: 8000 }).catch(() => entry.notes.push('focus not confirmed'));
        await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));
        // Let it play to a mid-animation hold where glass refraction is richest.
        await page.waitForTimeout(1400);
        const frame = await shotRegion(detailPreview);
        if (frame) { writeFileSync(join(outDir, `${name}.png`), frame); entry.captured = true; }
      } catch (e) { entry.notes.push('error: ' + e.message); }
      report.primitives.push(entry);
      log(`  [${entry.captured ? G + 'OK' : R + '!!'}${X}] ${name.padEnd(20)} ${entry.notes.join('; ')}`);
    }

    report.rigAtEnd = await page.evaluate(() => ({ backend: window.__catalogRig?.backend, deviceLostCount: window.__catalogRig?.deviceLostCount }));
    report.consoleErrors = consoleErrors.filter((t) => !/Download the React DevTools/.test(t));
    await browser.close();
  } catch (e) {
    report.fatal = e.message;
    log(`${R}[realgpu] FATAL${X} ${e.message}`);
  } finally {
    server.kill('SIGTERM');
  }

  report.summary = { targets: TARGETS.length, captured: report.primitives.filter((p) => p.captured).length, backend: report.rigAtEnd?.backend || report.rig?.backend, deviceLost: report.rigAtEnd?.deviceLostCount };
  writeFileSync(join(outDir, 'real-gpu-report.json'), JSON.stringify(report, null, 2) + '\n');
  log(`\n${Y}[realgpu]${X} ${JSON.stringify(report.summary)}`);
  log(`report: notes/verification/catalog-batch-2/real-gpu/real-gpu-report.json`);
  process.exit(report.fatal ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
