import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT = 'notes/verification/prim-p3';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

async function diff(aBuf, bBuf) {
  const a = await sharp(aBuf).resize(640, 400, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const b = await sharp(bBuf).resize(640, 400, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let sum = 0, changed = 0, max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]); sum += d; if (d > 14) changed++; if (d > max) max = d;
  }
  return { meanAbsDiff: +(sum / a.length).toFixed(3), changedPct: +(100 * changed / a.length).toFixed(2), max };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` }).then(() => page.screenshot());

await page.goto(`${BASE}/fluid-lab`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const booted = await page.waitForFunction(() => !!window.__PRISM_FLUID_AUTHORSHIP__ && window.__PRISM_FLUID_STORE__?.().schemas.length > 0, { timeout: 60000 }).then(()=>true).catch(()=>false);
console.log('BOOTED', booted);
if (!booted) { console.log('ERRORS', errors.slice(0,6)); await browser.close(); process.exit(1); }
await page.waitForTimeout(3500);

const backend = await page.evaluate(() => window.__PRISM_FLUID_BACKEND__());
const auth = await page.evaluate(() => window.__PRISM_FLUID_AUTHORSHIP__());
console.log('BACKEND', JSON.stringify(backend));
console.log('AUTHORSHIP ok=%s rendered=%d nodes=%d orphans=%d', auth.ok, auth.renderedCount, auth.nodeIds.length, auth.orphans.length);

// get surface node id
const ids = await page.evaluate(() => window.__PRISM_FLUID_STORE__().schemas.map(s => ({ id: s.nodeId, kind: s.kind })));
const surfaceId = (ids.find(x => x.kind === 'surface') || ids[0]).id;
console.log('surface node', surfaceId);

// MOTION over time
const m0 = await shot('00-baseline');
await page.waitForTimeout(900);
const m1 = await shot('01-baseline-t1');
console.log('MOTION', JSON.stringify(await diff(m0, m1)));

// PARAM: flowSpeed low vs high (+turbulence)
await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { flowSpeed: 0.05, turbulence: 0.0, pattern: 'directional' }), surfaceId);
await page.waitForTimeout(1800);
const slow = await shot('02-flow-slow');
await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { flowSpeed: 1.9, turbulence: 0.9 }), surfaceId);
await page.waitForTimeout(1800);
const fast = await shot('03-flow-fast');
console.log('FLOWSPEED slow-vs-fast', JSON.stringify(await diff(slow, fast)));

// PARAM: thickness low vs high
await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { thickness: 0.3, flowSpeed: 0.6, turbulence: 0.3 }), surfaceId);
await page.waitForTimeout(1500);
const thin = await shot('04-thin');
await page.evaluate((id) => window.__PRISM_FLUID_SET_PARAM__(id, { thickness: 2.4 }), surfaceId);
await page.waitForTimeout(1500);
const thick = await shot('05-thick');
console.log('THICKNESS thin-vs-thick', JSON.stringify(await diff(thin, thick)));

// LIQUID GLASS trigger (phase 0 -> 1)
await page.evaluate(() => window.__PRISM_FLUID_SET_PHASE__(0));
await page.waitForTimeout(900);
const solid = await shot('06-phase0-solid');
await page.evaluate(() => window.__PRISM_FLUID_SET_PHASE__(1));
await page.waitForTimeout(1400);
const liquid = await shot('07-phase1-liquid');
console.log('LIQUIDGLASS solid-vs-liquid', JSON.stringify(await diff(solid, liquid)));

console.log('CONSOLE ERRORS', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
writeFileSync(`${OUT}/_validate-meta.json`, JSON.stringify({ backend, auth: { ok: auth.ok, rendered: auth.renderedCount, nodes: auth.nodeIds.length }, errors }, null, 2));
await browser.close();
console.log('VALIDATE-DONE');
