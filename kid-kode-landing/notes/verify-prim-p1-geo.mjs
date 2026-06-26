// HEADLESS smoke for PRIM-P1 w-geo: cold-load /primitive-lab, confirm the three
// parametric primitives render as REAL nodes, then prove LIVE REBUILD (mutate
// schema params via the store → geometry rebuilds). NEVER headed (offscreen only).
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

// Wait for the scene probe + the seeded 3 schemas.
const booted = await page.waitForFunction(() => {
  const w = window;
  return typeof w.__PRISM_PRIM_STORE__ === 'function' && w.__PRISM_PRIM_STORE__().schemas.length >= 3;
}, { timeout: 60000 }).then(() => true).catch(() => false);
console.log('booted+seeded:', booted);

await page.waitForTimeout(2500); // settle worn-PBR + env stream-in

// Frame the three primitives.
await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0, 0.6, 16, 0, 0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/wgeo-coldload.png` });

// Read scene: count tagged primitive groups + their node ids.
const sceneInfo = await page.evaluate(() => {
  const scene = window.__PRISM_PRIM_SCENE__;
  const tagged = [];
  scene?.traverse((o) => { if (o.userData?.prismPrimitive) tagged.push({ id: o.userData.prismNodeId, kind: o.userData.prismKind }); });
  const st = window.__PRISM_PRIM_STORE__();
  return { tagged, nodeIds: st.nodes().map((n) => n.nodeId), kinds: st.schemas.map((s) => s.kind) };
});
console.log('rendered tagged primitives:', JSON.stringify(sceneInfo.tagged));
console.log('node ids:', JSON.stringify(sceneInfo.nodeIds));

// LIVE REBUILD proof: grab the pane node, snapshot its geometry vertex count,
// then thicken it + add two cutouts and confirm the vertex count changes (rebuild).
const rebuild = await page.evaluate(async () => {
  const st = window.__PRISM_PRIM_STORE__();
  const pane = st.schemas.find((s) => s.kind === 'pane');
  if (!pane) return { ok: false, reason: 'no pane' };
  const scene = window.__PRISM_PRIM_SCENE__;
  const find = () => {
    let m = null;
    scene.traverse((o) => { if (o.userData?.prismNodeId === pane.nodeId) o.traverse((c) => { if (c.isMesh && !m) m = c; }); });
    return m;
  };
  const before = find()?.geometry?.attributes?.position?.count ?? -1;
  // mutate: thicker + corner + two cutouts
  st.updateParam(pane.nodeId, { depth: 0.7, cornerRadius: 0.5 });
  st.addCutout(pane.nodeId);
  st.addCutout(pane.nodeId);
  return { ok: true, before, paneId: pane.nodeId };
});
await page.waitForTimeout(700); // allow React to rebuild geometry
const after = await page.evaluate((paneId) => {
  const scene = window.__PRISM_PRIM_SCENE__;
  let m = null;
  scene.traverse((o) => { if (o.userData?.prismNodeId === paneId) o.traverse((c) => { if (c.isMesh && !m) m = c; }); });
  return m?.geometry?.attributes?.position?.count ?? -1;
}, rebuild.paneId);
console.log('pane vertex count before→after:', rebuild.before, '→', after, after !== rebuild.before ? 'REBUILT ✓' : 'NO CHANGE ✗');

await page.evaluate(() => window.__PRISM_PRIM_CAM__?.set(0, 0.6, 16, 0, 0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/wgeo-rebuild.png` });

console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
console.log(JSON.stringify({
  booted, renderedCount: sceneInfo.tagged.length, nodeCount: sceneInfo.nodeIds.length,
  rebuilt: after !== rebuild.before, errors: errors.length,
}));
