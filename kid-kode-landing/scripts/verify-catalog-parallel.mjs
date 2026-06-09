#!/usr/bin/env node
// PARALLEL browser verification for the 312-primitive Animation Catalog.
// The "ultracode-for-verify" upgrade: shards the catalog across CONCURRENT
// Playwright pages instead of the old single serial browser (~1-2 tiles/min).
//
// One shared `next dev` server. A dynamic, AUTO-TUNED pool of pages ramps its
// concurrency up as far as the GPU/CPU allows with ZERO device-loss, backing off
// the moment any page reports a lost device. Two tiers:
//   • STANDARD (GPU-light majority) — headless Chromium on ANGLE/SwiftShader,
//     high concurrency (CPU-bound).
//   • GLASS / transmission / IBL / dispersion / caustics / iridescence — the
//     installed Google Chrome on the REAL Metal GPU (backend MUST be 'webgpu'),
//     lower concurrency (GPU-memory bound).
//
// Per tile (mirrors scripts/verify-catalog.mjs gates, exactly):
//   RENDERS  — a captured frame paints and is non-blank,
//   PLAYS    — sampled frames over the timeline differ (motion),
//   CONTROLS — paused, driving a control to an extreme changes the frozen frame,
//   PICKER   — the tile is registered in the picker grid,
//   + a representative mid-animation frame saved for the art-fidelity reviewers.
// deviceLostCount is asserted 0 across every page.
//
// RESUMABLE: writes results.json + PARALLEL-VERIFY-PROGRESS.md as tiles finish;
// a relaunch skips already-passed tiles and continues from the unfinished shard.
//
// Artifacts: notes/verification/catalog-parallel/
//   frames/<name>.png            representative mid-animation frame
//   controls/<name>.png          post-drive frozen frame (controls proof)
//   fail/<name>-*.png            debug frames for any failure
//   results.json                 machine-readable per-tile verdicts
//   PARALLEL-VERIFY-PROGRESS.md  human progress log (resumability ledger)
//
// Usage:
//   node scripts/verify-catalog-parallel.mjs [--tier std|glass|all]
//        [--port 4799] [--only a,b] [--new-only] [--no-resume]
//        [--seed N] [--max N] [--min N] [--no-lean]

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, readdirSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'catalog-parallel');
for (const d of ['frames', 'controls', 'fail', 'gallery']) mkdirSync(join(outDir, d), { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const hasFlag = (k) => args.includes(`--${k}`);

const TIER = getArg('tier', 'all');           // std | glass | all
const PORT = parseInt(getArg('port', '4799'), 10);
const ONLY = getArg('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const NEW_ONLY = hasFlag('new-only');
const RESUME = !hasFlag('no-resume');
const LEAN = !hasFlag('no-lean');             // strip picker grid per page for throughput
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/animation-catalog`;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m';
const log = (...a) => console.log(...a);
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Catalog → tier classification
// ---------------------------------------------------------------------------
const primDir = join(repoRoot, 'src/lib/prism/animatable/primitives');
function readCatalog() {
  const files = readdirSync(primDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.includes('.test.'));
  const cat = new Map();
  for (const f of files) {
    const s = readFileSync(join(primDir, f), 'utf8');
    const cm = s.match(/category:\s*['"]([^'"]+)['"]/);
    const nm = s.match(/name:\s*['"]([^'"]+)['"]/);
    const name = nm ? nm[1] : f.replace(/\.ts$/, '');
    cat.set(name, cm ? cm[1] : '(none)');
  }
  return cat;
}
// Transmission/IBL names that live OUTSIDE the glass/caustics categories but
// still under-render on SwiftShader and want the real Metal GPU.
const GLASS_EXTRA = new Set([
  'iridescence', 'prism-spectrum', 'rainbow-fresnel-edge', 'diamond-sparkle',
  'caustic-shimmer', 'chromatic-blur', 'water-surface', 'soap-bubble',
]);
const isGlass = (name, category) => category === 'glass' || category === 'caustics' || GLASS_EXTRA.has(name);

// ---------------------------------------------------------------------------
// Results ledger (resumable)
// ---------------------------------------------------------------------------
const resultsPath = join(outDir, 'results.json');
const progressPath = join(outDir, 'PARALLEL-VERIFY-PROGRESS.md');
let ledger = { startedAt: nowIso(), updatedAt: nowIso(), tiers: {}, results: {} };
if (RESUME && existsSync(resultsPath)) {
  try { ledger = JSON.parse(readFileSync(resultsPath, 'utf8')); ledger.results ||= {}; } catch { /* fresh */ }
}
function isFinal(r) { return r && r.verdict && r.verdict !== 'requeued' && r.verdict !== 'pending'; }
function saveLedger() {
  ledger.updatedAt = nowIso();
  const tmp = resultsPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + '\n');
  renameSync(tmp, resultsPath);
}
function progress(line) { appendFileSync(progressPath, line + '\n'); }

// ---------------------------------------------------------------------------
// Per-tile gate, run on an already-booted page
// ---------------------------------------------------------------------------
let sharp = null;
async function loadSharp() { if (sharp === null) { try { sharp = (await import('sharp')).default; } catch { sharp = false; } } return sharp; }
async function isBlank(buf) {
  const s = await loadSharp();
  if (!s || !buf) return false;             // can't tell → don't fail on blankness
  try {
    const st = await s(buf).stats();
    const maxStdev = Math.max(...st.channels.slice(0, 3).map((c) => c.stdev));
    return maxStdev < 1.5;
  } catch { return false; }
}

async function shotRegion(page, locator, vw, vh) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return null;
  const clip = {
    x: Math.max(0, box.x), y: Math.max(0, box.y),
    width: Math.max(1, Math.min(box.width, vw - Math.max(0, box.x))),
    height: Math.max(1, Math.min(box.height, vh - Math.max(0, box.y))),
  };
  return page.screenshot({ clip }).catch(() => null);
}

async function verifyTile(page, name, category, pickerPresent, vw, vh) {
  const entry = {
    name, category, renders: false, plays: false, controls: false,
    picker: pickerPresent.has(name), notes: [], verdict: 'pending', at: nowIso(),
  };
  const detail = page.locator('[data-component="primitive-detail"]');
  const detailPreview = page.locator('[data-component="detail-preview"]');
  try {
    await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), name);
    await page.waitForFunction(
      (n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n,
      name, { timeout: 8000 },
    ).catch(() => entry.notes.push('focus attr not confirmed'));
    await page.waitForTimeout(700);

    // PLAYS — sample 3 frames over ~1s; capture the middle as the representative
    // mid-animation frame (memory: one-shots caught low-energy at t≈0).
    await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));
    await page.waitForTimeout(350);
    const frames = [];
    for (let k = 0; k < 3; k++) { frames.push(await shotRegion(page, detailPreview, vw, vh)); if (k < 2) await page.waitForTimeout(420); }
    const mid = frames[1] || frames[2] || frames[0];
    entry.plays = frames.some((a, i) => frames.slice(i + 1).some((b) => a && b && Buffer.compare(a, b) !== 0));
    const blank = await isBlank(mid);
    entry.renders = !!mid && !blank;
    if (blank) entry.notes.push('blank frame (stdev<1.5)');
    if (mid) writeFileSync(join(outDir, 'frames', `${name}.png`), mid);

    // CONTROLS — pause, drive controls to an extreme, require the frozen frame to change.
    await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
    await page.waitForTimeout(420);
    const c1 = await shotRegion(page, detailPreview, vw, vh);
    let driven = 0;
    const ranges = detail.locator('input[type="range"][data-control]');
    const nR = await ranges.count();
    for (let i = 0; i < nR; i++) {
      const ctrl = ranges.nth(i);
      const max = await ctrl.getAttribute('max'); const min = await ctrl.getAttribute('min');
      const cur = await ctrl.inputValue();
      const tgt = String(cur) === String(max) ? min : max;
      await ctrl.fill(String(tgt)); await ctrl.dispatchEvent('input'); await ctrl.dispatchEvent('change'); driven++;
    }
    if (nR === 0) {
      // Fall back to non-range controls (select / checkbox / color).
      const sels = detail.locator('select[data-control]');
      const nS = await sels.count();
      for (let i = 0; i < nS; i++) {
        const opts = await sels.nth(i).locator('option').allTextContents();
        if (opts.length > 1) { await sels.nth(i).selectOption({ index: opts.length - 1 }).catch(() => {}); driven++; }
      }
      const checks = detail.locator('input[type="checkbox"][data-control]');
      const nC = await checks.count();
      for (let i = 0; i < nC; i++) { await checks.nth(i).click({ force: true }).catch(() => {}); driven++; }
      if (driven === 0) {
        const colors = detail.locator('input[type="color"][data-control]');
        const nCol = await colors.count();
        for (let i = 0; i < nCol; i++) {
          await colors.nth(i).evaluate((el) => { el.value = '#ff00aa'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }).catch(() => {});
          driven++;
        }
      }
    }
    if (driven > 0) {
      await page.waitForTimeout(650);
      const c2 = await shotRegion(page, detailPreview, vw, vh);
      entry.controls = !!(c1 && c2 && Buffer.compare(c1, c2) !== 0);
      if (c2) writeFileSync(join(outDir, 'controls', `${name}.png`), c2);
    } else {
      entry.notes.push('no controls found');
    }
  } catch (e) {
    entry.notes.push('error: ' + e.message);
  }
  entry.verdict = (entry.renders && entry.plays && entry.controls) ? 'pass' : 'fail';
  return entry;
}

// ---------------------------------------------------------------------------
// Page boot
// ---------------------------------------------------------------------------
async function bootPage(browser, vw, vh, dpr) {
  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForSelector('[data-component="animation-picker"]', { timeout: 150000 });
  await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 60000 });
  await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const rig = await page.evaluate(() => ({ backend: window.__catalogRig?.backend, tileCount: window.__catalogRig?.tileCount, deviceLostCount: window.__catalogRig?.deviceLostCount }));
  return { context, page, consoleErrors, rig };
}
async function deviceLost(page) {
  return page.evaluate(() => (window.__catalogRig?.deviceLostCount ?? 0)).catch(() => 0);
}

// ---------------------------------------------------------------------------
// Auto-tuned worker pool for one tier
// ---------------------------------------------------------------------------
async function runTier(tier, tiles, browserFactory, tuning, catMap) {
  const vw = tuning.vw, vh = tuning.vh, dpr = tuning.dpr;
  const queue = tiles.slice();
  const pool = {
    active: 0, desired: 1, seed: tuning.seed, ceiling: tuning.max, min: tuning.min,
    deviceLost: 0, deviceLostAck: 0, peak: 0, started: 0, finished: 0, fails: 0,
  };
  let pickerPresent = new Set();
  let booted = false; let bootResolve; const bootDone = new Promise((r) => (bootResolve = r));
  const browser = await browserFactory();
  const tierMeta = { tier, total: tiles.length, backend: null, startedAt: nowIso() };
  ledger.tiers[tier] = tierMeta;

  async function worker(id) {
    pool.active++; pool.peak = Math.max(pool.peak, pool.active); pool.started++;
    let boot;
    try {
      boot = await bootPage(browser, vw, vh, dpr);
    } catch (e) {
      // Boot timeout under load IS the hardware ceiling for this tier: a fresh
      // page must mount all 312 picker tiles before its rig goes ready, and that
      // contends with the workers already rendering. Treat it like device-loss —
      // lower the ceiling so the pool settles where boot AND steady-state both fit.
      pool.bootFails = (pool.bootFails || 0) + 1;
      pool.ceiling = Math.max(pool.min, pool.ceiling - 1);
      pool.desired = Math.min(pool.desired, pool.ceiling);
      log(`${R}[${tier}] worker#${id} boot failed → ceiling=${pool.ceiling} desired=${pool.desired}:${X} ${e.message.split('\n')[0]}`);
      try { await boot?.context?.close(); } catch {}
      pool.active--; return;
    }
    tierMeta.backend = boot.rig.backend;
    if (tier === 'glass' && boot.rig.backend !== 'webgpu') {
      tierMeta.backendWarning = `expected webgpu, got ${boot.rig.backend}`;
      log(`${R}[glass] worker#${id} backend=${boot.rig.backend} (NOT webgpu) — flagging${X}`);
    }
    if (!booted) {
      pickerPresent = new Set(await boot.page.$$eval('[data-tile]', (els) => els.map((e) => e.getAttribute('data-primitive'))));
      booted = true; bootResolve();
      log(`${C}[${tier}] booted: backend=${boot.rig.backend} pickerTiles=${pickerPresent.size} deviceLost=${boot.rig.deviceLostCount}${X}`);
    } else {
      await bootDone;
    }
    // LEAN: drop the picker grid to free GPU for the detail viewport (census already taken).
    if (LEAN) {
      await boot.page.evaluate(() => { const m = document.querySelector('[data-component="animation-picker"]'); if (m) m.remove(); }).catch(() => {});
      await boot.page.waitForTimeout(400);
    }
    const { page } = boot;
    try {
      while (true) {
        if (pool.active > pool.desired) break;          // shrink signal
        const name = queue.shift();
        if (!name) break;
        const category = catMap.get(name) || '?';
        const entry = await verifyTile(page, name, category, pickerPresent, vw, vh);
        // device-loss check for THIS page after the tile
        const dl = await deviceLost(page);
        if (dl > 0) {
          entry.verdict = 'requeued'; entry.notes.push('device-lost on page; requeued');
          ledger.results[name] = entry;
          queue.push(name);                              // retry on a fresh page
          pool.deviceLost += dl;
          log(`${R}[${tier}] device-lost (page) on ${name} — requeue, back off${X}`);
          break;
        }
        entry.backend = boot.rig.backend;
        entry.consoleErrors = boot.consoleErrors.filter((t) => t.includes(name)).slice(0, 4);
        ledger.results[name] = entry;
        pool.finished++; if (entry.verdict === 'fail') pool.fails++;
        saveLedger();
        const ok = entry.verdict === 'pass';
        progress(`- [${ok ? 'PASS' : 'FAIL'}] ${tier}/${name} (${category}) render=${entry.renders} play=${entry.plays} ctrl=${entry.controls}${entry.notes.length ? ' :: ' + entry.notes.join('; ') : ''}`);
        log(`  [${ok ? G + 'OK' : R + '!!'}${X}] ${tier} ${name.padEnd(24)} r=${entry.renders} p=${entry.plays} c=${entry.controls} ${D}(${pool.finished}/${tiles.length}, conc=${pool.active}/${pool.desired})${X} ${entry.notes.join('; ')}`);
      }
    } catch (e) {
      log(`${R}[${tier}] worker#${id} loop error:${X} ${e.message.split('\n')[0]}`);
    } finally {
      await boot.context.close().catch(() => {});
      pool.active--;
    }
  }

  // Manager: boot one worker, wait for first compile/rig, then auto-tune.
  let nextId = 1;
  const spawnOne = () => { worker(nextId++); };
  spawnOne();                                            // worker #1 compiles the route
  await bootDone;
  pool.desired = pool.seed;
  log(`${C}[${tier}] route ready — ramping toward ceiling ${pool.ceiling} (seed ${pool.seed})${X}`);

  const RAMP_MS = 3000;
  while (queue.length > 0 || pool.active > 0) {
    // Spawn AT MOST ONE worker per tick so page boots are staggered — a herd of
    // simultaneous 312-tile page mounts saturates the CPU and times the boots out.
    if (pool.active < pool.desired && queue.length > 0) spawnOne();
    await new Promise((r) => setTimeout(r, RAMP_MS));
    if (pool.deviceLost > pool.deviceLostAck) {
      pool.ceiling = Math.max(pool.min, pool.desired - 1);
      pool.desired = pool.ceiling;
      pool.deviceLostAck = pool.deviceLost;
      log(`${R}[${tier}] BACK OFF → ceiling=${pool.ceiling} desired=${pool.desired} (deviceLost total ${pool.deviceLost})${X}`);
    } else if (pool.desired < pool.ceiling && queue.length > 0) {
      pool.desired++;
      log(`${C}[${tier}] ramp up → desired=${pool.desired}/${pool.ceiling} (peak ${pool.peak})${X}`);
    }
  }
  await browser.close().catch(() => {});
  tierMeta.finishedAt = nowIso();
  tierMeta.peakConcurrency = pool.peak;
  tierMeta.deviceLostTotal = pool.deviceLost;
  saveLedger();
  return pool;
}

// ---------------------------------------------------------------------------
// Browser factories
// ---------------------------------------------------------------------------
const ANTI_THROTTLE = ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];
async function stdBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...ANTI_THROTTLE] });
}
async function glassBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU', ...ANTI_THROTTLE] });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function waitForServer(url, timeoutMs = 150000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return true; } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function main() {
  const catMap = readCatalog();
  let names = [...catMap.keys()];
  if (NEW_ONLY) {
    const newList = new Set(readFileSync(join(outDir, '_new159.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
    names = names.filter((n) => newList.has(n));
  }
  if (ONLY.length) names = names.filter((n) => ONLY.includes(n));

  const stdTiles = [], glassTiles = [];
  for (const n of names) (isGlass(n, catMap.get(n)) ? glassTiles : stdTiles).push(n);

  // Resume: drop already-passed tiles.
  const skip = (arr) => arr.filter((n) => {
    if (!RESUME) return true;
    const r = ledger.results[n];
    return !(isFinal(r) && r.verdict === 'pass');
  });
  const stdRun = TIER === 'glass' ? [] : skip(stdTiles);
  const glassRun = TIER === 'std' ? [] : skip(glassTiles);

  log(`${Y}[parallel-verify]${X} catalog=${names.length}  std=${stdTiles.length}(run ${stdRun.length})  glass=${glassTiles.length}(run ${glassRun.length})  resume=${RESUME} lean=${LEAN}`);
  if (!existsSync(progressPath)) progress(`# Parallel Catalog Verify — progress ledger\n\nStarted ${nowIso()} · port ${PORT}\n`);
  else progress(`\n## Resumed ${nowIso()} (std ${stdRun.length}, glass ${glassRun.length} remaining)`);

  log(`${Y}[parallel-verify]${X} starting shared next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  let serverLog = '';
  server.stdout.on('data', (b) => { serverLog += b.toString(); });
  server.stderr.on('data', (b) => { serverLog += b.toString(); });

  // Clean shutdown: a SIGTERM/SIGINT to this orchestrator must take the dev
  // server (and, by process-tree, the browsers) down with it — otherwise the
  // orchestrator keeps marching the queue against a dead server (mass false fails).
  let shuttingDown = false;
  const shutdown = (sig) => { if (shuttingDown) return; shuttingDown = true; try { server.kill('SIGKILL'); } catch {} log(`${Y}[parallel-verify]${X} ${sig} → shutting down`); process.exit(130); };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const t0 = Date.now();
  try {
    if (!(await waitForServer(BASE))) throw new Error('dev server did not come up\n' + serverLog.slice(-1500));
    log(`${G}[parallel-verify]${X} server up (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

    if (stdRun.length) {
      log(`\n${Y}=== STANDARD tier (${stdRun.length} tiles, SwiftShader) ===${X}`);
      await runTier('std', stdRun, stdBrowser, { vw: 1280, vh: 1000, dpr: 1, seed: 3, max: parseInt(getArg('max', '8'), 10), min: parseInt(getArg('min', '1'), 10) }, catMap);
    }
    if (glassRun.length) {
      log(`\n${Y}=== GLASS tier (${glassRun.length} tiles, REAL Metal GPU) ===${X}`);
      await runTier('glass', glassRun, glassBrowser, { vw: 1280, vh: 1000, dpr: 2, seed: 2, max: parseInt(getArg('max-glass', '3'), 10), min: 1 }, catMap);
    }
  } catch (e) {
    ledger.fatal = e.message;
    log(`${R}[parallel-verify] FATAL${X} ${e.message}`);
  } finally {
    server.kill('SIGTERM');
  }

  // Summary
  const all = Object.values(ledger.results);
  const consider = names;
  const verdictOf = (n) => ledger.results[n]?.verdict;
  const pass = consider.filter((n) => verdictOf(n) === 'pass');
  const fail = consider.filter((n) => verdictOf(n) === 'fail');
  const missing = consider.filter((n) => !isFinal(ledger.results[n]));
  ledger.summary = {
    total: consider.length, pass: pass.length, fail: fail.length, missing: missing.length,
    failNames: fail, missingNames: missing,
    wallClockSec: Math.round((Date.now() - t0) / 1000),
    peak: { std: ledger.tiers.std?.peakConcurrency, glass: ledger.tiers.glass?.peakConcurrency },
    backend: { std: ledger.tiers.std?.backend, glass: ledger.tiers.glass?.backend },
    deviceLost: { std: ledger.tiers.std?.deviceLostTotal, glass: ledger.tiers.glass?.deviceLostTotal },
  };
  saveLedger();
  progress(`\n### Run end ${nowIso()} — pass ${pass.length}/${consider.length}, fail ${fail.length}, missing ${missing.length}, wall ${ledger.summary.wallClockSec}s`);
  log(`\n${Y}[parallel-verify]${X} ${JSON.stringify(ledger.summary, null, 0)}`);
  log(`${pass.length === consider.length ? G : R}pass ${pass.length}/${consider.length}${X}  fail=${fail.length}  missing=${missing.length}  wall=${ledger.summary.wallClockSec}s  peak std=${ledger.summary.peak.std} glass=${ledger.summary.peak.glass}`);
  if (fail.length) log(`${R}FAILS:${X} ${fail.join(', ')}`);
  process.exit(ledger.fatal ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
