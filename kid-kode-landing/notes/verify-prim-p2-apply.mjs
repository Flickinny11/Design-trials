// PRISM-P2 w-apply — live apply + in-canvas PBR param tuning. Real-pointer fader
// drags via the live camera matrices; confirms the override changes the material
// and the displays rebuild. Headless/offscreen.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PRIM_BASE || 'http://localhost:3000';
const OUT = 'notes/verification/prim-p2';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const metrics = { steps: [], errors: [] };

const proj = (p) => page.evaluate((pt) => {
  const cam = window.__PRISM_MAT_CAM__.camera;
  const e = cam.matrixWorldInverse.elements, pe = cam.projectionMatrix.elements;
  const [x, y, z] = pt;
  const vx = e[0]*x+e[4]*y+e[8]*z+e[12], vy = e[1]*x+e[5]*y+e[9]*z+e[13], vz = e[2]*x+e[6]*y+e[10]*z+e[14], vw = e[3]*x+e[7]*y+e[11]*z+e[15];
  const cx = pe[0]*vx+pe[4]*vy+pe[8]*vz+pe[12]*vw, cy = pe[1]*vx+pe[5]*vy+pe[9]*vz+pe[13]*vw, cw = pe[3]*vx+pe[7]*vy+pe[11]*vz+pe[15]*vw;
  return { sx: (cx/cw*0.5+0.5)*window.innerWidth, sy: (-cy/cw*0.5+0.5)*window.innerHeight };
}, p);

const dragFader = async (key, frac) => {
  const map = await page.evaluate(() => window.__PRISM_MAT_INSPECTOR_MAP__());
  const f = map.faders.find((x) => x.key === key);
  if (!f) return { ok: false, reason: 'no fader ' + key };
  const startX = f.worldX0 + (f.value - f.min) / (f.max - f.min) * (f.worldX1 - f.worldX0);
  const targetVal = f.min + frac * (f.max - f.min);
  const targetX = f.worldX0 + (targetVal - f.min) / (f.max - f.min) * (f.worldX1 - f.worldX0);
  const a = await proj([startX, f.worldY, map.knobZ]);
  const b = await proj([targetX, f.worldY, map.knobZ]);
  await page.mouse.move(a.sx, a.sy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.sx + (b.sx - a.sx) * i / 8, a.sy + (b.sy - a.sy) * i / 8); await page.waitForTimeout(35); }
  await page.mouse.up(); await page.waitForTimeout(350);
  const after = await page.evaluate(() => window.__PRISM_MAT_STORE__().overrides);
  return { ok: typeof after[key] === 'number', value: after[key], targetVal };
};

await page.goto(`${BASE}/material-lab`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__PRISM_MAT_INSPECTOR_MAP__, { timeout: 45000 });
await page.waitForTimeout(2500);
await shot('apply-01-inspector-overview');

// 1) gold → push ROUGHNESS up (polished → brushed)
await page.evaluate(() => { window.__PRISM_MAT_SET_FAMILY__('Metals'); window.__PRISM_MAT_APPLY__('metal.gold'); });
await page.waitForTimeout(600);
await shot('apply-02-gold-default');
let r = await dragFader('roughness', 0.92);
metrics.steps.push({ mat: 'metal.gold', fader: 'roughness', ...r });
await shot('apply-03-gold-roughened');
console.log('gold roughness drag ok=%s value=%s', r.ok, r.value);

// 2) diamond → drag FIRE (dispersion) up
await page.evaluate(() => { window.__PRISM_MAT_SET_FAMILY__('Gems'); window.__PRISM_MAT_APPLY__('gem.diamond'); });
await page.waitForTimeout(600);
r = await dragFader('dispersion', 0.95);
metrics.steps.push({ mat: 'gem.diamond', fader: 'dispersion', ...r });
await shot('apply-04-diamond-fire');
console.log('diamond dispersion drag ok=%s value=%s', r.ok, r.value);

// 3) oil-slick → drag IRIDESCENCE
await page.evaluate(() => { window.__PRISM_MAT_SET_FAMILY__('Exotic'); window.__PRISM_MAT_APPLY__('exotic.oil-slick'); });
await page.waitForTimeout(600);
r = await dragFader('iridescence', 0.1);
metrics.steps.push({ mat: 'exotic.oil-slick', fader: 'iridescence-down', ...r });
await shot('apply-05-oilslick-iri-low');
r = await dragFader('iridescence', 1.0);
metrics.steps.push({ mat: 'exotic.oil-slick', fader: 'iridescence-up', ...r });
await shot('apply-06-oilslick-iri-high');
console.log('oil-slick iridescence drag ok=%s value=%s', r.ok, r.value);

// 4) reset clears overrides
const resetMap = await page.evaluate(() => window.__PRISM_MAT_INSPECTOR_MAP__());
const rp = await proj(resetMap.reset);
await page.mouse.click(rp.sx, rp.sy);
await page.waitForTimeout(500);
const afterReset = await page.evaluate(() => Object.keys(window.__PRISM_MAT_STORE__().overrides).length);
metrics.reset = { overridesAfter: afterReset };
await shot('apply-07-reset');
console.log('reset → overrides count=%d', afterReset);

metrics.errors = errors;
writeFileSync(`${OUT}/apply-metrics.json`, JSON.stringify(metrics, null, 2));
console.log('CONSOLE ERRORS:', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
console.log('APPLY-SMOKE-DONE');
