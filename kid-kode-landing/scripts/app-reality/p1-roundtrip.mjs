#!/usr/bin/env node
// APP-REALITY P1 regression check (SC-027 / INV-20): orbit canvas off-axis,
// go canvas -> preview-app -> canvas, and confirm the camera RESTORES the
// user's orbit (not the front/zero pose). Proves the receiveEndValue=false fix.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p1');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deg = (r) => (r * 180) / Math.PI;
const cam = (p) => p.evaluate(() => window.__PRISM_EDITOR_GET_CANVAS_CAMERA__?.() ?? null);
const setMode = (p, m) => p.evaluate((m) => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode(m), m);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
await sleep(4000);
// enter canvas on first hub, close inspector
const hubId = await page.evaluate(() => {
  const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  let hubs = gs.hubs || gs.graph?.hubs;
  if (!hubs) for (const k of Object.keys(gs)) { const v = gs[k]; if (Array.isArray(v) && v[0]?.hubId) { hubs = v; break; } }
  const id = hubs?.[0]?.hubId;
  window.__PRISM_DEBUG_STORES__.graphEditor.getState().drillIntoHub(id);
  return id;
});
await sleep(700);
await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().closeInspector());
await sleep(900);
// orbit off-axis
const box = await page.evaluate(() => { const c = document.querySelector('[data-pane="graph"] canvas') || document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
async function orbitOnce(dx, dy) {
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8); await sleep(20); }
  await page.mouse.up();
  await sleep(900);
}
let A = null;
for (let attempt = 0; attempt < 4; attempt++) {
  await orbitOnce(300, 150);
  A = await cam(page);
  if (A && Math.abs(deg(A.azimuthAngle)) > 25) break;
}
// canvas -> preview-app -> canvas
await setMode(page, 'preview-app'); await sleep(1400);
await setMode(page, 'canvas'); await sleep(1500);
const B = await cam(page);

const out = {
  hubId,
  orbitPose: A ? { az: +deg(A.azimuthAngle).toFixed(1), pol: +deg(A.polarAngle).toFixed(1) } : null,
  restoredPose: B ? { az: +deg(B.azimuthAngle).toFixed(1), pol: +deg(B.polarAngle).toFixed(1) } : null,
};
out.azDelta = A && B ? +Math.abs(deg(A.azimuthAngle) - deg(B.azimuthAngle)).toFixed(1) : null;
out.polDelta = A && B ? +Math.abs(deg(A.polarAngle) - deg(B.polarAngle)).toFixed(1) : null;
// restore proven if B matches the orbit (within 3deg) AND is NOT the front/zero pose
out.restoredOrbit = out.azDelta != null && out.azDelta < 3 && out.polDelta < 3 && Math.abs(out.orbitPose.az) > 25;
writeFileSync(`${OUT}/p1-roundtrip.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
await browser.close();
