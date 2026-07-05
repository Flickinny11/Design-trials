// PRISM-P1 w-verify — COMPREHENSIVE headless behavioral evidence run.
// Drives /primitive-lab like a user (real pointer): instantiate each kind, reshape
// via the in-canvas Inspector, change materials, cutouts, galaxy/canvas — capturing
// labeled frames + a metrics JSON for the fresh-context advocate. Offscreen only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PRIM_BASE || 'http://localhost:3000';
const OUT = 'notes/verification/prim-p1';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

const metrics = { steps: [], errors: [] };
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

// world→screen via the live camera matrices.
const proj = (p) => page.evaluate((pt) => {
  const cam = window.__PRISM_PRIM_CAM__.camera;
  const e = cam.matrixWorldInverse.elements, pe = cam.projectionMatrix.elements;
  const [x, y, z] = pt;
  const vx = e[0]*x+e[4]*y+e[8]*z+e[12], vy = e[1]*x+e[5]*y+e[9]*z+e[13], vz = e[2]*x+e[6]*y+e[10]*z+e[14], vw = e[3]*x+e[7]*y+e[11]*z+e[15];
  const cx = pe[0]*vx+pe[4]*vy+pe[8]*vz+pe[12]*vw, cy = pe[1]*vx+pe[5]*vy+pe[9]*vz+pe[13]*vw, cw = pe[3]*vx+pe[7]*vy+pe[11]*vz+pe[15]*vw;
  return { sx: (cx/cw*0.5+0.5)*window.innerWidth, sy: (-cy/cw*0.5+0.5)*window.innerHeight };
}, p);

const vtx = (id) => page.evaluate((nid) => {
  const scene = window.__PRISM_PRIM_SCENE__; let n = -1;
  scene.traverse((o) => { if (o.userData?.prismNodeId === nid && !o.userData?.prismDormant) o.traverse((c) => { if (c.isMesh && n < 0) n = c.geometry?.attributes?.position?.count ?? -1; }); });
  return n;
}, id);

const dragFader = async (key, frac) => {
  const map = await page.evaluate(() => window.__PRISM_PRIM_INSPECTOR_MAP__());
  const f = map.faders.find((x) => x.key === key);
  if (!f) return false;
  const startX = f.worldX0 + (f.value - f.min) / (f.max - f.min) * (f.worldX1 - f.worldX0);
  const targetVal = f.min + frac * (f.max - f.min);
  const targetX = f.worldX0 + (targetVal - f.min) / (f.max - f.min) * (f.worldX1 - f.worldX0);
  const a = await proj([startX, f.worldY, map.knobZ]);
  const b = await proj([targetX, f.worldY, map.knobZ]);
  await page.mouse.move(a.sx, a.sy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.sx + (b.sx - a.sx) * i / 8, a.sy + (b.sy - a.sy) * i / 8); await page.waitForTimeout(35); }
  await page.mouse.up(); await page.waitForTimeout(350);
  return true;
};
const pickMaterial = async (kind) => {
  const map = await page.evaluate(() => window.__PRISM_PRIM_INSPECTOR_MAP__());
  const s = map.swatches.find((x) => x.kind === kind); if (!s) return false;
  const p = await proj(s.worldPos); await page.mouse.click(p.sx, p.sy); await page.waitForTimeout(300); return true;
};
const clickAction = async (which) => {
  const map = await page.evaluate(() => window.__PRISM_PRIM_INSPECTOR_MAP__());
  const pos = map.actions?.[which]; if (!pos) return false;
  const p = await proj(pos); await page.mouse.click(p.sx, p.sy); await page.waitForTimeout(300); return true;
};
const instantiate = async (kind) => {
  const positions = await page.evaluate(() => window.__PRISM_PRIM_PALETTE_POS__);
  const b = positions.find((x) => x.kind === kind);
  const p = await proj(b.pos); await page.mouse.click(p.sx, p.sy); await page.waitForTimeout(900);
};
const selectNode = async (id) => {
  const s = await page.evaluate((nid) => { const sc = window.__PRISM_PRIM_STORE__().schemas.find((x) => x.nodeId === nid); return sc ? { x: sc.transform.x, y: sc.transform.y, d: sc.params.depth, r: sc.params.radius, kind: sc.kind } : null; }, id);
  const z = s.kind === 'sphere' ? s.r + 0.01 : s.d / 2 + 0.01;
  const p = await proj([s.x, s.y, z]); await page.mouse.click(p.sx, p.sy); await page.waitForTimeout(500);
};
const sel = () => page.evaluate(() => window.__PRISM_PRIM_STORE__().selectedId);
const nodeCount = () => page.evaluate(() => window.__PRISM_PRIM_STORE__().nodes().length);

await page.goto(`${BASE}/primitive-lab`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__PRISM_PRIM_STORE__ === 'function' && window.__PRISM_PRIM_STORE__().schemas.length >= 3, { timeout: 60000 });
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
await page.waitForTimeout(2600);
metrics.steps.push({ step: 'cold-load', nodes: await nodeCount(), seeded: ['pane', 'cube', 'sphere'] });
await shot('full-01-overview');

// ── PANE: select seeded pane, reshape + glass-smoke + 2 cutouts ──
const paneId = await page.evaluate(() => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.kind === 'pane').nodeId);
await selectNode(paneId);
const paneVtxBefore = await vtx(paneId);
await dragFader('height', 0.85);
await dragFader('cornerRadius', 0.7);
await pickMaterial('glass-smoke');
await clickAction('addCutout');
await clickAction('addCutout');
const paneVtxAfter = await vtx(paneId);
const paneState = await page.evaluate((id) => { const s = window.__PRISM_PRIM_STORE__().schemas.find((x) => x.nodeId === id); return { material: s.material.kind, cutouts: s.params.cutouts.length, height: s.params.height }; }, paneId);
metrics.steps.push({ step: 'pane-reshape', selected: await sel(), vtxBefore: paneVtxBefore, vtxAfter: paneVtxAfter, rebuilt: paneVtxAfter !== paneVtxBefore, ...paneState });
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0.6, 0.2, 20.5, 0.6, 0.2, 0)); await page.waitForTimeout(300);
await shot('full-02-pane-glass-cutouts');

// ── CUBE: instantiate via palette, reshape + worn-oxblood ──
const cBefore = await nodeCount();
await instantiate('cube');
const cubeId = await sel();
const cubeVtxBefore = await vtx(cubeId);
await dragFader('width', 0.25);
await dragFader('depth', 0.85);
await dragFader('cornerRadius', 0.6);
await pickMaterial('worn-oxblood');
const cubeVtxAfter = await vtx(cubeId);
metrics.steps.push({ step: 'cube-instantiate-reshape', nodesBefore: cBefore, nodesAfter: await nodeCount(), created: (await nodeCount()) === cBefore + 1, cubeId, vtxBefore: cubeVtxBefore, vtxAfter: cubeVtxAfter, rebuilt: cubeVtxAfter !== cubeVtxBefore, material: await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((x) => x.nodeId === id).material.kind, cubeId) });
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0.6, 0.2, 20.5, 0.6, 0.2, 0)); await page.waitForTimeout(300);
await shot('full-03-cube-reshaped');

// ── SPHERE: instantiate via palette, reshape RADIUS + SEGMENTS + worn-gunmetal ──
const sBefore = await nodeCount();
await instantiate('sphere');
const sphId = await sel();
const sphVtxBefore = await vtx(sphId);
await dragFader('radius', 0.7);
await dragFader('segments', 0.2);
await pickMaterial('worn-gunmetal');
const sphVtxAfter = await vtx(sphId);
metrics.steps.push({ step: 'sphere-instantiate-reshape', nodesBefore: sBefore, nodesAfter: await nodeCount(), created: (await nodeCount()) === sBefore + 1, sphId, vtxBefore: sphVtxBefore, vtxAfter: sphVtxAfter, rebuilt: sphVtxAfter !== sphVtxBefore, material: await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((x) => x.nodeId === id).material.kind, sphId) });
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0.6, 0.2, 20.5, 0.6, 0.2, 0)); await page.waitForTimeout(300);
await shot('full-04-sphere-reshaped');

// ── GALAXY (unbuilt) ──
await page.evaluate(() => { window.__PRISM_PRIM_STORE__().select(null); window.__PRISM_PRIM_STORE__().setView('galaxy'); });
await page.waitForTimeout(900);
const galaxyAuth = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
metrics.steps.push({ step: 'galaxy', view: galaxyAuth.view, dormant: galaxyAuth.renderedCount, orphans: galaxyAuth.orphans.length });
await shot('full-05-galaxy');

// ── back to canvas overview ──
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
await page.waitForTimeout(900);
const canvasAuth = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
metrics.steps.push({ step: 'final-canvas', view: canvasAuth.view, rendered: canvasAuth.renderedCount, nodes: canvasAuth.nodeIds.length, orphans: canvasAuth.orphans.length, allRealized: canvasAuth.unrealizedInCanvas.length === 0, ok: canvasAuth.ok });
await shot('full-06-final-canvas');

// ── aesthetic reference frames (approved look) ──
await page.goto(`${BASE}/toolbar-chassis?spin=0`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500); await shot('ref-toolbar-chassis');
await page.goto(`${BASE}/keyframe-editor`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500); await shot('ref-keyframe-editor');

metrics.errors = errors;
metrics.consoleErrorCount = errors.length;
writeFileSync(`${OUT}/full-metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(metrics, null, 1));
console.log('\nCONSOLE ERRORS:', errors.length);
