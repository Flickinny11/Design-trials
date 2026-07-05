#!/usr/bin/env node
// SMARTER re-probe for tiles the parallel gate flagged as fail. The fast parallel
// gate has three known blind spots that produce FALSE negatives (not app bugs):
//   • pointer-reactive primitives (pointer/*, hover-lift, magnetic-*) only move
//     when the pointer moves — the bulk gate never moves the mouse over the detail;
//   • one-shot / very-slow primitives settle between the 3 closely-spaced samples;
//   • controls whose visual effect is phase-dependent show nothing at the settled
//     frame the bulk gate happens to pause on.
// This probe removes those blind spots: it re-triggers from t=0, samples a LONGER
// window WHILE jiggling the pointer across the preview, and tests controls against
// BOTH extremes. A tile that STILL shows no motion / no control response here is a
// genuine functional failure to FIX; everything it clears was a gate false-negative.
//
// It serial-probes (few tiles, accuracy over speed), updates results.json verdicts
// in place (reprobed:true), and writes reprobe.json. Glass-tier fails are probed on
// the real Metal GPU (channel:'chrome'); the rest on the SwiftShader path.
//
// Usage: node scripts/reprobe-catalog-fails.mjs [--port 4805] [--only a,b]

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'catalog-parallel');
mkdirSync(join(outDir, 'reprobe'), { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PORT = parseInt(getArg('port', '4805'), 10);
const ONLY = getArg('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const BASE = `http://localhost:${PORT}`;
const URL = `${BASE}/animation-catalog`;
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', X = '\x1b[0m';
const log = (...a) => console.log(...a);

const resultsPath = join(outDir, 'results.json');
const ledger = JSON.parse(readFileSync(resultsPath, 'utf8'));

const GLASS_EXTRA = new Set(['iridescence', 'prism-spectrum', 'rainbow-fresnel-edge', 'diamond-sparkle', 'caustic-shimmer', 'chromatic-blur', 'water-surface', 'soap-bubble']);
const isGlass = (n) => { const c = ledger.results[n]?.category; return c === 'glass' || c === 'caustics' || GLASS_EXTRA.has(n); };

let sharp = null;
async function loadSharp() { if (sharp === null) { try { sharp = (await import('sharp')).default; } catch { sharp = false; } } return sharp; }
async function isBlank(buf) { const s = await loadSharp(); if (!s || !buf) return false; try { const st = await s(buf).stats(); return Math.max(...st.channels.slice(0, 3).map((c) => c.stdev)) < 1.5; } catch { return false; } }

async function waitForServer(url, timeoutMs = 150000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { try { const res = await fetch(url); if (res.ok || res.status === 404) return true; } catch {} await new Promise((r) => setTimeout(r, 600)); }
  return false;
}

async function shotRegion(page, locator, vw, vh) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return null;
  const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.max(1, Math.min(box.width, vw - Math.max(0, box.x))), height: Math.max(1, Math.min(box.height, vh - Math.max(0, box.y))) };
  return page.screenshot({ clip }).catch(() => null);
}

async function probeTile(page, name, vw, vh) {
  const detail = page.locator('[data-component="primitive-detail"]');
  const preview = page.locator('[data-component="detail-preview"]');
  const out = { name, renders: false, plays: false, controls: false, notes: [] };
  // Re-trigger from t=0 (focus sets playing true) to catch one-shots from the start.
  await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), name);
  await page.waitForFunction((n) => document.querySelector('[data-component="primitive-detail"]')?.getAttribute('data-focused') === n, name, { timeout: 8000 }).catch(() => out.notes.push('focus unconfirmed'));
  await page.waitForTimeout(500);
  await page.evaluate((n) => window.__catalogFocus && window.__catalogFocus(n), name); // re-trigger
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(true));

  const box = await preview.boundingBox();
  // PLAY (long window + pointer jiggle across the preview).
  const frames = [];
  for (let k = 0; k < 6; k++) {
    if (box) { const fx = box.x + box.width * (0.2 + 0.6 * (k % 3) / 2); const fy = box.y + box.height * (0.25 + 0.5 * ((k + 1) % 2)); await page.mouse.move(fx, fy); }
    await page.waitForTimeout(480);
    frames.push(await shotRegion(page, preview, vw, vh));
  }
  out.plays = frames.some((a, i) => frames.slice(i + 1).some((b) => a && b && Buffer.compare(a, b) !== 0));
  const mid = frames[2] || frames[3] || frames[0];
  out.renders = !!mid && !(await isBlank(mid));
  if (mid) writeFileSync(join(outDir, 'reprobe', `${name}.png`), mid);

  // CONTROLS (pause, then test against BOTH extremes; mouse parked off-preview).
  await page.mouse.move(2, 2);
  await page.evaluate(() => window.__catalogSetPlaying && window.__catalogSetPlaying(false));
  await page.waitForTimeout(450);
  const baseline = await shotRegion(page, preview, vw, vh);
  const variants = [];
  const ranges = detail.locator('input[type="range"][data-control]');
  const nR = await ranges.count();
  if (nR > 0) {
    for (const ext of ['max', 'min']) {
      for (let i = 0; i < nR; i++) {
        const ctrl = ranges.nth(i); const v = await ctrl.getAttribute(ext);
        if (v != null) { await ctrl.fill(String(v)); await ctrl.dispatchEvent('input'); await ctrl.dispatchEvent('change'); }
      }
      await page.waitForTimeout(550);
      variants.push(await shotRegion(page, preview, vw, vh));
    }
  } else {
    const sels = detail.locator('select[data-control]'); const nS = await sels.count();
    for (let i = 0; i < nS; i++) { const o = await sels.nth(i).locator('option').count(); if (o > 1) await sels.nth(i).selectOption({ index: o - 1 }).catch(() => {}); }
    const checks = detail.locator('input[type="checkbox"][data-control]'); const nC = await checks.count();
    for (let i = 0; i < nC; i++) await checks.nth(i).click({ force: true }).catch(() => {});
    const colors = detail.locator('input[type="color"][data-control]'); const nCol = await colors.count();
    for (let i = 0; i < nCol; i++) await colors.nth(i).evaluate((el) => { el.value = '#ff00aa'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }).catch(() => {});
    if (nS + nC + nCol === 0) out.notes.push('no controls');
    await page.waitForTimeout(550);
    variants.push(await shotRegion(page, preview, vw, vh));
  }
  out.controls = variants.some((v) => baseline && v && Buffer.compare(baseline, v) !== 0);
  return out;
}

async function run(tier, names, factory, vw, vh, dpr) {
  if (!names.length) return [];
  const { chromium } = await import('playwright');
  const browser = await factory(chromium);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 90000 });
  await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const backend = await page.evaluate(() => window.__catalogRig?.backend);
  log(`${Y}[reprobe ${tier}]${X} backend=${backend} probing ${names.length}`);
  const results = [];
  for (const n of names) {
    const r = await probeTile(page, n, vw, vh);
    r.backend = backend; r.tier = tier;
    const ok = r.renders && r.plays && r.controls;
    r.verdict = ok ? 'pass' : 'fail';
    results.push(r);
    log(`  [${ok ? G + 'PASS' : R + 'FAIL'}${X}] ${n.padEnd(24)} r=${r.renders} p=${r.plays} c=${r.controls} ${r.notes.join(';')}`);
  }
  await browser.close().catch(() => {});
  return results;
}

async function main() {
  let fails = Object.entries(ledger.results).filter(([, v]) => v.verdict === 'fail').map(([k]) => k);
  if (ONLY.length) fails = ONLY;
  if (!fails.length) { log('no fails to reprobe'); return; }
  log(`${Y}[reprobe]${X} ${fails.length} tile(s): ${fails.join(', ')}`);

  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
  let slog = ''; server.stdout.on('data', (b) => (slog += b)); server.stderr.on('data', (b) => (slog += b));
  const shutdown = () => { try { server.kill('SIGKILL'); } catch {} process.exit(130); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

  const all = [];
  try {
    if (!(await waitForServer(BASE))) throw new Error('server did not come up\n' + slog.slice(-1000));
    const std = fails.filter((n) => !isGlass(n));
    const glass = fails.filter((n) => isGlass(n));
    all.push(...await run('std', std, (c) => c.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), 1280, 1000, 1));
    all.push(...await run('glass', glass, (c) => c.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }), 1280, 1000, 2));
  } catch (e) { log(`${R}[reprobe] FATAL${X} ${e.message}`); } finally { server.kill('SIGKILL'); }

  // Update the main ledger in place.
  for (const r of all) {
    const prev = ledger.results[r.name] || {};
    ledger.results[r.name] = { ...prev, ...r, reprobed: true, bulkVerdict: prev.verdict };
  }
  const tmp = resultsPath + '.tmp'; writeFileSync(tmp, JSON.stringify(ledger, null, 2) + '\n'); renameSync(tmp, resultsPath);
  writeFileSync(join(outDir, 'reprobe', 'reprobe.json'), JSON.stringify({ at: new Date().toISOString(), results: all }, null, 2) + '\n');

  const cleared = all.filter((r) => r.verdict === 'pass').map((r) => r.name);
  const still = all.filter((r) => r.verdict === 'fail').map((r) => r.name);
  log(`\n${Y}[reprobe]${X} cleared ${cleared.length}/${all.length} as gate false-negatives: ${cleared.join(', ')}`);
  log(`${still.length ? R : G}[reprobe] still failing (candidate genuine FIX): ${still.join(', ') || 'NONE'}${X}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
