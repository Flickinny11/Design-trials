#!/usr/bin/env node
// THREE-D-BACKGROUNDS — P1 numeric harness (C1–C4).
// Drives the /bg-lab isolation page on the real WebGPU renderer and measures:
//   C1 parallax  — per-layer pixel-delta between two camera waypoints
//   C2 volumetric — luma texture + smooth-feather (no banding/cliff) stats
//   C3 particles  — live count + parallax depth-response
//   C4 tiering     — T0 vs T2 frame render + frame-time per tier
// Pixel metrics come off the REAL rendered frames (no assertion-only, FP-10).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRawFull, regionStats, regionDiff, atmosphereMetrics, diagonalProfiles, diagonalMetrics } from '../prod-finish/_imglib.mjs';

const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const BASE = arg('url', 'http://localhost:4810');
const OUT = resolve(process.cwd(), arg('out', 'notes/verification/three-d-backgrounds/p1'));
const PRESETS = arg('presets', 'brass-nebula,ice-field,observatory-deep').split(',');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--use-angle=metal'] }).catch(() => chromium.launch());

async function shot(page, q, file, settle = 4200) {
  await page.goto(`${BASE}/bg-lab?${q}`, { waitUntil: 'domcontentloaded' });
  await sleep(settle);
  await page.screenshot({ path: file });
  return page.evaluate(() => ({
    counts: window.__PRISM_BG_PARTICLE_COUNTS__ ? { ...window.__PRISM_BG_PARTICLE_COUNTS__ } : null,
    frameMs: window.__BG_FRAME_MS__ ?? null,
  }));
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const results = {};
try {
  for (const preset of PRESETS) {
    const r = { preset };
    // ── C1 parallax: measure the on-screen pixel shift of a NEAR vs a FAR world
    // point under a pure-pan camera translation (the depth layers occupy this
    // same world Z), AND confirm both rendered layers actually change between the
    // waypoints (neither is a flat static skybox). Pure pan (look=parallel) →
    // horizontal parallax: near point shifts more px than far point. DPR-2 frames.
    const pA = `${OUT}/${preset}-par-camx0.png`, pB = `${OUT}/${preset}-par-camx3.png`;
    const nA = `${OUT}/${preset}-neb-camx0.png`, nB = `${OUT}/${preset}-neb-camx3.png`;
    const proj = async (camx) => {
      await page.goto(`${BASE}/bg-lab?preset=${preset}&look=parallel&camx=${camx}&camz=12`, { waitUntil: 'domcontentloaded' });
      await sleep(2600);
      return page.evaluate(() => {
        const f = window.__BG_PROJECT__;
        return { near: f(0, 0, -15), far: f(0, 0, -260) };
      });
    };
    const projA = await proj(0);
    const projB = await proj(3);
    const dNear = Math.abs(projB.near[0] - projA.near[0]);
    const dFar = Math.abs(projB.far[0] - projA.far[0]);
    // Rendered-change confirmation (both layers respond → neither is flat).
    await shot(page, `preset=${preset}&only=nebula&look=parallel&camx=0&camz=12`, nA);
    await shot(page, `preset=${preset}&only=nebula&look=parallel&camx=3&camz=12`, nB);
    await shot(page, `preset=${preset}&only=particles&look=parallel&camx=0&camz=12`, pA);
    await shot(page, `preset=${preset}&only=particles&look=parallel&camx=3&camz=12`, pB);
    const nebDiff = regionDiff(await loadRawFull(nA), await loadRawFull(nB), 0, 0, 1, 1);
    const parDiff = regionDiff(await loadRawFull(pA), await loadRawFull(pB), 0, 0, 1, 1);
    r.c1 = {
      nearPointShiftPx: +dNear.toFixed(1),
      farPointShiftPx: +dFar.toFixed(1),
      parallaxRatio: +(dNear / Math.max(0.1, dFar)).toFixed(2),
      nebulaRenderDelta: +nebDiff.meanAbsDiff.toFixed(3),
      particleRenderDelta: +parDiff.meanAbsDiff.toFixed(3),
      // PASS: near point shifts measurably MORE than far (true parallax) AND
      // both rendered layers actually changed (neither is a static skybox).
      pass: dNear > dFar * 1.5 && dNear > 8 && nebDiff.meanAbsDiff > 0.5 && parDiff.meanAbsDiff > 0.5,
    };

    // ── C2 volumetric: nebula-only texture + smooth feather, no banding ────────
    const nGrid = await loadRawFull(nA);
    const am = atmosphereMetrics(nGrid);
    const dm = diagonalMetrics(diagonalProfiles(nGrid));
    const full = regionStats(nGrid, 0, 0, 1, 1);
    r.c2 = {
      frameMean: +full.mean.toFixed(2),
      frameStd: +full.std.toFixed(2), // texture/structure (flat plane ≈ 0)
      banding: dm.banding,
      ovalEdge: +dm.ovalEdge.toFixed(2),
      cornerSpread: +am.cornerSpread.toFixed(2),
      pass: full.std > 6 && dm.banding <= 3,
    };

    // ── C3 particles: count + depth response (parallax of the world field) ─────
    const probe = await page.evaluate(() => (window.__PRISM_BG_PARTICLE_COUNTS__ ? { ...window.__PRISM_BG_PARTICLE_COUNTS__ } : {}));
    const pGrid = await loadRawFull(pA);
    const pStats = regionStats(pGrid, 0, 0, 1, 1);
    const totalCount = Object.values(probe).reduce((s, x) => s + x, 0);
    r.c3 = {
      counts: probe,
      totalCount,
      particleRenderDelta: r.c1.particleRenderDelta,
      nearPointShiftPx: r.c1.nearPointShiftPx,
      frameStd: +pStats.std.toFixed(2),
      pass: totalCount > 1000 && r.c1.particleRenderDelta > 0.5,
    };

    // ── C4 tiering: full preset at T0 vs T2, render + frame-time ────────────────
    const t2f = `${OUT}/${preset}-tierT2.png`, t0f = `${OUT}/${preset}-tierT0.png`;
    const t2 = await shot(page, `preset=${preset}&tier=T2`, t2f, 4800);
    const t0 = await shot(page, `preset=${preset}&tier=T0`, t0f, 4800);
    const t2Grid = await loadRawFull(t2f), t0Grid = await loadRawFull(t0f);
    const t2Mean = regionStats(t2Grid, 0, 0, 1, 1).mean, t0Mean = regionStats(t0Grid, 0, 0, 1, 1).mean;
    r.c4 = {
      t2: { counts: t2.counts, frameMs: t2.frameMs ? +t2.frameMs.toFixed(2) : null, mean: +t2Mean.toFixed(2) },
      t0: { counts: t0.counts, frameMs: t0.frameMs ? +t0.frameMs.toFixed(2) : null, mean: +t0Mean.toFixed(2) },
      pass: t2Mean > 3 && t0Mean > 3, // both tiers render a non-black frame
    };

    results[preset] = r;
    console.log(`[${preset}] C1 near=${r.c1.nearPointShiftPx}px far=${r.c1.farPointShiftPx}px ratio=${r.c1.parallaxRatio} ${r.c1.pass ? 'PASS' : 'FAIL'} | C2 std=${r.c2.frameStd} band=${r.c2.banding} ${r.c2.pass ? 'PASS' : 'FAIL'} | C3 n=${r.c3.totalCount} ${r.c3.pass ? 'PASS' : 'FAIL'} | C4 T2ms=${r.c4.t2.frameMs} T0ms=${r.c4.t0.frameMs} ${r.c4.pass ? 'PASS' : 'FAIL'}`);
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/metrics-c1-c4.json`, JSON.stringify(results, null, 2));
const allPass = Object.values(results).every((r) => r.c1.pass && r.c2.pass && r.c3.pass && r.c4.pass);
console.log(`\nP1 metrics: ${allPass ? 'ALL PASS' : 'SOME FAIL'} — wrote metrics-c1-c4.json`);
