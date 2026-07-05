// HEADLESS behavioral verify for PRIM-P1 w-node: galaxy/canvas two-state +
// instantiate-via-real-pointer-click (Node Law: click → node created + realized).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.PRIM_URL || 'http://localhost:3000/primitive-lab';
const OUT = 'notes/verification/prim-p1';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__PRISM_PRIM_STORE__ === 'function' && window.__PRISM_PRIM_STORE__().schemas.length >= 3, { timeout: 60000 });
await page.waitForTimeout(2500);

// CANVAS (realized)
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/wnode-canvas.png` });

// GALAXY (dormant seeds)
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('galaxy'));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/wnode-galaxy.png` });

// Back to canvas, count before
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
await page.waitForTimeout(500);
const before = await page.evaluate(() => window.__PRISM_PRIM_STORE__().nodes().length);

// Project the PANE palette button to screen px and drive a REAL pointer click.
const screen = await page.evaluate(() => {
  const cam = window.__PRISM_PRIM_CAM__?.camera;
  const positions = window.__PRISM_PRIM_PALETTE_POS__;
  const pane = positions?.find((p) => p.kind === 'pane');
  if (!cam || !pane) return null;
  const v = new (window.__PRISM_PRIM_SCENE__.constructor ? Object : Object)();
  // project via three: clone vector through camera
  const THREE = window.__THREE__ || null; // not guaranteed; do math manually
  // manual: use camera.matrixWorldInverse + projectionMatrix
  const p = pane.pos;
  // use the camera's project by constructing a Vector3-like through three on window? fallback:
  const vec = { x: p[0], y: p[1], z: p[2] };
  // Use camera.project via a real THREE.Vector3 obtained from the scene's children if possible.
  return { worldPos: p };
});

// Simpler + robust: project using the camera object directly in page context.
const px = await page.evaluate(() => {
  const cam = window.__PRISM_PRIM_CAM__?.camera;
  const positions = window.__PRISM_PRIM_PALETTE_POS__;
  const pane = positions?.find((p) => p.kind === 'pane');
  if (!cam || !pane) return null;
  // Build a Vector3 via the camera's own three import is not exposed; use math.
  // World → clip via projectionMatrix * viewMatrix.
  const m = cam.matrixWorldInverse.clone();
  // multiply projection
  const pm = cam.projectionMatrix;
  const p = pane.pos;
  // apply view
  const e = m.elements;
  const x = p[0], y = p[1], z = p[2];
  const vx = e[0]*x + e[4]*y + e[8]*z + e[12];
  const vy = e[1]*x + e[5]*y + e[9]*z + e[13];
  const vz = e[2]*x + e[6]*y + e[10]*z + e[14];
  const vw = e[3]*x + e[7]*y + e[11]*z + e[15];
  const pe = pm.elements;
  const cx = pe[0]*vx + pe[4]*vy + pe[8]*vz + pe[12]*vw;
  const cy = pe[1]*vx + pe[5]*vy + pe[9]*vz + pe[13]*vw;
  const cw = pe[3]*vx + pe[7]*vy + pe[11]*vz + pe[15]*vw;
  const ndcx = cx / cw, ndcy = cy / cw;
  return { sx: (ndcx * 0.5 + 0.5) * window.innerWidth, sy: (-ndcy * 0.5 + 0.5) * window.innerHeight };
});
console.log('pane button screen px:', JSON.stringify(px));
if (px) {
  await page.mouse.move(px.sx, px.sy);
  await page.waitForTimeout(250);
  await page.mouse.click(px.sx, px.sy);
  await page.waitForTimeout(1100);
}
const after = await page.evaluate(() => window.__PRISM_PRIM_STORE__().nodes().length);
const auth = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
await page.screenshot({ path: `${OUT}/wnode-after-click-instantiate.png` });

console.log('node count before→after palette click:', before, '→', after, after === before + 1 ? 'CREATED ✓' : 'NO CHANGE ✗');
console.log('authorship ok:', auth.ok, 'orphans:', auth.orphans.length, 'rendered:', auth.renderedCount, 'nodes:', auth.nodeIds.length);
console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
console.log(JSON.stringify({ created: after === before + 1, authOk: auth.ok, orphans: auth.orphans.length, errors: errors.length }));
