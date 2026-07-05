// PRISM-P2 w-prompt — prompt-to-texture. (1) a PRE-GENERATED matched+delit set
// renders, (2) a LIVE generation (in-canvas) runs the FLUX pipeline + delit derive
// + applies the new material. Headless/offscreen.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PRIM_BASE || 'http://localhost:3000';
const OUT = 'notes/verification/prim-p2';
mkdirSync(OUT, { recursive: true });
const LIVE = process.env.LIVE_GEN !== '0';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const metrics = { steps: [], errors: [] };

await page.goto(`${BASE}/material-lab`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !!window.__PRISM_MAT_PROMPT__ && !!window.__PRISM_MAT_APPLY__, { timeout: 45000 });
await page.waitForTimeout(2800);
await shot('prompt-01-overview');

// 1) apply a PRE-GENERATED (matched+delit) seed
for (const id of ['generated.brushed-copper', 'generated.carrara-marble', 'generated.walnut-grain']) {
  await page.evaluate((mid) => { window.__PRISM_MAT_SET_FAMILY__('Generated'); window.__PRISM_MAT_APPLY__(mid); }, id);
  await page.waitForTimeout(900);
  const a = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
  metrics.steps.push({ seed: id, ok: a.ok, selected: a.selectedMaterialId });
  await shot(`prompt-02-seed-${id.split('.')[1]}`);
  console.log('seed %s ok=%s', id, a.ok);
}

// 2) LIVE generation through the in-canvas prompt path
if (LIVE) {
  console.log('LIVE generation: hammered antique brass …');
  await page.evaluate(() => window.__PRISM_MAT_PROMPT__.focus());
  await page.evaluate(() => window.__PRISM_MAT_PROMPT__.setBuffer('hammered antique brass with dimpled planished texture'));
  await page.waitForTimeout(300);
  await shot('prompt-03-typed');
  await page.evaluate(() => window.__PRISM_MAT_PROMPT__.generate(undefined, 'metal'));
  // poll up to 195s for completion
  let st = null;
  for (let i = 0; i < 65; i++) {
    await page.waitForTimeout(3000);
    st = await page.evaluate(() => window.__PRISM_MAT_PROMPT__.status());
    if (st.status === 'done' || st.status === 'error') break;
    if (i % 4 === 0) console.log('  …', st.status);
  }
  metrics.liveGen = st;
  console.log('LIVE gen status=%s message=%s', st?.status, st?.message);
  await page.waitForTimeout(1500);
  await shot('prompt-04-live-generated');
  const a = await page.evaluate(() => window.__PRISM_MAT_AUTHORSHIP__());
  metrics.liveApplied = { ok: a.ok, selected: a.selectedMaterialId, rendered: a.renderedCount };
  console.log('LIVE applied selected=%s ok=%s', a.selectedMaterialId, a.ok);
}

metrics.errors = errors;
writeFileSync(`${OUT}/prompt-metrics.json`, JSON.stringify(metrics, null, 2));
console.log('CONSOLE ERRORS:', errors.length);
if (errors.length) console.log(errors.slice(0, 8).join('\n'));
await browser.close();
console.log('PROMPT-SMOKE-DONE');
