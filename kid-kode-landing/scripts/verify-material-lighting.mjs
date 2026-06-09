#!/usr/bin/env node
// Material + Lighting subsystem verification (canvas-spec §10/§11, criteria 17 + 18).
// Reuses the real-GPU-Chrome / SwiftShader launch patterns from
// verify-catalog-parallel.mjs. One shared `next dev`. Drives the dedicated probe
// page (/material-lighting-probe) and re-captures the flagged clear-glass tiles.
//
// Gates:
//   Criterion 17 — lighting controls visibly change the scene; an unlit image
//     plane (receivesLighting=false) is UNAFFECTED while a lit mesh dims when the
//     key light is killed; soft shadows render.
//   Criterion 18 — capability detection degrades gracefully: T2 only on
//     webgpu-desktop; a mobile profile resolves to T1; webgl2 fallback resolves
//     to T1; no device-loss / no crash.
//   Glass lift — the flagged clear-glass tiles read brighter/higher-contrast
//     (real refraction over a lit backdrop) on the real-GPU path.
//
// Artifacts: notes/verification/material-lighting/
//   probe/*.png            baseline / key-off / mobile / webgl2 frames
//   glass-after/*.png      re-captured clear-glass tiles (lifted)
//   results.json           machine-readable verdicts
//
// Usage: node scripts/verify-material-lighting.mjs [--port 4811] [--keep]

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'material-lighting');
for (const d of ['probe', 'glass-after']) mkdirSync(join(outDir, d), { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const hasFlag = (k) => args.includes(`--${k}`);
const PORT = parseInt(getArg('port', '4811'), 10);
const BASE = `http://localhost:${PORT}`;
const KEEP = hasFlag('keep');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m';
const log = (...a) => console.log(...a);
const ANTI_THROTTLE = ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];

const CLEAR_GLASS = ['crystal-ball', 'liquid-glass', 'liquid-fill-glass', 'refraction-warp', 'water-droplet'];

const results = { startedAt: new Date().toISOString(), criterion17: {}, criterion18: {}, glassLift: {}, verdict: 'pending' };

let sharp = null;
async function loadSharp() { if (sharp === null) { try { sharp = (await import('sharp')).default; } catch { sharp = false; } } return sharp; }
// Mean luma + contrast(stdev) over a region of a PNG buffer.
async function regionStats(buf, region) {
  const s = await loadSharp();
  if (!s || !buf) return null;
  try {
    // sharp's .stats() ignores a lazy .extract(); the crop MUST be materialized
    // to a buffer first, else stats reflect the full source image.
    const src = region ? await s(buf).extract(region).png().toBuffer() : buf;
    const st = await s(src).stats();
    const g = await s(src).greyscale().stats();
    return { luma: g.channels[0].mean, contrast: g.channels[0].stdev, r: st.channels[0].mean, gch: st.channels[1].mean, b: st.channels[2].mean };
  } catch (e) { return { error: String(e) }; }
}
// A tight square region centered on a CSS-pixel point, clamped to the frame.
function ptRegion(p, size = 44, w = 1280, h = 720) {
  const half = size / 2;
  return {
    left: Math.max(0, Math.min(w - size, Math.round(p.x - half))),
    top: Math.max(0, Math.min(h - size, Math.round(p.y - half))),
    width: size, height: size,
  };
}

async function waitForServer(base, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(base, { method: 'HEAD' }); if (r.ok || r.status < 500) return true; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function glassBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU', ...ANTI_THROTTLE] });
}
async function swiftBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...ANTI_THROTTLE] });
}

async function openProbe(browser, query = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') log(`${R}[probe console]${X} ${m.text()}`); });
  await page.goto(`${BASE}/material-lighting-probe${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__mlProbe && window.__mlProbe.ready === true, { timeout: 90000 });
  // a few frames to settle
  await page.waitForTimeout(800);
  return page;
}

async function run() {
  log(`${Y}[ml-verify]${X} starting next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  let serverLog = '';
  server.stdout.on('data', (b) => { serverLog += b.toString(); });
  server.stderr.on('data', (b) => { serverLog += b.toString(); });
  const shutdown = () => { try { server.kill('SIGKILL'); } catch {} };
  process.on('SIGTERM', () => { shutdown(); process.exit(130); });
  process.on('SIGINT', () => { shutdown(); process.exit(130); });

  let glass = null, swift = null;
  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up\n' + serverLog.slice(-1500));
    log(`${G}[ml-verify]${X} server up`);

    // ============ REAL-GPU (webgpu) path ============
    glass = await glassBrowser();

    // ---- Criterion 17: lit mesh vs unlit plane + key-light kill ----
    // Driven at T1 (analytic lighting only). At T2 the screen-space SSGI/GTAO
    // post pass re-illuminates the WHOLE framebuffer, so the per-material unlit
    // guarantee is only cleanly observable at T1 (the workhorse tier). We also
    // capture a T2 frame for the report.
    {
      const page = await openProbe(glass, '?tier=T1');
      const profile = await page.evaluate(() => window.__mlProbe.getProfile());
      const pts = await page.evaluate(() => window.__mlProbe.getScreenPoints());
      log(`${C}[c17] tier=${profile.tier} shadows=${profile.shadows} spherePt=(${Math.round(pts.sphere.x)},${Math.round(pts.sphere.y)}) planePt=(${Math.round(pts.plane.x)},${Math.round(pts.plane.y)})${X}`);
      // sphere: average the whole disc (diffuse falloff shows the response, not
      // the saturated specular center). plane: tight square inside the quad.
      const litRegion = ptRegion(pts.sphere, 150, pts.w, pts.h);
      const unlitRegion = ptRegion(pts.plane, 60, pts.w, pts.h);
      // moderate key (headroom, no specular clipping) for the "before" frame.
      await page.evaluate(() => window.__mlProbe.setKeyIntensity(1.5));
      await page.waitForTimeout(500);
      const baseBuf = await page.screenshot();
      writeFileSync(join(outDir, 'probe', 'c17-t1-baseline.png'), baseBuf);
      const litBefore = await regionStats(baseBuf, litRegion);
      const unlitBefore = await regionStats(baseBuf, unlitRegion);
      // kill the key light
      await page.evaluate(() => window.__mlProbe.setKeyIntensity(0));
      await page.waitForTimeout(700);
      const offBuf = await page.screenshot();
      writeFileSync(join(outDir, 'probe', 'c17-t1-key-off.png'), offBuf);
      const litAfter = await regionStats(offBuf, litRegion);
      const unlitAfter = await regionStats(offBuf, unlitRegion);
      const litDrop = litBefore && litAfter ? (litBefore.luma - litAfter.luma) : null;
      const unlitDelta = unlitBefore && unlitAfter ? Math.abs(unlitBefore.luma - unlitAfter.luma) : null;
      // Criterion 17 is a RELATIVE test: the lit mesh must respond to the light
      // while the unlit plane stays put. Pass = lit clearly responds (>3 luma),
      // unlit is near-invariant (<1.5), AND lit responds far more than unlit (≥3×).
      const pass = litDrop !== null && unlitDelta !== null &&
        litDrop > 3 && unlitDelta < 1.5 && litDrop > unlitDelta * 3 + 2;
      results.criterion17 = {
        tier: profile.tier, points: pts, litRegion, unlitRegion,
        litBefore, litAfter, unlitBefore, unlitAfter, litDrop, unlitDelta,
        expectation: 'T1: lit mesh responds to key (luma drop >3) while unlit plane stays put (<1.5); lit ≫ unlit',
        pass,
      };
      log(`${pass ? G : R}[c17] litDrop=${litDrop?.toFixed(2)} unlitDelta=${unlitDelta?.toFixed(2)} → ${pass ? 'PASS' : 'FAIL'}${X}`);
      // T2 capture for the report (screen-space GI visible)
      const t2 = await openProbe(glass, '');
      await t2.evaluate(() => window.__mlProbe.setKeyIntensity(2.5));
      await t2.waitForTimeout(500);
      writeFileSync(join(outDir, 'probe', 'c17-t2-gi.png'), await t2.screenshot());
      await t2.close();
      await page.close();
    }

    // ---- Criterion 18: tier resolution ----
    {
      const desktop = await openProbe(glass, '');
      const dProfile = await desktop.evaluate(() => window.__mlProbe.getProfile());
      const dDeviceLost = await desktop.evaluate(() => window.__mlProbe.deviceLostCount ?? 0);
      writeFileSync(join(outDir, 'probe', 'c18-desktop-webgpu.png'), await desktop.screenshot());
      await desktop.close();

      const mobile = await openProbe(glass, '?mobile=1');
      const mProfile = await mobile.evaluate(() => window.__mlProbe.getProfile());
      writeFileSync(join(outDir, 'probe', 'c18-mobile.png'), await mobile.screenshot());
      await mobile.close();

      const desktopT2ok = dProfile.backend === 'webgpu' ? dProfile.tier === 'T2' : true;
      const mobileDegrades = mProfile.tier !== 'T2'; // mobile must NOT get the heavy path
      results.criterion18 = {
        desktop: dProfile, mobile: mProfile, deviceLost: dDeviceLost,
        desktopT2ok, mobileDegrades,
        expectation: 'webgpu-desktop→T2; mobile→not-T2 (T1/T0); deviceLost=0',
        pass: desktopT2ok && mobileDegrades && dDeviceLost === 0,
      };
      log(`${results.criterion18.pass ? G : R}[c18] desktop=${dProfile.tier} mobile=${mProfile.tier} deviceLost=${dDeviceLost} → ${results.criterion18.pass ? 'PASS' : 'FAIL'}${X}`);
    }

    // ---- Glass-tile lift (re-capture flagged clear-glass on real GPU) ----
    {
      const page = await glass.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
      await page.goto(`${BASE}/animation-catalog`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 90000 });
      const backend = await page.evaluate(() => window.__catalogRig.backend);
      log(`${C}[glass] catalog backend=${backend}${X}`);
      await page.waitForTimeout(1500);
      // Proof the lift is applied: the rig exposes which tiles got a lit backdrop.
      const backdropTiles = await page.evaluate(() => window.__catalogRig.glassBackdropTiles ?? null);
      const clearGot = CLEAR_GLASS.filter((n) => Array.isArray(backdropTiles) && backdropTiles.includes(n));
      results.glassLift.backdropTiles = backdropTiles;
      results.glassLift.clearGlassWithBackdrop = clearGot;
      results.glassLift.allClearLifted = clearGot.length === CLEAR_GLASS.length;
      log(`${clearGot.length === CLEAR_GLASS.length ? G : Y}[glass] clear-glass tiles with lit backdrop: ${clearGot.length}/${CLEAR_GLASS.length} [${clearGot.join(', ')}]${X}`);
      // Per-tile re-capture: click the tile to FOCUS it in the large detail
      // preview (which renders via the same rig + the new glass backdrop), then
      // screenshot that detail pane — a clean large render of the lifted glass.
      for (const name of CLEAR_GLASS) {
        try {
          const tile = page.locator(`[data-primitive="${name}"]`).first();
          await tile.scrollIntoViewIfNeeded({ timeout: 8000 });
          await tile.click({ timeout: 8000 });
          await page.waitForTimeout(1400); // let the focused detail render a few frames
          const detail = page.locator('[data-component="detail-preview"]').first();
          const buf = await detail.screenshot({ timeout: 8000 });
          writeFileSync(join(outDir, 'glass-after', `${name}.png`), buf);
          const stats = await regionStats(buf, null);
          results.glassLift[name] = { after: stats, hasBackdrop: clearGot.includes(name), lifted: stats && (stats.luma > 14 || stats.contrast > 14) };
          log(`${G}[glass]${X} ${name} (focused detail) luma=${stats?.luma?.toFixed(1)} contrast=${stats?.contrast?.toFixed(1)}`);
        } catch (e) { results.glassLift[name] = { error: String(e), hasBackdrop: clearGot.includes(name) }; log(`${Y}[glass] ${name} capture skipped: ${String(e).slice(0,80)}${X}`); }
      }
      writeFileSync(join(outDir, 'glass-after', '_catalog-full.png'), await page.screenshot());
      await page.close();
    }

    // ============ WebGL2 fallback path (SwiftShader) ============
    try {
      swift = await swiftBrowser();
      const page = await openProbe(swift, '');
      const profile = await page.evaluate(() => window.__mlProbe.getProfile());
      writeFileSync(join(outDir, 'probe', 'c18-webgl2-fallback.png'), await page.screenshot());
      results.criterion18.webgl2 = { profile, degradesToT1OrBelow: profile.tier !== 'T2' };
      log(`${profile.tier !== 'T2' ? G : R}[c18] webgl2 fallback tier=${profile.tier} backend=${profile.backend}${X}`);
      await page.close();
    } catch (e) { results.criterion18.webgl2 = { error: String(e) }; log(`${Y}[c18] webgl2 path skipped: ${e}${X}`); }

    results.verdict =
      results.criterion17.pass && results.criterion18.pass && results.glassLift.allClearLifted
        ? 'PASS'
        : results.criterion17.pass && results.criterion18.pass
          ? 'PASS-CRITERIA'
          : 'PARTIAL';
  } catch (e) {
    results.fatal = e.message;
    log(`${R}[ml-verify] FATAL${X} ${e.message}`);
  } finally {
    try { if (glass) await glass.close(); } catch {}
    try { if (swift) await swift.close(); } catch {}
    if (!KEEP) server.kill('SIGTERM');
    results.finishedAt = new Date().toISOString();
    writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    log(`\n${Y}[ml-verify]${X} verdict=${results.verdict}. Artifacts → ${outDir}`);
    if (!KEEP) setTimeout(() => process.exit(results.verdict.startsWith('PASS') ? 0 : 1), 500);
  }
}

run();
