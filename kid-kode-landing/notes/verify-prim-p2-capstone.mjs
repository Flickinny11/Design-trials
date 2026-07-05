// PRISM-P2 capstone evidence — the advocate's task: apply THREE materials to a
// PANE (incl. one via prompt-to-texture) + capture aesthetic-match references
// against the approved /toolbar-chassis + /keyframe-editor. Headless/offscreen.
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
await page.waitForFunction(() => !!window.__PRISM_MAT_CAM__ && !!window.__PRISM_MAT_APPLY__, { timeout: 45000 });
await page.waitForTimeout(2800);

// frame the PANE display (world ~ -3.7, 2.9) head-on, close.
await page.evaluate(() => window.__PRISM_MAT_CAM__.set(-3.7, 2.9, 8.5, -3.7, 2.9, 0));
await page.waitForTimeout(400);

// three materials on the pane, incl. one prompt-to-texture (generated).
const trio = [
  ['Metals', 'metal.gold', 'cap-pane-A-gold'],
  ['Gems', 'gem.ruby', 'cap-pane-B-ruby'],
  ['Generated', 'generated.brushed-copper', 'cap-pane-C-copper-p2t'],
];
for (const [fam, id, label] of trio) {
  await page.evaluate((f) => window.__PRISM_MAT_SET_FAMILY__(f), fam);
  await page.evaluate((mid) => window.__PRISM_MAT_APPLY__(mid), id);
  await page.waitForTimeout(800);
  await shot(label);
  metrics.steps.push({ fam, id, label });
  console.log('pane material:', id);
}

// pull back to the full studio overview.
await page.evaluate(() => window.__PRISM_MAT_CAM__.set(0.2, 0.0, 22.5, 0, 0, 0));
await page.waitForTimeout(500);
await page.evaluate(() => { window.__PRISM_MAT_SET_FAMILY__('Exotic'); window.__PRISM_MAT_APPLY__('exotic.soap-film'); });
await page.waitForTimeout(700);
await shot('cap-studio-overview');

// aesthetic-match references (the approved surfaces).
await page.goto(`${BASE}/toolbar-chassis`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await shot('cap-ref-toolbar-chassis');
await page.goto(`${BASE}/keyframe-editor`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await shot('cap-ref-keyframe-editor');

metrics.errors = errors;
writeFileSync(`${OUT}/capstone-metrics.json`, JSON.stringify(metrics, null, 2));
console.log('CONSOLE ERRORS:', errors.length);
await browser.close();
console.log('CAPSTONE-DONE');
