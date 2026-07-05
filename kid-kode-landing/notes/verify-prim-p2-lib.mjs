// PRISM-P2 w-lib smoke — /material-lab renders the curated library under shared
// IBL, Node-Law probe holds, materials apply across families. Headless/offscreen.
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

await page.goto(`${BASE}/material-lab`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__PRISM_MAT_AUTHORSHIP__, { timeout: 45000 });
await page.waitForTimeout(2500); // IBL + textures warm
await shot('lib-01-overview');

const auth = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
const self = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP_SELFTEST__());
metrics.authorship = auth;
metrics.selftest = self;
console.log('AUTHORSHIP ok=%s rendered=%d orphans=%d unrealized=%d', auth.ok, auth.renderedCount, auth.orphans.length, auth.unrealized.length);
console.log('SELFTEST live=%s caught=%d', self.live, self.caughtCount);

// library size + families
const lib = await page.evaluate(() => {
  const st = window.__PRISM_MAT_STORE__();
  return { families: st.activeFamily, selected: st.selectedMaterialId };
});

// apply one signature material per family and capture a frame.
const tour = [
  ['Metals', 'metal.gold'],
  ['Glass', 'glass.smoke'],
  ['Gems', 'gem.ruby'],
  ['Gems', 'gem.diamond'],
  ['Stones', 'stone.jade'],
  ['Exotic', 'exotic.oil-slick'],
  ['Exotic', 'exotic.soap-film'],
  ['Fabrics', 'fabric.velvet-red'],
  ['Woods', 'wood.walnut'],
  ['Ceramics', 'ceramic.cobalt-glaze'],
];
let i = 2;
for (const [fam, id] of tour) {
  await page.evaluate((f) => window.__PRISM_MAT_SET_FAMILY__(f), fam);
  await page.evaluate((mid) => window.__PRISM_MAT_APPLY__(mid), id);
  await page.waitForTimeout(700);
  const label = String(i).padStart(2, '0');
  await shot(`lib-${label}-${id.replace('.', '_')}`);
  const a = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
  metrics.steps.push({ fam, id, selected: a.selectedMaterialId, ok: a.ok });
  console.log('applied %s/%s ok=%s selected=%s', fam, id, a.ok, a.selectedMaterialId);
  i++;
}

metrics.errors = errors;
writeFileSync(`${OUT}/lib-metrics.json`, JSON.stringify(metrics, null, 2));
console.log('CONSOLE ERRORS:', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
console.log('LIB-SMOKE-DONE');
