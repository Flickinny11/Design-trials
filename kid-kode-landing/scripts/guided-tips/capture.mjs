#!/usr/bin/env node
// GUIDED-TIPS verification harness — DPR-2 frames + per-criterion NUMERIC logs +
// REAL interactions, across {desktop, tablet, constrained, mobile}.
//
// Usage:
//   node scripts/guided-tips/capture.mjs --phase=p1 [--port=4793] [--viewport=desktop]
//
// Drives the live editor: clears the seen flag, proves first-visit auto-launch +
// the no-relaunch gate (C2), re-triggers from the lightbulb (real coordinate
// click — the bulb's idle breathing trips Playwright actionability, so we click
// pixels like a user does), steps the whole tour capturing frames, samples the
// driven-cursor path (C3), measures the chrome-spotlight cutout edge (C4),
// scene-spotlight luma delta (C6), the popup controls (C5), the single-canvas
// invariant (C7) and console errors. Writes notes/verification/guided-tips/<phase>/.

import { chromium } from 'playwright';
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const PHASE = args.phase || 'p1';
const PORT = Number(args.port || 4793);
const URL = `http://localhost:${PORT}/`;
const ONLY_VIEWPORT = args.viewport || null;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'constrained', width: 880, height: 600 },
  { name: 'mobile', width: 390, height: 844 },
].filter((v) => !ONLY_VIEWPORT || v.name === ONLY_VIEWPORT);

const outDir = join(repoRoot, 'notes', 'verification', 'guided-tips', PHASE);
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── pixel helpers ───────────────────────────────────────────────────────────
async function regionLuma(pngPath, dpr, { x, y, w, h }) {
  const left = Math.max(0, Math.round(x * dpr));
  const top = Math.max(0, Math.round(y * dpr));
  const width = Math.max(1, Math.round(w * dpr));
  const height = Math.max(1, Math.round(h * dpr));
  try {
    const { data, info } = await sharp(pngPath)
      .extract({ left, top, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    let sum = 0, max = 0, sumsq = 0, n = 0;
    for (let i = 0; i < data.length; i += ch) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += lum; sumsq += lum * lum; if (lum > max) max = lum; n++;
    }
    const mean = sum / n;
    const variance = sumsq / n - mean * mean;
    return { mean: +mean.toFixed(2), max: +max.toFixed(2), std: +Math.sqrt(Math.max(0, variance)).toFixed(2) };
  } catch {
    return { mean: 0, max: 0, std: 0 };
  }
}

// Sample a horizontal luma profile across an edge to measure feather width.
async function edgeProfile(pngPath, dpr, { x, y, w, h }) {
  const left = Math.max(0, Math.round(x * dpr));
  const top = Math.max(0, Math.round(y * dpr));
  const width = Math.max(2, Math.round(w * dpr));
  const height = Math.max(1, Math.round(h * dpr));
  const { data, info } = await sharp(pngPath)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const cols = [];
  for (let cx = 0; cx < info.width; cx++) {
    let sum = 0;
    for (let cy = 0; cy < info.height; cy++) {
      const i = (cy * info.width + cx) * ch;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    cols.push(sum / info.height);
  }
  const lo = Math.min(...cols), hi = Math.max(...cols);
  const range = hi - lo;
  const t20 = lo + range * 0.2, t80 = lo + range * 0.8;
  let first = -1, last = -1;
  for (let i = 0; i < cols.length; i++) {
    if (cols[i] >= t20 && first < 0) first = i;
    if (cols[i] <= t80) last = i;
  }
  // feather width in device px where the edge transitions (gradual = smooth)
  const transitionPx = Math.abs(last - first);
  return { lo: +lo.toFixed(1), hi: +hi.toFixed(1), range: +range.toFixed(1), transitionPx };
}

async function setSeen(page, seen) {
  await page.evaluate((s) => {
    if (s) { /* mark via finishing */ } else { window.__PRISM_TIPS__?.clearSeen?.(); }
  }, seen);
}

async function tipState(page) {
  return page.evaluate(() => window.__PRISM_TIPS__?.state?.() ?? null);
}

async function bulbBox(page) {
  return page.locator('[data-component="guided-tips-lightbulb"]').boundingBox().catch(() => null);
}
async function clickBulb(page) {
  const b = await bulbBox(page);
  if (!b) return false;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  return true;
}
// Real coordinate click on a selector (the popup's animated glass trips
// Playwright's actionability heuristic; a pixel click is what a user/advocate
// does and is the honest "real interaction" the GATE requires).
async function clickSel(page, selector) {
  const el = page.locator(selector).first();
  const box = await el.boundingBox().catch(() => null);
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
async function canvasCount(page) {
  return page.evaluate(() => document.querySelectorAll('canvas').length);
}

// ── per-viewport run ──────────────────────────────────────────────────────────
async function runViewport(browser, vp) {
  const dpr = 2;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));

  const log = { viewport: vp.name, dpr, checks: {} };
  const shot = async (name, clip) => {
    const p = join(outDir, `${vp.name}-${name}.png`);
    await page.screenshot({ path: p, clip });
    return p;
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // wait for the single canvas + boot
  await page.waitForSelector('canvas', { timeout: 30000 }).catch(() => {});
  await sleep(4200);

  // ── C7 baseline: canvas count with the tour IDLE (in galaxy + preview-app) ──
  // The editor itself owns >1 DOM canvas in galaxy/canvas (GraphScene + the
  // pre-existing 2D Minimap); preview-app hides the Minimap. The walkthrough
  // must add ZERO canvases (its 3D artifact shares the ONE scene renderer).
  await page.evaluate(() => window.__PRISM_TIPS__?.close?.());
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('galaxy'));
  await sleep(1200);
  const baselineGalaxyIdle = await canvasCount(page);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('preview-app'));
  await sleep(1200);
  const baselinePreviewIdle = await canvasCount(page);

  // ── C2: first-visit auto-launch + gate ─────────────────────────────────────
  await page.evaluate(() => window.__PRISM_TIPS__?.close?.()); // clear any state
  await setSeen(page, false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 }).catch(() => {});
  await sleep(3200); // boot + 1.6s auto-launch
  const autoState = await tipState(page);
  await shot('c2-autolaunch');
  // finish/skip → seen set → reload should NOT auto-launch
  await page.evaluate(() => window.__PRISM_TIPS__?.skip?.());
  await sleep(400);
  const seenAfter = await page.evaluate(() => window.__PRISM_TIPS__?.seen?.());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 }).catch(() => {});
  await sleep(3200);
  const gateState = await tipState(page);
  await shot('c2-reload-no-launch');
  // re-trigger from the lightbulb (real click)
  await clickBulb(page);
  await sleep(900);
  const relaunchState = await tipState(page);
  await shot('c2-relaunch');
  log.checks.C2 = {
    autoLaunchStatus: autoState?.status, autoLaunchStep: autoState?.stepId,
    seenAfterSkip: seenAfter,
    gateStatusAfterReload: gateState?.status,
    relaunchStatus: relaunchState?.status,
    pass: autoState?.status === 'running' && seenAfter === true && gateState?.status === 'idle' && relaunchState?.status === 'running',
  };

  // ── C1: lightbulb glow (idle) ──────────────────────────────────────────────
  await page.evaluate(() => window.__PRISM_TIPS__?.close?.());
  await sleep(500);
  const bb = await bulbBox(page);
  const c1Frame = await shot('c1-lightbulb');
  let c1 = { present: !!bb, box: bb };
  if (bb) {
    const halo = await regionLuma(c1Frame, dpr, { x: bb.x - 6, y: bb.y - 6, w: bb.width + 12, h: bb.height + 12 });
    const bg = await regionLuma(c1Frame, dpr, { x: Math.max(0, bb.x - 140), y: bb.y + 4, w: 60, h: 34 });
    c1 = { ...c1, haloLuma: halo, bgLuma: bg, glowAboveBg: +(halo.mean - bg.mean).toFixed(2), nonFlat: halo.std > 6 };
    // zoom crop of the bulb
    await shot('c1-lightbulb-crop', { x: Math.max(0, bb.x - 26), y: Math.max(0, bb.y - 26), width: 94, height: 94 });
  }
  c1.pass = c1.present && (c1.glowAboveBg ?? 0) > 3 && (c1.nonFlat ?? false);
  log.checks.C1 = c1;

  // ── C3: driven cursor path ──────────────────────────────────────────────────
  await clickBulb(page);
  // sample cursor over the first travel
  const samples = [];
  for (let i = 0; i < 16; i++) {
    const c = await page.evaluate(() => window.__PRISM_TIPS_CURSOR__ ?? null);
    if (c) samples.push({ ...c, t: i * 70 });
    if (i === 2) await shot('c3-cursor-a');
    if (i === 6) await shot('c3-cursor-b');
    if (i === 11) await shot('c3-cursor-c');
    await sleep(70);
  }
  let pathLen = 0;
  for (let i = 1; i < samples.length; i++) {
    pathLen += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  const traveled = samples.some((s) => s.traveling);
  log.checks.C3 = {
    samples: samples.length,
    pathLengthPx: Math.round(pathLen),
    travelDurationMs: samples.length * 70,
    sawTraveling: traveled,
    start: samples[0] ?? null,
    end: samples[samples.length - 1] ?? null,
    pass: pathLen > 40 && traveled,
  };

  // ── step through the whole tour: frames + C4/C6/C7 ──────────────────────────
  const steps = [];
  for (let i = 0; i < (autoState?.total ?? 7); i++) {
    await page.evaluate((idx) => window.__PRISM_TIPS__?.goTo?.(idx), i);
    await sleep(1400); // mode switch + measure + entrance
    const st = await tipState(page);
    const frame = await shot(`step-${i}-${st?.stepId ?? i}`);
    const cc = await canvasCount(page);
    const rec = { index: i, stepId: st?.stepId, artifactFrameRect: st?.artifactFrameRect, domCanvasCount: cc };
    // popup crop
    const pbox = await page.locator('[data-component="tip-popup"]').boundingBox().catch(() => null);
    if (pbox) await shot(`step-${i}-${st?.stepId}-popup`, { x: Math.max(0, pbox.x - 6), y: Math.max(0, pbox.y - 6), width: Math.min(vp.width * dpr, pbox.width + 12) / 1, height: pbox.height + 12 });

    // C4 — DOM-chrome spotlight edge (dom steps with a chrome target)
    const spot = await page.evaluate(() => {
      const r = document.querySelector('[data-component="tip-scrim"] .tip-frame-ring');
      return null; // edge measured from frame below using the target rect
    });
    if (st && ['welcome', 'canvas', 'build', 'relaunch'].includes(st.stepId)) {
      // resolve the chrome target rect to sample its left edge
      const targetSel = { welcome: '[data-component="view-mode-toggle"]', canvas: '[data-component="canvas-toolbar"]', build: '[data-component="add-node-button"]', relaunch: '[data-component="guided-tips-lightbulb"]' }[st.stepId];
      const trect = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, targetSel);
      if (trect) {
        // sample a strip straddling the LEFT cutout edge (hole padded by 8)
        const edge = await edgeProfile(frame, dpr, { x: trect.x - 8 - 16, y: trect.y + trect.h / 2 - 3, w: 36, h: 6 });
        const inside = await regionLuma(frame, dpr, { x: trect.x + 4, y: trect.y + 4, w: Math.max(8, trect.w - 8), h: Math.max(6, trect.h - 8) });
        const outside = await regionLuma(frame, dpr, { x: trect.x - 70, y: trect.y, w: 40, h: Math.max(8, trect.h) });
        rec.c4 = { targetSel, edge, insideLuma: inside.mean, outsideLuma: outside.mean, contrast: +(inside.mean - outside.mean).toFixed(2), smooth: edge.transitionPx >= 3 };
      }
    }
    // C6 — scene spotlight luma delta (scene steps)
    if (st && ['galaxy', 'preview'].includes(st.stepId) && st.artifactFrameRect) {
      const r = st.artifactFrameRect;
      const inside = await regionLuma(frame, dpr, { x: r.x + r.w * 0.25, y: r.y + r.h * 0.25, w: r.w * 0.5, h: r.h * 0.5 });
      // outside patch far from the window
      const ox = r.x > vp.width / 2 ? 30 : vp.width - 120;
      const outside = await regionLuma(frame, dpr, { x: ox, y: Math.max(80, r.y), w: 90, h: 90 });
      rec.c6 = { insideLuma: inside.mean, outsideLuma: outside.mean, delta: +(inside.mean - outside.mean).toFixed(2), dimsScene: inside.mean - outside.mean > 6 };
    }
    steps.push(rec);
  }
  log.checks.steps = steps;
  log.checks.C4 = { measured: steps.filter((s) => s.c4).map((s) => ({ step: s.stepId, ...s.c4 })), pass: steps.some((s) => s.c4 && s.c4.contrast > 8 && s.c4.smooth) };
  log.checks.C6 = { measured: steps.filter((s) => s.c6).map((s) => ({ step: s.stepId, ...s.c6 })), pass: steps.some((s) => s.c6 && s.c6.dimsScene) };

  // C7 — single canvas: the walkthrough's 3D artifact shares the ONE scene
  // renderer. Measured on the scene steps (galaxy/preview), where no Inspector
  // is open. The inspector step legitimately shows the editor's own pre-existing
  // preview canvas (=2) — that is editor chrome, not the walkthrough's doing.
  const galaxyRunning = steps.find((s) => s.stepId === 'galaxy')?.domCanvasCount;
  const previewRunning = steps.find((s) => s.stepId === 'preview')?.domCanvasCount;
  const galaxyDelta = (galaxyRunning ?? -99) - baselineGalaxyIdle;
  const previewDelta = (previewRunning ?? -99) - baselinePreviewIdle;
  log.checks.C7 = {
    baselineGalaxyIdle,
    baselinePreviewIdle,
    galaxyRunning,
    previewRunning,
    galaxyDelta,
    previewDelta,
    note: 'walkthrough must add 0 canvases; idle galaxy/canvas already owns GraphScene + pre-existing Minimap; preview-app hides the Minimap',
    pass: galaxyDelta === 0 && previewDelta === 0 && baselinePreviewIdle === 1,
  };

  // ── C5: controls ────────────────────────────────────────────────────────────
  const ctrl = {};
  await page.evaluate(() => window.__PRISM_TIPS__?.goTo?.(2));
  await sleep(800);
  const before = (await tipState(page))?.stepIndex;
  // Next via the real button (real coordinate click)
  await clickSel(page, '.tip-btn--primary');
  await sleep(700);
  ctrl.next = { before, after: (await tipState(page))?.stepIndex };
  // Back
  await clickSel(page, '.tip-btn--ghost');
  await sleep(700);
  ctrl.back = { after: (await tipState(page))?.stepIndex };
  // dot jump (click last dot)
  const dots = page.locator('.tip-dot');
  const dotN = await dots.count();
  if (dotN > 0) {
    const db = await dots.nth(dotN - 1).boundingBox().catch(() => null);
    if (db) await page.mouse.click(db.x + db.width / 2, db.y + db.height / 2);
    await sleep(700);
  }
  ctrl.dot = { clicked: dotN - 1, after: (await tipState(page))?.stepIndex };
  await shot('c5-after-controls');
  // Skip
  await clickSel(page, '.tip-skip');
  await sleep(500);
  ctrl.skip = { status: (await tipState(page))?.status };
  await shot('c5-after-skip');
  // Esc
  await clickBulb(page); await sleep(700);
  await page.keyboard.press('Escape'); await sleep(500);
  ctrl.esc = { status: (await tipState(page))?.status };
  // scrim click (dim corner, away from holes)
  await clickBulb(page); await sleep(900);
  await page.mouse.click(vp.width - 8, vp.height - 8);
  await sleep(500);
  ctrl.scrim = { status: (await tipState(page))?.status };
  ctrl.pass =
    ctrl.next.after === ctrl.next.before + 1 &&
    ctrl.back.after === ctrl.next.before &&
    ctrl.skip.status === 'skipped' &&
    ctrl.esc.status === 'idle' &&
    ctrl.scrim.status === 'idle';
  log.checks.C5 = ctrl;

  log.consoleErrors = errs.length;
  log.consoleErrorSamples = errs.slice(0, 6);
  log.checks.C12_consoleClean = { errors: errs.length, pass: errs.length === 0 };

  await ctx.close();
  return log;
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const results = [];
for (const vp of VIEWPORTS) {
  process.stdout.write(`\n[${vp.name}] capturing…\n`);
  try {
    const r = await runViewport(browser, vp);
    results.push(r);
    const c = r.checks;
    process.stdout.write(
      `  C1 ${c.C1?.pass} C2 ${c.C2?.pass} C3 ${c.C3?.pass}(${c.C3?.pathLengthPx}px) C4 ${c.C4?.pass} C5 ${c.C5?.pass} C6 ${c.C6?.pass} C7 ${c.C7?.pass}(Δgal ${c.C7?.galaxyDelta},Δprev ${c.C7?.previewDelta}) errs ${r.consoleErrors}\n`,
    );
  } catch (e) {
    process.stdout.write(`  ERROR: ${e.message}\n`);
    results.push({ viewport: vp.name, error: e.message });
  }
}
await browser.close();
writeFileSync(join(outDir, 'log.json'), JSON.stringify(results, null, 2));
process.stdout.write(`\nWrote ${join(outDir, 'log.json')}\n`);
