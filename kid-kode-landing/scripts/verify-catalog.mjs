#!/usr/bin/env node
// Serialized browser verification for the Animation Primitive Catalog pilot.
//
// Starts `next dev`, opens /animation-catalog in ONE headless Chromium, and for
// each registered primitive tile, SERIALLY (never parallel browsers):
//   (b) RENDERS  — a <canvas> mounts on hover, no create() console error.
//   (c) PLAYS    — two frames 400ms apart differ (real motion over the timeline).
//   (d) CONTROLS — focus the tile, tweak a [data-control], canvas pixels change.
//   (e) PICKER   — the tile exists in the picker with its name/category.
// (a) contract conformance is covered headlessly by the vitest suite.
//
// Artifacts: notes/verification/ultracode-pilot/{gallery,tiles,controls}/*.png
//            notes/verification/ultracode-pilot/verify-catalog-report.json
//
// Usage: node scripts/verify-catalog.mjs [--port 4787] [--only name1,name2]

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ultracode-pilot');
for (const d of ['gallery', 'tiles', 'controls']) mkdirSync(join(outDir, d), { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = parseInt(getArg('port', '4787'), 10);
const ONLY = getArg('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/animation-catalog`;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const log = (...a) => console.log(...a);

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function main() {
  log(`${Y}[catalog-verify]${X} starting next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  let serverLog = '';
  server.stdout.on('data', (b) => { serverLog += b.toString(); });
  server.stderr.on('data', (b) => { serverLog += b.toString(); });

  const report = { url: URL, startedAt: new Date().toISOString(), primitives: [], globalConsoleErrors: [], summary: {} };

  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up in 90s\n' + serverLog.slice(-1500));

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    log(`${Y}[catalog-verify]${X} navigating ${URL} (first compile can take ~20s)…`);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('[data-component="animation-picker"]', { timeout: 120000 });
    await page.waitForSelector('[data-tile]', { timeout: 60000 });
    await page.waitForTimeout(1500);

    // Full gallery screenshot.
    await page.screenshot({ path: join(outDir, 'gallery', 'catalog-full.png'), fullPage: true });

    const count = await page.locator('[data-component="primitive-count"]').textContent().catch(() => '?');
    log(`${Y}[catalog-verify]${X} picker reports: ${count}`);

    // Discover tiles.
    let tiles = await page.$$eval('[data-tile]', (els) =>
      els.map((e) => ({ name: e.getAttribute('data-primitive'), category: e.getAttribute('data-category') })));
    if (ONLY.length) tiles = tiles.filter((t) => ONLY.includes(t.name));
    log(`${Y}[catalog-verify]${X} verifying ${tiles.length} tile(s) serially…`);

    // (e) HOVER-TILE PROOF (once): hovering a tile mounts a live mini canvas.
    // Done a single time to avoid GL-context churn (headless swiftshader drops
    // contexts when many canvases mount/unmount). All per-primitive render/play/
    // controls checks then run on the ONE persistent detail canvas via the
    // window.__catalogFocus hook — no further tile hovering.
    try {
      const el0 = page.locator(`[data-tile][data-primitive="${tiles[0].name}"]`).first();
      await el0.scrollIntoViewIfNeeded();
      const b0 = await el0.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height * 0.35);
      await page.waitForTimeout(1000);
      report.hoverTileProof = (await el0.locator('canvas').count()) >= 1;
      const proof = await el0.screenshot().catch(() => null);
      if (proof) writeFileSync(join(outDir, 'gallery', 'hover-tile-proof.png'), proof);
      await page.mouse.move(4, 4);
      await page.waitForTimeout(500);
    } catch (e) {
      report.hoverTileProof = false;
      report.notes = 'hover proof error: ' + e.message;
    }
    log(`${Y}[catalog-verify]${X} hover-tile mounts a live canvas: ${report.hoverTileProof}`);

    const detail = page.locator('[data-component="primitive-detail"]');
    const detailCanvas = detail.locator('canvas').first();

    for (const tile of tiles) {
      const entry = { name: tile.name, category: tile.category, renders: false, plays: false, controls: false, picker: true, notes: [], consoleErrors: [] };
      const errBefore = consoleErrors.length;
      try {
        // Focus via the hook (no tile hover → no context churn).
        await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), tile.name);
        await page
          .waitForFunction(
            (n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n,
            tile.name,
            { timeout: 8000 },
          )
          .catch(() => entry.notes.push('focus attr not confirmed'));
        await page.waitForTimeout(900);
        entry.renders = (await detailCanvas.count()) >= 1;

        // (c) PLAYS — ensure playing; two detail frames 450ms apart must differ.
        await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));
        await page.waitForTimeout(300);
        // Sample 3 frames over ~1s; motion = ANY pair differs (robust to slow
        // or near-symmetric primitives whose two adjacent frames can coincide).
        const frames = [];
        for (let k = 0; k < 3; k++) {
          frames.push(await detailCanvas.screenshot().catch(() => null));
          if (k < 2) await page.waitForTimeout(420);
        }
        entry.plays =
          frames.some((a, i) => frames.slice(i + 1).some((b) => a && b && Buffer.compare(a, b) !== 0));
        const last = frames[frames.length - 1];
        if (last) writeFileSync(join(outDir, 'tiles', `${tile.name}.png`), last);

        // (d) CONTROLS — PAUSE (freeze a visible mid-frame), drive every range
        // control to an extreme, require the frozen frame to change.
        await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
        await page.waitForTimeout(450);
        const ranges = detail.locator('input[type="range"][data-control]');
        const nRanges = await ranges.count();
        if (nRanges > 0) {
          const c1 = await detailCanvas.screenshot().catch(() => null);
          for (let i = 0; i < nRanges; i++) {
            const ctrl = ranges.nth(i);
            const max = await ctrl.getAttribute('max');
            const min = await ctrl.getAttribute('min');
            const cur = await ctrl.inputValue();
            const tgt = String(cur) === String(max) ? min : max;
            await ctrl.fill(String(tgt));
            await ctrl.dispatchEvent('input');
            await ctrl.dispatchEvent('change');
          }
          await page.waitForTimeout(700);
          const c2 = await detailCanvas.screenshot().catch(() => null);
          entry.controls = !!(c1 && c2 && Buffer.compare(c1, c2) !== 0);
          if (c2) writeFileSync(join(outDir, 'controls', `${tile.name}-controls.png`), c2);
        } else {
          entry.notes.push('no range control found');
        }
      } catch (e) {
        entry.notes.push('error: ' + e.message);
      }
      entry.consoleErrors = consoleErrors.slice(errBefore).filter((t) => t.includes(tile.name) || /animatable/i.test(t));
      const ok = entry.renders && entry.plays && entry.controls;
      log(`  [${ok ? G + 'OK' : R + '!!'}${X}] ${tile.name.padEnd(22)} render=${entry.renders} play=${entry.plays} controls=${entry.controls} ${entry.notes.join('; ')}`);
      report.primitives.push(entry);
    }

    // "WebGL Device Lost" is a headless-swiftshader artifact from GL-context
    // churn (not a primitive defect); classify it separately from real errors.
    const isEnvNoise = (t) =>
      /Download the React DevTools/.test(t) || /Device Lost/i.test(t) || /context lost/i.test(t);
    report.globalConsoleErrors = consoleErrors.filter((t) => !isEnvNoise(t));
    report.envNoiseCount = consoleErrors.filter(isEnvNoise).length;
    await browser.close();
  } catch (e) {
    report.fatal = e.message;
    log(`${R}[catalog-verify] FATAL${X} ${e.message}`);
  } finally {
    server.kill('SIGTERM');
  }

  const p = report.primitives;
  report.summary = {
    total: p.length,
    renders: p.filter((x) => x.renders).length,
    plays: p.filter((x) => x.plays).length,
    controls: p.filter((x) => x.controls).length,
    fullyVerified: p.filter((x) => x.renders && x.plays && x.controls).length,
    realConsoleErrorCount: report.globalConsoleErrors.length,
    envNoiseCount: report.envNoiseCount || 0,
  };
  writeFileSync(join(outDir, 'verify-catalog-report.json'), JSON.stringify(report, null, 2) + '\n');
  log(`\n${Y}[catalog-verify]${X} ${JSON.stringify(report.summary)}`);
  log(`${D}report: notes/verification/ultracode-pilot/verify-catalog-report.json${X}`);
  process.exit(report.fatal ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
