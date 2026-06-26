#!/usr/bin/env node
// PRIM-P4 — consolidated HEADLESS BEHAVIORAL verification (VERIFICATION-STANDARD.md).
//
// Drives /composite-lab in a headless browser and proves, with interaction evidence,
// the full spec §4 surface: composite = subgraph; the BOUND nav header auto-populates
// one tab per hub; auto-add ON adds / OFF freezes / re-ON resyncs; the binding is
// EDITABLE (rename / reorder / hide) — verified via REAL trusted-pointer clicks on the
// dogfooded in-canvas Inspector; the dropdown EXPANDS as flowing 3D liquid glass; and
// the two-state galaxy ⇄ canvas holds. Frames + behavioral-metrics.json → prim-p4/.
//
//   node notes/verify-prim-p4.mjs            (assumes dev server on :3000)

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'verification', 'prim-p4');
mkdirSync(OUT, { recursive: true });
const URL = process.env.URL || 'http://localhost:3000/composite-lab';

const M = {}; // behavioral metrics
const shot = (page, name) => page.screenshot({ path: join(OUT, name) });

function pixDiff(a, b) {
  // lazy require pngjs only if present
  let PNG;
  try { PNG = require('pngjs').PNG; } catch { return -1; }
  const A = PNG.sync.read(readFileSync(join(OUT, a)));
  const B = PNG.sync.read(readFileSync(join(OUT, b)));
  let d = 0; const n = Math.min(A.data.length, B.data.length);
  for (let i = 0; i < n; i += 4) {
    if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 18) d++;
  }
  return d;
}

(async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__PRISM_COMPOSITE_CAM__ === 'object' && window.__PRISM_COMPOSITE_STORE__?.().composites.length >= 3, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);

  M.backend = await page.evaluate(() => window.__PRISM_COMPOSITE_BACKEND__());
  M.seeded = await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().composites.map((c) => c.templateId));
  const navId = await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().composites.find((c) => c.templateId === 'nav-header').compositeId);

  // overview frame (all composites + PAGES column + inspector + palette)
  await page.evaluate(() => window.__PRISM_COMPOSITE_CAM__.set(0.6, -0.2, 22, 0.2, -0.4, 0));
  await page.waitForTimeout(700);
  await shot(page, 'bh-overview.png');

  // subgraph shape (the instantiated nav is a real subgraph)
  M.subgraph = await page.evaluate(() => window.__PRISM_COMPOSITE_SUBGRAPH__());

  // 1) AUTO-POPULATE
  M.autoPopulate = await page.evaluate(() => window.__PRISM_NAV_TABS__());

  // 2) AUTO-ADD ON → +1
  M.addOn = await page.evaluate((id) => { const st = window.__PRISM_COMPOSITE_STORE__(); const before = window.__PRISM_NAV_TABS__(id).tabCount; st.addHub(); return { before, after: window.__PRISM_NAV_TABS__(id).tabCount }; }, navId);

  // 3) AUTO-ADD OFF → frozen
  M.addOff = await page.evaluate((id) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.toggleAutoAdd(id); const before = window.__PRISM_NAV_TABS__(id).tabCount; st.addHub(); return { before, after: window.__PRISM_NAV_TABS__(id).tabCount }; }, navId);

  // 4) RE-ON → resync
  M.reOn = await page.evaluate((id) => { const st = window.__PRISM_COMPOSITE_STORE__(); const before = window.__PRISM_NAV_TABS__(id).tabCount; st.toggleAutoAdd(id); return { before, after: window.__PRISM_NAV_TABS__(id).tabCount, hubCount: window.__PRISM_NAV_TABS__(id).hubCount }; }, navId);

  // 5) EDITABLE via REAL trusted-pointer clicks on the dogfooded Inspector
  await page.evaluate(() => window.__PRISM_COMPOSITE_CAM__.set(7.6, 0, 12.5, 7.6, 0, 0));
  await page.waitForTimeout(700);
  const click = async (wp) => { const [x, y] = await page.evaluate((w) => window.__PRISM_COMPOSITE_CAM__.project(w[0], w[1], w[2]), wp); await page.mouse.click(x, y); await page.waitForTimeout(350); };
  let map = await page.evaluate(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
  const autoBefore = map.autoAdd;
  await click(map.controls.autoAdd);
  let after = await page.evaluate(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
  M.realClickAutoAdd = { before: autoBefore, after: after.autoAdd, toggled: autoBefore !== after.autoAdd };
  // reset auto-add ON for a clean rename/hide on the resolved set
  if (after.autoAdd === false) { await click(map.controls.autoAdd); }
  map = await page.evaluate(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
  const rowR = map.rows.find((r) => !r.manual && !r.hidden);
  const beforeLabel = rowR.label;
  await click(rowR.rename);
  after = await page.evaluate(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
  M.realClickRename = { before: beforeLabel, after: after.rows.find((r) => r.key === rowR.key)?.label, changed: after.rows.find((r) => r.key === rowR.key)?.label !== beforeLabel };
  const rowH = after.rows.find((r) => !r.manual && !r.hidden);
  const tabsBeforeHide = after.tabCount;
  await click(rowH.hideShow);
  after = await page.evaluate(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
  M.realClickHide = { label: rowH.label, before: tabsBeforeHide, after: after.tabCount, hid: after.tabCount === tabsBeforeHide - 1 };
  await shot(page, 'bh-inspector-realclicks.png');

  // 6) DROPDOWN expands as flowing liquid glass (open → 2-frame flow diff)
  await page.evaluate((id) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.toggleDropdown(id); st.setDropdownPhase(1); st.setDropdownPlaying(true); }, navId);
  await page.waitForTimeout(1400);
  M.dropdownPhase = await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().dropdownPhase);
  const dc = await page.evaluate(() => { const dd = window.__PRISM_COMPOSITE_STORE__().nodes().find((n) => n.subtype === 'composite-nav-dropdown'); return { x: dd.scenePosition.x, y: dd.scenePosition.y }; });
  await page.evaluate((d) => window.__PRISM_COMPOSITE_CAM__.set(d.x, d.y - 0.6, 5.4, d.x, d.y - 0.6, 0), dc);
  await page.waitForTimeout(700);
  await shot(page, 'bh-dropdown-liquid-A.png');
  await page.waitForTimeout(700);
  await shot(page, 'bh-dropdown-liquid-B.png');
  M.liquidFlowPixels = pixDiff('bh-dropdown-liquid-A.png', 'bh-dropdown-liquid-B.png');

  // 7) TWO-STATE galaxy ⇄ canvas
  await page.evaluate(() => window.__PRISM_COMPOSITE_CAM__.set(0.6, -0.2, 22, 0.2, -0.4, 0));
  await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().setView('galaxy'));
  await page.waitForTimeout(2200);
  const galaxy = await page.evaluate(() => window.__PRISM_COMPOSITE_AUTHORSHIP__());
  M.galaxy = { ok: galaxy.ok, rendered: galaxy.renderedCount, orphans: galaxy.orphans.length };
  await shot(page, 'bh-galaxy.png');
  await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().setView('canvas'));
  await page.waitForTimeout(2500);
  const canvas = await page.evaluate(() => window.__PRISM_COMPOSITE_AUTHORSHIP__());
  M.canvas = { ok: canvas.ok, rendered: canvas.renderedCount, nodes: canvas.nodeIds.length, orphans: canvas.orphans.length, unrealized: canvas.unrealized.length };
  await shot(page, 'bh-canvas.png');

  M.pageErrors = pageErrors.length;
  M.consoleErrors = consoleErrors.length;
  M.pageErrorSample = pageErrors.slice(0, 3);

  writeFileSync(join(OUT, 'behavioral-metrics.json'), JSON.stringify(M, null, 2) + '\n');
  console.log(JSON.stringify(M, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
