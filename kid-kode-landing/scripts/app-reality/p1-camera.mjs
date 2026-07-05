#!/usr/bin/env node
// APP-REALITY P1 — camera-model evidence capture.
// Proves: canvas = FULLY FREE orbit (camera leaves the old ±20° rail);
// preview-app = LOCKED (drag does not move the camera); reset-view-to-zero
// returns straight-on (az≈0, polar≈90). Frames + numeric camera log per config.
//
// Usage: node scripts/app-reality/p1-camera.mjs [--url=http://localhost:4793]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p1');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rad2deg = (r) => (r * 180) / Math.PI;

const CONFIGS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 2, full: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, full: false },
  { name: 'constrained', width: 900, height: 620, dpr: 2, full: false },
];

const log = { url: URL, at: new Date().toISOString(), configs: {} };

async function readCam(page) {
  return page.evaluate(() => {
    const f = window.__PRISM_EDITOR_GET_CANVAS_CAMERA__;
    return typeof f === 'function' ? f() : null;
  });
}
async function getState(page) {
  return page.evaluate(() => {
    const s = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    return s ? { viewMode: s.viewMode, activeHubId: s.activeHubId, canvasView: s.canvasView } : null;
  });
}
async function drillFirstHub(page) {
  return page.evaluate(() => {
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    const ge = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    // probe common shapes for the hub list
    let hubs = gs?.hubs || gs?.graph?.hubs || gs?.source?.hubs || null;
    if (!hubs) {
      for (const k of Object.keys(gs || {})) {
        const v = gs[k];
        if (Array.isArray(v) && v[0] && typeof v[0].hubId === 'string') { hubs = v; break; }
      }
    }
    const hubId = hubs?.[0]?.hubId ?? null;
    if (hubId && ge?.drillIntoHub) ge.drillIntoHub(hubId);
    return hubId;
  });
}
async function canvasBox(page) {
  return page.evaluate(() => {
    const c = document.querySelector('[data-pane="graph"] canvas') || document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}
async function dragOrbit(page, box, dx, dy) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8);
    await sleep(16);
  }
  await page.mouse.up();
}

const browser = await chromium.launch();
try {
  for (const cfg of CONFIGS) {
    const ctx = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: cfg.dpr,
      hasTouch: cfg.name === 'mobile',
      isMobile: cfg.name === 'mobile',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
    await sleep(2500); // scene warm

    const rec = { errors: [] };

    // ---- CANVAS: enter + free orbit ----
    const hubId = await drillFirstHub(page);
    rec.hubId = hubId;
    await sleep(700);
    // Close the Inspector so the orbit drag lands on the canvas (the Inspector
    // bottom-sheet covers the canvas centre on narrow/mobile widths) and so the
    // camera HUD is unoccluded for the frames.
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().closeInspector());
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${cfg.name}-canvas-default.png` });
    const box = await canvasBox(page);
    rec.canvasBox = box;
    if (box) await dragOrbit(page, box, 300, 150); // big rotate — must blow past old ±20°
    await sleep(900);
    rec.canvasOrbit = await readCam(page);
    rec.canvasViewAfterOrbit = (await getState(page))?.canvasView ?? null;
    await page.screenshot({ path: `${OUT}/${cfg.name}-canvas-orbit-free.png` });

    // ---- RESET VIEW TO ZERO ----
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().resetViewToZero());
    await sleep(220); // catch the pulse glow
    await page.screenshot({ path: `${OUT}/${cfg.name}-canvas-reset-pulse.png` });
    await sleep(700);
    rec.canvasReset = await readCam(page);
    rec.canvasViewAtZero = (await getState(page))?.canvasView ?? null;
    await page.screenshot({ path: `${OUT}/${cfg.name}-canvas-reset-zero.png` });

    // ---- PREVIEW-APP: locked camera ----
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().setViewMode('preview-app'));
    await sleep(1400); // configured-pose entry settles
    rec.previewPoseA = await readCam(page);
    await page.screenshot({ path: `${OUT}/${cfg.name}-preview-locked-before.png` });
    const pbox = await canvasBox(page);
    if (pbox) { await dragOrbit(page, pbox, 320, 160); await dragOrbit(page, pbox, -300, 0); }
    await sleep(700);
    rec.previewPoseB = await readCam(page);
    await page.screenshot({ path: `${OUT}/${cfg.name}-preview-locked-after.png` });

    // numeric verdicts
    if (rec.canvasOrbit) {
      rec.canvasOrbitAzDeg = +rad2deg(rec.canvasOrbit.azimuthAngle).toFixed(1);
      rec.canvasOrbitPolarDeg = +rad2deg(rec.canvasOrbit.polarAngle).toFixed(1);
      // old rail allowed |az|<=20 and |polar-90|<=20; "free" must exceed it
      rec.canvasFreeProven = Math.abs(rec.canvasOrbitAzDeg) > 25 || Math.abs(rec.canvasOrbitPolarDeg - 90) > 25;
    }
    if (rec.canvasReset) {
      rec.canvasResetAzDeg = +rad2deg(rec.canvasReset.azimuthAngle).toFixed(1);
      rec.canvasResetPolarDeg = +rad2deg(rec.canvasReset.polarAngle).toFixed(1);
      rec.resetToZeroProven = Math.abs(rec.canvasResetAzDeg) < 2 && Math.abs(rec.canvasResetPolarDeg - 90) < 2;
    }
    if (rec.previewPoseA && rec.previewPoseB) {
      const dp = Math.hypot(
        rec.previewPoseA.position.x - rec.previewPoseB.position.x,
        rec.previewPoseA.position.y - rec.previewPoseB.position.y,
        rec.previewPoseA.position.z - rec.previewPoseB.position.z,
      );
      rec.previewPosDelta = +dp.toFixed(4);
      rec.previewLockedProven = dp < 0.05; // drag did not move the camera
    }
    rec.errors = errors.slice(0, 8);
    log.configs[cfg.name] = rec;
    await ctx.close();
    console.log(`[${cfg.name}] free=${rec.canvasFreeProven} (az ${rec.canvasOrbitAzDeg}, pol ${rec.canvasOrbitPolarDeg}) | resetZero=${rec.resetToZeroProven} (az ${rec.canvasResetAzDeg}, pol ${rec.canvasResetPolarDeg}) | previewLocked=${rec.previewLockedProven} (Δ${rec.previewPosDelta})`);
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/p1-camera-log.json`, JSON.stringify(log, null, 2));
console.log(`\nWrote ${OUT}/p1-camera-log.json`);
