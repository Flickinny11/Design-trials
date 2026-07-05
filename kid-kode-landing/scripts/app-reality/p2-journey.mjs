#!/usr/bin/env node
// APP-REALITY P2 — camera-journey evidence.
// Canvas: orbit to 3 distinct poses, RECord each as a waypoint -> the active
// hub's cameraKeyframes grows to 3 (shared source graph). Preview: the journey
// auto-plays; sample the camera at start / mid / end and confirm it flies the
// authored path deterministically (start≈kf0, end≈kf_last, mid moved).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p2');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cam = (p) => p.evaluate(() => window.__PRISM_EDITOR_GET_CANVAS_CAMERA__?.() ?? null);
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => {
  const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null;
}, { fn, arg });
const keyframes = (p) => p.evaluate(() => {
  const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  const hub = s.hubs.find((h) => h.hubId === e.activeHubId) ?? s.hubs[0];
  return (hub?.cameraKeyframes ?? []).map((k) => k.params);
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
await sleep(4000);

// enter canvas on first hub, clear any prior journey, close inspector
const hubId = await page.evaluate(() => {
  const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  let hubs = gs.hubs || gs.graph?.hubs;
  if (!hubs) for (const k of Object.keys(gs)) { const v = gs[k]; if (Array.isArray(v) && v[0]?.hubId) { hubs = v; break; } }
  const id = hubs?.[0]?.hubId;
  window.__PRISM_DEBUG_STORES__.graphEditor.getState().drillIntoHub(id);
  window.__PRISM_DEBUG_STORES__.graphSource.getState().updateHub(id, { cameraKeyframes: [] });
  return id;
});
await sleep(700);
await ge(page, 'closeInspector');
await sleep(900);

const box = await page.evaluate(() => { const c = document.querySelector('[data-pane="graph"] canvas') || document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
async function orbit(dx, dy) {
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8); await sleep(20); }
  await page.mouse.up(); await sleep(800);
}
// three distinct waypoints
await ge(page, 'resetViewToZero'); await sleep(800);
await orbit(280, 70); await ge(page, 'captureCameraKeyframe'); await sleep(250);
await orbit(-360, -150); await ge(page, 'captureCameraKeyframe'); await sleep(250);
await orbit(120, 240); await ge(page, 'captureCameraKeyframe'); await sleep(250);

const kfs = await keyframes(page);
await page.screenshot({ path: `${OUT}/desktop-canvas-journey-3pts.png` });

// PREVIEW: journey auto-plays
await ge(page, 'setViewMode', 'preview-app');
await sleep(150);
const startCam = await cam(page);
await page.screenshot({ path: `${OUT}/desktop-preview-journey-start.png` });
await sleep(1700);
const midCam = await cam(page);
await page.screenshot({ path: `${OUT}/desktop-preview-journey-mid.png` });
await sleep(2200);
const endCam = await cam(page);
await page.screenshot({ path: `${OUT}/desktop-preview-journey-end.png` });

// determinism: replay the journey and let it run FULL duration; the end pose
// must land on the SAME last waypoint (reset-and-replay consistent).
await ge(page, 'replayCameraJourney');
await sleep(150);
const replayStart = await cam(page);
await sleep(3600);
const replayEnd = await cam(page);

const kf0 = kfs[0] ? { x: kfs[0].px, y: kfs[0].py, z: kfs[0].pz } : null;
const kfL = kfs.length ? { x: kfs[kfs.length - 1].px, y: kfs[kfs.length - 1].py, z: kfs[kfs.length - 1].pz } : null;
const out = {
  hubId, errors: errors.slice(0, 8),
  captured: kfs.length,
  keyframePositions: kfs.map((k) => ({ x: k.px, y: k.py, z: k.pz, fov: k.fov })),
  startToKf0: startCam && kf0 ? +dist(startCam.position, kf0).toFixed(3) : null,
  endToKfLast: endCam && kfL ? +dist(endCam.position, kfL).toFixed(3) : null,
  startToMidMove: startCam && midCam ? +dist(startCam.position, midCam.position).toFixed(3) : null,
  replayMovedFromEnd: replayStart && endCam ? +dist(replayStart.position, endCam.position).toFixed(3) : null,
  replayEndToEnd: replayEnd && endCam ? +dist(replayEnd.position, endCam.position).toFixed(3) : null,
};
out.capturedOk = out.captured === 3;
out.playsJourney = out.startToKf0 != null && out.startToKf0 < 1.5 && out.endToKfLast < 1.5 && out.startToMidMove > 1.0;
// replay restarts (camera leaves the end pose) AND re-lands on the same end (deterministic)
out.replayWorks = out.replayMovedFromEnd != null && out.replayMovedFromEnd > 1.0;
out.deterministic = out.replayEndToEnd != null && out.replayEndToEnd < 0.6;
writeFileSync(`${OUT}/p2-journey-log.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ captured: out.captured, capturedOk: out.capturedOk, playsJourney: out.playsJourney, replayWorks: out.replayWorks, deterministic: out.deterministic, startToKf0: out.startToKf0, endToKfLast: out.endToKfLast, replayEndToEnd: out.replayEndToEnd }));
await browser.close();
