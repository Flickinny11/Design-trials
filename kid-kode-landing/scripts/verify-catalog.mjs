#!/usr/bin/env node
// Serialized browser verification for the Animation Primitive Catalog, run
// against the SHARED PREVIEW RIG (catalog-prep, 2026-06-07).
//
// Every preview — all tiles + the detail — draws through ONE persistent WebGPU
// context (SharedCanvas + SharedTileRenderer). This harness:
//   • waits for window.__catalogRig.ready;
//   • screenshots the full picker (viewport) showing many tiles animating at once
//     through the one shared canvas;
//   • proves a tile PLAYS ON HOVER (frozen frame ≠ hovered frame), no per-tile canvas;
//   • for each registered primitive, focuses it into the ONE detail viewport and:
//       (b) RENDERS  — the detail region paints,
//       (c) PLAYS    — sampled frames differ over the timeline,
//       (d) CONTROLS — paused, driving every range control changes the frozen frame;
//   • asserts window.__catalogRig.deviceLostCount === 0 across ALL of the above.
// (a) contract conformance is covered headlessly by the vitest suite.
//
// Artifacts: notes/verification/catalog-prep/{gallery,tiles,controls}/*.png
//            notes/verification/catalog-prep/verify-catalog-report.json
//
// Usage: node scripts/verify-catalog.mjs [--port 4788] [--only name1,name2]

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'catalog-prep');
for (const d of ['gallery', 'tiles', 'controls']) mkdirSync(join(outDir, d), { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const PORT = parseInt(getArg('port', '4788'), 10);
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

  const report = { url: URL, startedAt: new Date().toISOString(), rig: {}, primitives: [], globalConsoleErrors: [], summary: {} };

  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up in 90s\n' + serverLog.slice(-1500));

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1600 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    // Each preview is a TRANSPARENT DOM window over the one fixed rig canvas.
    // Playwright's element.screenshot() does NOT composite a fixed underlay
    // behind a transparent element, so we capture a clipped PAGE screenshot
    // (which composites the whole page, canvas included) at the element's rect.
    const shotRegion = async (locator) => {
      const box = await locator.boundingBox().catch(() => null);
      if (!box) return null;
      const clip = {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.max(1, Math.min(box.width, 1440 - Math.max(0, box.x))),
        height: Math.max(1, Math.min(box.height, 1600 - Math.max(0, box.y))),
      };
      return page.screenshot({ clip }).catch(() => null);
    };

    log(`${Y}[catalog-verify]${X} navigating ${URL} (first compile can take ~20s)…`);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('[data-component="animation-picker"]', { timeout: 120000 });
    await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 60000 });
    await page.waitForSelector('[data-tile]', { timeout: 60000 });
    // The whole point: one shared context must come up ready.
    await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 60000 });
    await page.waitForTimeout(2000);

    const rigInfo = await page.evaluate(() => ({
      ready: window.__catalogRig?.ready,
      backend: window.__catalogRig?.backend,
      tileCount: window.__catalogRig?.tileCount,
      deviceLostCount: window.__catalogRig?.deviceLostCount,
    }));
    report.rig.atStart = rigInfo;
    log(`${Y}[catalog-verify]${X} rig: backend=${rigInfo.backend} tiles=${rigInfo.tileCount} deviceLost=${rigInfo.deviceLostCount}`);

    // Full picker screenshot (viewport, NOT fullPage — the rig canvas is fixed,
    // so a viewport shot composites the live tiles; fullPage would tile a fixed
    // canvas). Shows many tiles rendering through the one shared context.
    await page.screenshot({ path: join(outDir, 'gallery', 'catalog-full.png') });

    const count = await page.locator('[data-component="primitive-count"]').textContent().catch(() => '?');
    log(`${Y}[catalog-verify]${X} picker reports: ${count}`);

    // Discover tiles.
    let tiles = await page.$$eval('[data-tile]', (els) =>
      els.map((e) => ({ name: e.getAttribute('data-primitive'), category: e.getAttribute('data-category') })));
    if (ONLY.length) tiles = tiles.filter((t) => ONLY.includes(t.name));
    log(`${Y}[catalog-verify]${X} verifying ${tiles.length} tile(s) serially…`);

    // (e) HOVER PLAYS: a tile freezes mid-frame, then plays on hover. With the
    // shared rig there is no per-tile canvas — the tile region is a transparent
    // window into the shared canvas — so we prove "plays on hover" by pixel diff.
    try {
      const region = page.locator(`[data-tile][data-primitive="${tiles[0].name}"] [data-shared-viewport]`).first();
      await page.waitForTimeout(400);
      const frozen = await shotRegion(region);
      const box = await region.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1100);
      const hovered = await shotRegion(region);
      report.hoverPlaysProof = !!(frozen && hovered && Buffer.compare(frozen, hovered) !== 0);
      if (hovered) writeFileSync(join(outDir, 'gallery', 'hover-plays-proof.png'), hovered);
      await page.mouse.move(4, 4);
      await page.waitForTimeout(400);
    } catch (e) {
      report.hoverPlaysProof = false;
      report.notes = 'hover proof error: ' + e.message;
    }
    log(`${Y}[catalog-verify]${X} tile plays on hover: ${report.hoverPlaysProof}`);

    const detail = page.locator('[data-component="primitive-detail"]');
    const detailPreview = page.locator('[data-component="detail-preview"]');

    for (const tile of tiles) {
      const entry = { name: tile.name, category: tile.category, renders: false, plays: false, controls: false, picker: true, notes: [], consoleErrors: [] };
      const errBefore = consoleErrors.length;
      try {
        await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), tile.name);
        await page
          .waitForFunction(
            (n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n,
            tile.name,
            { timeout: 8000 },
          )
          .catch(() => entry.notes.push('focus attr not confirmed'));
        await page.waitForTimeout(900);

        // (c) PLAYS — ensure playing; sample 3 frames over ~1s; motion = ANY pair differs.
        await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));
        await page.waitForTimeout(300);
        const frames = [];
        for (let k = 0; k < 3; k++) {
          frames.push(await shotRegion(detailPreview));
          if (k < 2) await page.waitForTimeout(420);
        }
        const last = frames[frames.length - 1];
        entry.renders = !!last;
        entry.plays = frames.some((a, i) => frames.slice(i + 1).some((b) => a && b && Buffer.compare(a, b) !== 0));
        if (last) writeFileSync(join(outDir, 'tiles', `${tile.name}.png`), last);

        // (d) CONTROLS — PAUSE (freeze a visible mid-frame), drive every range
        // control to an extreme, require the frozen frame to change.
        await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
        await page.waitForTimeout(450);
        const ranges = detail.locator('input[type="range"][data-control]');
        const nRanges = await ranges.count();
        if (nRanges > 0) {
          const c1 = await shotRegion(detailPreview);
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
          const c2 = await shotRegion(detailPreview);
          entry.controls = !!(c1 && c2 && Buffer.compare(c1, c2) !== 0);
          if (c2) writeFileSync(join(outDir, 'controls', `${tile.name}-controls.png`), c2);
        } else {
          entry.notes.push('no range control found');
        }
      } catch (e) {
        entry.notes.push('error: ' + e.message);
      }
      entry.consoleErrors = consoleErrors.slice(errBefore).filter((t) => t.includes(tile.name) || /animatable|catalog-rig/i.test(t));
      const ok = entry.renders && entry.plays && entry.controls;
      log(`  [${ok ? G + 'OK' : R + '!!'}${X}] ${tile.name.padEnd(22)} render=${entry.renders} play=${entry.plays} controls=${entry.controls} ${entry.notes.join('; ')}`);
      report.primitives.push(entry);
    }

    // Final rig state — the headline assertion for the shared rig.
    report.rig.atEnd = await page.evaluate(() => ({
      ready: window.__catalogRig?.ready,
      backend: window.__catalogRig?.backend,
      tileCount: window.__catalogRig?.tileCount,
      deviceLostCount: window.__catalogRig?.deviceLostCount,
    }));
    report.deviceLostTotal = report.rig.atEnd?.deviceLostCount ?? -1;

    // Console "device lost"/"context lost" noise should now be ZERO too.
    const isEnvNoise = (t) => /Download the React DevTools/.test(t);
    const ctxLost = (t) => /Device Lost/i.test(t) || /context lost/i.test(t);
    report.globalConsoleErrors = consoleErrors.filter((t) => !isEnvNoise(t) && !ctxLost(t));
    report.contextLostConsoleCount = consoleErrors.filter(ctxLost).length;
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
    deviceLostTotal: report.deviceLostTotal,
    contextLostConsoleCount: report.contextLostConsoleCount || 0,
    hoverPlaysProof: report.hoverPlaysProof === true,
    backend: report.rig?.atEnd?.backend,
  };
  writeFileSync(join(outDir, 'verify-catalog-report.json'), JSON.stringify(report, null, 2) + '\n');
  log(`\n${Y}[catalog-verify]${X} ${JSON.stringify(report.summary)}`);
  const deviceLostOk = report.deviceLostTotal === 0;
  log(`${deviceLostOk ? G : R}[catalog-verify] device-lost across all tiles = ${report.deviceLostTotal} ${deviceLostOk ? '(zero ✓)' : '(NONZERO ✗)'}${X}`);
  log(`${D}report: notes/verification/catalog-prep/verify-catalog-report.json${X}`);
  process.exit(report.fatal ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
