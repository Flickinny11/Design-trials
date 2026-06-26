// HEADLESS behavioral verify for PRIM-P1 w-inspector: select a primitive → the
// in-canvas Inspector opens → DRAG a fader (geometry rebuilds), pick a MATERIAL
// swatch, ADD a CUTOUT — all via REAL pointer events (offscreen, never headed).
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
await page.evaluate(() => window.__PRISM_PRIM_STORE__().setView('canvas'));
await page.waitForTimeout(2500);

// in-page world→screen projector (camera matrices)
async function proj(p) {
  return page.evaluate((pt) => {
    const cam = window.__PRISM_PRIM_CAM__.camera;
    const e = cam.matrixWorldInverse.elements, pe = cam.projectionMatrix.elements;
    const x = pt[0], y = pt[1], z = pt[2];
    const vx = e[0]*x+e[4]*y+e[8]*z+e[12], vy = e[1]*x+e[5]*y+e[9]*z+e[13], vz = e[2]*x+e[6]*y+e[10]*z+e[14], vw = e[3]*x+e[7]*y+e[11]*z+e[15];
    const cx = pe[0]*vx+pe[4]*vy+pe[8]*vz+pe[12]*vw, cy = pe[1]*vx+pe[5]*vy+pe[9]*vz+pe[13]*vw, cw = pe[3]*vx+pe[7]*vy+pe[11]*vz+pe[15]*vw;
    return { sx: (cx/cw*0.5+0.5)*window.innerWidth, sy: (-cy/cw*0.5+0.5)*window.innerHeight };
  }, p);
}

// 1) Select the pane (slot 0). Find its world pos from the store.
const paneInfo = await page.evaluate(() => {
  const s = window.__PRISM_PRIM_STORE__().schemas.find((x) => x.kind === 'pane');
  return s ? { id: s.nodeId, x: s.transform.x, y: s.transform.y, depth: s.params.depth } : null;
});
const paneScreen = await proj([paneInfo.x, paneInfo.y, paneInfo.depth / 2 + 0.01]);
await page.mouse.click(paneScreen.sx, paneScreen.sy);
await page.waitForTimeout(700);
const selected = await page.evaluate(() => window.__PRISM_PRIM_STORE__().selectedId);
console.log('selected after pane click:', selected, '(expected', paneInfo.id + ')');
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0.6, 0.2, 20.5, 0.6, 0.2, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/winspector-open.png` });

// 2) DRAG the WIDTH fader toward max → pane width grows (geometry rebuilds).
const map1 = await page.evaluate(() => window.__PRISM_PRIM_INSPECTOR_MAP__());
const widthF = map1.faders.find((f) => f.key === 'width');
const widthBefore = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).params.width, paneInfo.id);
const knobX = widthF.worldX0 + (widthF.value - widthF.min) / (widthF.max - widthF.min) * (widthF.worldX1 - widthF.worldX0);
const targetVal = 5.2;
const targetX = widthF.worldX0 + (targetVal - widthF.min) / (widthF.max - widthF.min) * (widthF.worldX1 - widthF.worldX0);
const knobS = await proj([knobX, widthF.worldY, map1.knobZ]);
const targetS = await proj([targetX, widthF.worldY, map1.knobZ]);
await page.mouse.move(knobS.sx, knobS.sy);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(knobS.sx + (targetS.sx - knobS.sx) * (i / 8), knobS.sy + (targetS.sy - knobS.sy) * (i / 8));
  await page.waitForTimeout(40);
}
await page.mouse.up();
await page.waitForTimeout(500);
const widthAfter = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).params.width, paneInfo.id);
console.log('pane WIDTH fader drag:', widthBefore.toFixed(2), '→', widthAfter.toFixed(2), widthAfter > widthBefore + 0.3 ? 'CHANGED ✓' : 'NO CHANGE ✗');
await page.screenshot({ path: `${OUT}/winspector-fader-drag.png` });

// 3) Pick a MATERIAL swatch (worn-emerald) → material kind changes.
const matBefore = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).material.kind, paneInfo.id);
const emerald = map1.swatches.find((s) => s.kind === 'worn-emerald');
const emS = await proj(emerald.worldPos);
await page.mouse.click(emS.sx, emS.sy);
await page.waitForTimeout(500);
const matAfter = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).material.kind, paneInfo.id);
console.log('material swatch pick:', matBefore, '→', matAfter, matAfter === 'worn-emerald' ? 'CHANGED ✓' : 'NO CHANGE ✗');
await page.screenshot({ path: `${OUT}/winspector-material.png` });

// 4) ADD CUTOUT → cutouts length increases (pane geometry rebuilds with a hole).
const cutBefore = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).params.cutouts.length, paneInfo.id);
const addPos = map1.actions.addCutout;
const addS = await proj(addPos);
await page.mouse.click(addS.sx, addS.sy);
await page.waitForTimeout(500);
const cutAfter = await page.evaluate((id) => window.__PRISM_PRIM_STORE__().schemas.find((s) => s.nodeId === id).params.cutouts.length, paneInfo.id);
console.log('ADD CUTOUT:', cutBefore, '→', cutAfter, cutAfter === cutBefore + 1 ? 'ADDED ✓' : 'NO CHANGE ✗');
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0.6, 0.2, 20.5, 0.6, 0.2, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/winspector-cutout.png` });

const auth = await page.evaluate(() => window.__PRISM_PRIM_AUTHORSHIP__());
console.log('authorship ok:', auth.ok, 'orphans:', auth.orphans.length);
console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
console.log(JSON.stringify({
  selected: selected === paneInfo.id,
  faderChanged: widthAfter > widthBefore + 0.3,
  materialChanged: matAfter === 'worn-emerald',
  cutoutAdded: cutAfter === cutBefore + 1,
  authOk: auth.ok, errors: errors.length,
}));
