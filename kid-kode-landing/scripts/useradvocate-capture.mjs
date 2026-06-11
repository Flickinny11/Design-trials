#!/usr/bin/env node
// USER-ADVOCATE evidence-capture engine.
//
// Part A of the user-advocate gate. This is the "computer-use" surface: it drives
// the REAL, installed Google Chrome (channel:'chrome', headed, hardware Metal GPU /
// WebGPU — backend MUST read 'webgpu') through the running app's own interaction
// hooks, exactly as a person would touch it:
//   • focus a tile (window.__catalogFocus)
//   • play it (window.__catalogSetPlaying(true)) and sample mid-animation phases
//   • PAUSE, then sweep each labeled control low → mid → high and watch the frame
// and writes a measured EVIDENCE BUNDLE per tile that a fresh-context Claude Opus
// "user-advocate" reviewer judges against notes/verification/useradvocate/RUBRIC.md.
//
// This is NOT DOM-scraping: every datum is a real rendered frame off the real GPU
// plus measured pixel statistics. "Evidence or it didn't happen."
//
// Bundle layout (per tile, per state):
//   notes/verification/useradvocate-sixtile/<tile>/<state>/
//     idle.png                  paused at t=0
//     play-1.png play-2.png play-3.png    mid-animation phases
//     control-<id>-low.png  -mid.png  -high.png   each range control swept
//     metrics.json            measured stats for every frame (mean/effect RGB, hue,
//                             sat, luma, stdev, bandingScore, frameDeltaMag, control
//                             latency) + console/network errors
//   <tile>/claim.json         {name, label, description, category, groundTruthSibling}
//   evidence-manifest.json    (at the root) every bundle captured this run
//
// Usage:
//   node scripts/useradvocate-capture.mjs --tiles fireball-burst,heat-column \
//        --state before [--ground-truth fire-flame] [--port 4811] [--swiftshader]
//
// Real-GPU is the default (true colour for fire/volume judgement). --swiftshader
// falls back to headless ANGLE for environments without a display.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const rootOut = join(repoRoot, 'notes', 'verification', 'useradvocate-sixtile');
mkdirSync(rootOut, { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const hasFlag = (k) => args.includes(`--${k}`);

const TILES = getArg('tiles', '').split(',').map((s) => s.trim()).filter(Boolean);
const STATE = getArg('state', 'after');
const GROUND_TRUTH = getArg('ground-truth', '');
const PORT = parseInt(getArg('port', '4811'), 10);
const SWIFT = hasFlag('swiftshader');
const REUSE = hasFlag('reuse-server'); // attach to an already-running dev server on PORT
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/animation-catalog`;
const VW = 1440, VH = 1200, DPR = 2;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', X = '\x1b[0m';
const log = (...a) => console.log(...a);

if (!TILES.length) { log(`${R}no --tiles given${X}`); process.exit(2); }

// ── primitive claim (name/label/description) parsed from the source file ──────
const primDir = join(repoRoot, 'src/lib/prism/animatable/primitives');
function claimOf(name) {
  const f = join(primDir, `${name}.ts`);
  if (!existsSync(f)) return { name, label: name, description: '(source not found)', category: '?' };
  const s = readFileSync(f, 'utf8');
  const g = (re) => { const m = s.match(re); return m ? m[1] : ''; };
  // description: can span lines (single-quoted, possibly with adjacent string concat) — grab the first.
  let desc = g(/description:\s*\n?\s*['"]([^'"]+)['"]/);
  return {
    name,
    label: g(/label:\s*['"]([^'"]+)['"]/) || name,
    description: desc || '(no description)',
    category: g(/category:\s*['"]([^'"]+)['"]/) || '?',
  };
}

// ── pixel metrics via sharp ───────────────────────────────────────────────────
let sharp = null;
async function loadSharp() { if (sharp === null) { try { sharp = (await import('sharp')).default; } catch { sharp = false; } } return sharp; }
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}
async function metricsOf(buf, prevBuf) {
  const s = await loadSharp();
  if (!s || !buf) return null;
  try {
    // Downsample to a manageable raster for custom metrics, keep aspect.
    const W = 240;
    const img = s(buf).resize(W, null, { fit: 'inside' });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    let sr = 0, sg = 0, sb = 0, sl = 0, n = w * h;
    const lumaRow = new Float64Array(h);
    const lumas = new Float64Array(n);
    for (let y = 0; y < h; y++) {
      let rowL = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * ch;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sr += r; sg += g; sb += b; sl += l; rowL += l; lumas[y * w + x] = l;
      }
      lumaRow[y] = rowL / w;
    }
    const meanRGB = [sr / n, sg / n, sb / n].map((v) => +v.toFixed(1));
    const meanLuma = +(sl / n).toFixed(1);
    // EFFECT mean = mean over the brightest pixels (the effect, excluding dark bg).
    // Use the top ~12% so a sparse bright effect is not washed out by near-black bg.
    const sorted = Float64Array.from(lumas).sort();
    const thr = sorted[Math.floor(n * 0.88)];
    let er = 0, eg = 0, eb = 0, en = 0;
    // Hue census over SATURATED bright pixels: directly answers "is the coloured part
    // of the effect warm (fire) or cool/magenta (wrong)?" — far more reliable than a
    // mean hue when the hottest core is near-white. Bands: warm/fire 8–50°,
    // cool/blue 180–270°, magenta/pink 290–345°.
    let warm = 0, cool = 0, mag = 0, satN = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const idx = y * w + x; if (lumas[idx] < thr) continue;
      const i = idx * ch; const r = data[i], g = data[i + 1], b = data[i + 2];
      er += r; eg += g; eb += b; en++;
      const { h: hh, s: ss } = rgb2hsv(r, g, b);
      if (ss > 0.18) { satN++; if (hh >= 8 && hh <= 50) warm++; else if (hh >= 180 && hh <= 270) cool++; else if (hh >= 290 && hh <= 345) mag++; }
    }
    const effRGB = en ? [er / en, eg / en, eb / en].map((v) => +v.toFixed(1)) : meanRGB;
    const hsv = rgb2hsv(effRGB[0], effRGB[1], effRGB[2]);
    const warmFrac = satN ? +(warm / satN).toFixed(2) : 0;
    const coolFrac = satN ? +(cool / satN).toFixed(2) : 0;
    const magentaFrac = satN ? +(mag / satN).toFixed(2) : 0;
    // BANDING: high-pass the vertical luma profile (remove an 8-tap moving average);
    // slab-seam shelves are sharp horizontal steps → high residual energy. Normalize
    // by mean luma so it is brightness-independent. >0.25 ≈ visible shelving.
    const win = Math.max(2, Math.round(h / 10));
    let hp = 0;
    for (let y = 0; y < h; y++) {
      let acc = 0, c = 0;
      for (let k = -win; k <= win; k++) { const yy = y + k; if (yy >= 0 && yy < h) { acc += lumaRow[yy]; c++; } }
      const lp = acc / c;
      hp += (lumaRow[y] - lp) ** 2;
    }
    const bandingScore = +(Math.sqrt(hp / h) / (meanLuma + 4)).toFixed(3);
    // global stdev (contrast)
    let vv = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d2 = lumas[y * w + x] - meanLuma; vv += d2 * d2; }
    const stdev = +Math.sqrt(vv / n).toFixed(1);
    // frame delta vs previous frame (motion / responsiveness proxy)
    let frameDeltaMag = null;
    if (prevBuf) {
      const p = await s(prevBuf).resize(W, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true }).catch(() => null);
      if (p && p.info.width === w && p.info.height === h) {
        let dd = 0; for (let i = 0; i < data.length; i += ch) dd += Math.abs(data[i] - p.data[i]);
        frameDeltaMag = +(dd / n).toFixed(2);
      }
    }
    return { meanRGB, effRGB, effHue: +hsv.h.toFixed(0), effSat: +hsv.s.toFixed(2), effVal: +(hsv.v / 255).toFixed(2), warmFrac, coolFrac, magentaFrac, satPixels: satN, meanLuma, stdev, bandingScore, frameDeltaMag };
  } catch (e) { return { error: e.message }; }
}

/** Direct per-pixel frame diff (punch-list 2026-06-11). The aggregate `changed`
 *  detector (meanLuma/effHue/stdev deltas) FALSE-NEGATIVES on ghost-trail /
 *  low-contrast tiles: a faint trail can visibly move between control extremes
 *  while barely moving any whole-frame aggregate. This measures what actually
 *  changed: mean |Δluma| and the fraction of pixels whose luma moved by >8
 *  levels. It can only ADD sensitivity for real pixel changes (paused,
 *  deterministic frames) — identical frames always measure 0. */
async function frameDeltaOf(bufA, bufB) {
  const s = await loadSharp();
  if (!s || !bufA || !bufB) return null;
  try {
    const W = 240;
    const a = await s(bufA).resize(W, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const b = await s(bufB).resize(W, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) return null;
    const ch = a.info.channels;
    const n = a.info.width * a.info.height;
    let sum = 0, moved = 0;
    for (let i = 0; i < n; i++) {
      const ia = i * ch;
      const la = 0.2126 * a.data[ia] + 0.7152 * a.data[ia + 1] + 0.0722 * a.data[ia + 2];
      const lb = 0.2126 * b.data[ia] + 0.7152 * b.data[ia + 1] + 0.0722 * b.data[ia + 2];
      const d = Math.abs(la - lb);
      sum += d;
      if (d > 8) moved++;
    }
    return { meanAbsDiff: +(sum / n).toFixed(3), changedFrac: +(moved / n).toFixed(4) };
  } catch { return null; }
}

async function waitForServer(url, timeoutMs = 150000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return true; } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function shotRegion(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return null;
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, Math.min(box.width, VW - Math.max(0, box.x))), height: Math.max(1, Math.min(box.height, VH - Math.max(0, box.y))) };
  return page.screenshot({ clip }).catch(() => null);
}

async function captureTile(page, name, stateDir, consoleErrors, networkErrors) {
  const dir = join(rootOut, name, stateDir);
  mkdirSync(dir, { recursive: true });
  const detail = page.locator('[data-component="primitive-detail"]');
  const detailPreview = page.locator('[data-component="detail-preview"]');
  const m = { tile: name, state: stateDir, backend: null, frames: {}, controls: [], notes: [] };

  const exists = await page.evaluate((n) => !!document.querySelector(`[data-tile][data-primitive="${n}"]`), name);
  if (!exists) { m.notes.push('tile not registered'); writeFileSync(join(dir, 'metrics.json'), JSON.stringify(m, null, 2)); return m; }

  await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), name);
  await page.waitForFunction((n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n, name, { timeout: 8000 }).catch(() => m.notes.push('focus not confirmed'));
  await page.waitForTimeout(600);

  // IDLE (paused at t=0)
  await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
  await page.evaluate(() => window.__catalogSeek && window.__catalogSeek(0));
  await page.waitForTimeout(400);
  const idle = await shotRegion(page, detailPreview);
  if (idle) writeFileSync(join(dir, 'idle.png'), idle);
  m.frames.idle = await metricsOf(idle);

  // PLAY phases
  await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));
  await page.waitForTimeout(500);
  let prev = idle;
  for (let k = 1; k <= 3; k++) {
    const f = await shotRegion(page, detailPreview);
    if (f) writeFileSync(join(dir, `play-${k}.png`), f);
    m.frames[`play-${k}`] = await metricsOf(f, prev);
    prev = f;
    if (k < 3) await page.waitForTimeout(520);
  }

  // CONTROL sweeps — pause, drive each range control low / mid / high.
  await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
  await page.waitForTimeout(350);
  const ranges = detail.locator('input[type="range"][data-control]');
  const nR = await ranges.count();
  for (let i = 0; i < nR; i++) {
    const ctrl = ranges.nth(i);
    const id = (await ctrl.getAttribute('data-control')) || `range-${i}`;
    const min = parseFloat(await ctrl.getAttribute('min') || '0');
    const max = parseFloat(await ctrl.getAttribute('max') || '1');
    const step = parseFloat(await ctrl.getAttribute('step') || '0') || 0;
    // Snap to the step grid — Playwright's range fill() rejects off-step values
    // ("Malformed value"). low=min, high=max are on-grid by definition; mid snaps.
    const decimals = step && String(step).includes('.') ? String(step).split('.')[1].length : 3;
    const snap = (v) => {
      if (!step) return +v.toFixed(decimals);
      const snapped = min + Math.round((v - min) / step) * step;
      return +Math.min(max, Math.max(min, snapped)).toFixed(decimals);
    };
    const mid = snap((min + max) / 2);
    const cEntry = { id, min, max, step, frames: {} };
    const levelBufs = {};
    for (const [lvl, val] of [['low', min], ['mid', mid], ['high', max]]) {
      const t0 = Date.now();
      await ctrl.fill(String(val)); await ctrl.dispatchEvent('input'); await ctrl.dispatchEvent('change');
      await page.waitForTimeout(500);
      const f = await shotRegion(page, detailPreview);
      levelBufs[lvl] = f;
      const fn = `control-${id}-${lvl}.png`;
      if (f) writeFileSync(join(dir, fn), f);
      cEntry.frames[lvl] = { file: fn, ...(await metricsOf(f)), latencyMs: Date.now() - t0 };
    }
    // did low vs high actually differ?
    const lo = cEntry.frames.low, hi = cEntry.frames.high;
    const aggChanged = !!(lo && hi && (Math.abs((lo.meanLuma || 0) - (hi.meanLuma || 0)) > 1.5 || Math.abs((lo.effHue || 0) - (hi.effHue || 0)) > 4 || Math.abs((lo.stdev || 0) - (hi.stdev || 0)) > 1.5));
    // Second opinion for low-contrast change (ghost trails): the aggregates
    // miss a faint trail that plainly moved, so also measure the direct pixel
    // delta. >0.5% of pixels moving by >8 luma levels (or a mean |Δ| > 0.35)
    // is REAL spatial change — paused frames, so noise measures ~0. This only
    // ever flips a false-negative to true; it cannot manufacture a change.
    const pix = await frameDeltaOf(levelBufs.low, levelBufs.high);
    cEntry.pixelDiff = pix;
    cEntry.changed = aggChanged || !!(pix && (pix.changedFrac > 0.005 || pix.meanAbsDiff > 0.35));
    m.controls.push(cEntry);
  }
  if (nR === 0) m.notes.push('no range controls');

  m.backend = await page.evaluate(() => window.__catalogRig?.backend || null);
  m.consoleErrors = consoleErrors.filter((t) => t.includes(name)).slice(0, 6);
  m.networkErrors = networkErrors.slice(0, 6);
  writeFileSync(join(dir, 'metrics.json'), JSON.stringify(m, null, 2));
  return m;
}

async function main() {
  let server = null, serverLog = '';
  if (!REUSE) {
    log(`${Y}[advocate-capture]${X} starting next dev on :${PORT}…`);
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    server.stdout.on('data', (b) => { serverLog += b.toString(); });
    server.stderr.on('data', (b) => { serverLog += b.toString(); });
  }
  const shutdown = () => { try { server && server.kill('SIGKILL'); } catch {} };
  process.on('SIGTERM', () => { shutdown(); process.exit(130); });
  process.on('SIGINT', () => { shutdown(); process.exit(130); });

  const manifest = { startedAt: new Date().toISOString(), state: STATE, port: PORT, backend: null, gpu: !SWIFT, tiles: [], groundTruth: null };
  let browser = null;
  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up\n' + serverLog.slice(-1500));
    const { chromium } = await import('playwright');
    browser = SWIFT
      ? await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
      : await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] });
    const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
    const page = await context.newPage();
    const consoleErrors = [], networkErrors = [];
    page.on('console', (mm) => { if (mm.type() === 'error') consoleErrors.push(mm.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    page.on('response', (res) => { if (res.status() >= 400) networkErrors.push(`${res.status()} ${res.url()}`); });

    log(`${Y}[advocate-capture]${X} navigating ${URL}…`);
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 150000 });
    await page.waitForSelector('[data-component="animation-picker"]', { timeout: 150000 });
    await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 60000 });
    await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const rig = await page.evaluate(() => ({ backend: window.__catalogRig?.backend, deviceLost: window.__catalogRig?.deviceLostCount }));
    manifest.backend = rig.backend;
    log(`${C}[advocate-capture]${X} backend=${rig.backend} deviceLost=${rig.deviceLost}  (want webgpu for true colour)`);
    if (!SWIFT && rig.backend !== 'webgpu') log(`${R}WARNING: backend is ${rig.backend}, not webgpu — colour judgement may be off${X}`);

    for (const name of TILES) {
      const claim = claimOf(name);
      mkdirSync(join(rootOut, name), { recursive: true });
      writeFileSync(join(rootOut, name, 'claim.json'), JSON.stringify({ ...claim, groundTruthSibling: GROUND_TRUTH || null }, null, 2));
      log(`${Y}» capturing ${name} [${STATE}] (${claim.category})${X}`);
      const m = await captureTile(page, name, STATE, consoleErrors, networkErrors);
      m.backend = rig.backend;
      manifest.tiles.push({ tile: name, state: STATE, dir: `${name}/${STATE}`, claim, controls: m.controls.length, notes: m.notes });
      log(`  ${G}done${X} ${name}: frames idle+play3+${m.controls.length}ctrl  ${m.notes.join('; ')}`);
    }

    if (GROUND_TRUTH) {
      log(`${Y}» capturing ground-truth ${GROUND_TRUTH}${X}`);
      const m = await captureTile(page, GROUND_TRUTH, 'ground-truth', consoleErrors, networkErrors);
      manifest.groundTruth = { tile: GROUND_TRUTH, dir: `${GROUND_TRUTH}/ground-truth`, claim: claimOf(GROUND_TRUTH) };
    }

    manifest.deviceLostAtEnd = await page.evaluate(() => window.__catalogRig?.deviceLostCount ?? 0);
    await browser.close();
  } catch (e) {
    manifest.fatal = e.message;
    log(`${R}[advocate-capture] FATAL${X} ${e.message}`);
    try { browser && await browser.close(); } catch {}
  } finally {
    if (server) server.kill('SIGTERM');
  }

  const manifestPath = join(rootOut, `evidence-manifest-${STATE}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  log(`\n${Y}[advocate-capture]${X} manifest → ${manifestPath.replace(repoRoot + '/', '')}  backend=${manifest.backend}`);
  process.exit(manifest.fatal ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
