#!/usr/bin/env node
// THREE-D-BACKGROUNDS — P4 C11 camera-journey readiness.
// Applies a preset + a 4-waypoint `cameraKeyframes` journey to a hub, enters
// preview-app (the journey auto-plays), and captures frames across the fly-
// through. Proves: the background PARALLAXES through its depth layers (frames
// differ between waypoints) with NO exposed scene edge / blank corner (every
// journey frame's corners stay filled atmosphere). DPR-2 real WebGPU.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRawFull, regionDiff, atmosphereMetrics } from '../prod-finish/_imglib.mjs';

const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const BASE = arg('url', 'http://localhost:4810');
const OUT = resolve(process.cwd(), arg('out', 'notes/verification/three-d-backgrounds/p4'));
const PRESET = arg('preset', 'brass-nebula');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A fly-through that dollies IN and pans across, moving the camera THROUGH the
// depth layers (so near layers parallax more than far).
const JOURNEY = [
  { coordinateSpace: 'camera', params: { px: -3, py: 1.5, pz: 20, tx: 0, ty: 0, tz: 0, fov: 45 } },
  { coordinateSpace: 'camera', params: { px: 2.5, py: -1, pz: 14, tx: 1, ty: 0, tz: -5, fov: 46 } },
  { coordinateSpace: 'camera', params: { px: -1.5, py: 0.5, pz: 9, tx: -1, ty: 0, tz: -9, fov: 48 } },
  { coordinateSpace: 'camera', params: { px: 0, py: 0, pz: 6, tx: 0, ty: 0, tz: -12, fov: 50 } },
];

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--use-angle=metal'] }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
const out = { preset: PRESET, frames: [] };
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PRISM_DEBUG_STORES__?.graphSource.getState().hubs.length > 0, null, { timeout: 45000 });
  // Apply preset + journey (canvas mode), THEN enter preview-app so the journey
  // effect picks up the keyframes and starts from t=0.
  await page.evaluate(({ preset, journey }) => {
    const s = window.__PRISM_DEBUG_STORES__;
    const gs = s.graphSource.getState();
    const id = gs.hubs[0].hubId;
    gs.updateHub(id, { background: window.__PRISM_APPLY_BG_PRESET__(preset), cameraKeyframes: journey });
    s.graphEditor.getState().setViewMode('canvas');
    s.graphEditor.setState({ activeHubId: id });
  }, { preset: PRESET, journey: JOURNEY });
  await sleep(3500);
  // Enter preview-app — journey auto-plays (duration = 3 segs × 1.7 = 5.1s).
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode('preview-app'));
  const stamps = [0.4, 1.8, 3.2, 4.8];
  let prev = 0;
  for (let i = 0; i < stamps.length; i++) {
    await sleep((stamps[i] - prev) * 1000);
    prev = stamps[i];
    const file = `${OUT}/c11-journey-${i}-t${stamps[i]}.png`;
    await page.screenshot({ path: file });
    const grid = await loadRawFull(file);
    const am = atmosphereMetrics(grid);
    const minCorner = Math.min(...am.cornerMeans);
    out.frames.push({ t: stamps[i], file, minCorner: +minCorner.toFixed(1), cornerMeans: am.cornerMeans.map((x) => +x.toFixed(1)) });
  }
  // Parallax = consecutive journey frames differ (the camera moved THROUGH the
  // layers). No blank corner = every frame keeps its corners filled (> floor).
  const grids = [];
  for (const f of out.frames) grids.push(await loadRawFull(f.file));
  const deltas = [];
  for (let i = 1; i < grids.length; i++) deltas.push(+regionDiff(grids[i - 1], grids[i], 0, 0, 1, 1).meanAbsDiff.toFixed(2));
  const minCornerAll = Math.min(...out.frames.map((f) => f.minCorner));
  out.c11 = {
    journeyFrameDeltas: deltas,
    parallaxMoves: deltas.every((d) => d > 1.0),
    minCornerAcrossJourney: +minCornerAll.toFixed(1),
    noBlankCorner: minCornerAll > 3.0,
    errors: errs.length,
    pass: deltas.every((d) => d > 1.0) && minCornerAll > 3.0 && errs.length === 0,
  };
  console.log(`C11 deltas=${JSON.stringify(deltas)} minCorner=${out.c11.minCornerAcrossJourney} errs=${errs.length} → ${out.c11.pass ? 'PASS' : 'FAIL'}`);
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/metrics-c11.json`, JSON.stringify(out, null, 2));
console.log(`C11: ${out.c11?.pass ? 'PASS' : 'FAIL'} — wrote metrics-c11.json`);
