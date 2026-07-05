// HEADLESS end-to-end — EDIT-I2: BUILD A SMALL APP with the docked toolbar +
// library, exactly the advocate's task ("use the toolbar to add an element and
// drag one in from the library"). Captures the canonical evidence frames + a
// behavioral-metrics.json. Offscreen. Frames → notes/verification/edit-i2/.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/edit-i2';
mkdirSync(OUT, { recursive: true });

const metrics = { base: BASE, steps: [], consoleErrors: [] };
const nodeCount = (page) => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
const step = (name, detail) => { metrics.steps.push({ name, detail }); console.log(`• ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') metrics.consoleErrors.push(m.text()); });
page.on('pageerror', (e) => metrics.consoleErrors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
    && typeof window.__PRISM_EDITOR_LIBRARY_DROP__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(3200);
  metrics.backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__());

  const start = await nodeCount(page);
  step('start', `live graph = ${start} nodes`);
  await page.screenshot({ path: `${OUT}/e2e-01-editor-loaded.png` });

  // 1) use the TOOLBAR to add an element (CREATE → Add)
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('add'));
  await page.waitForTimeout(1300);
  const afterAdd = await nodeCount(page);
  step('toolbar-add-element', `${start} → ${afterAdd} (+${afterAdd - start})`);
  await page.screenshot({ path: `${OUT}/e2e-02-toolbar-added-element.png` });

  // 2) add a 3D object via a TRUSTED click on the real cube button
  const tb = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_POS__());
  const objBtn = tb.find((b) => b.id === 'object3d');
  const objCss = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), objBtn.world);
  await page.mouse.click(objCss[0], objCss[1]);
  await page.waitForTimeout(1200);
  const afterObj = await nodeCount(page);
  step('toolbar-trusted-click-object', `${afterAdd} → ${afterObj}`);

  // 3) DRAG a primitive in from the LIBRARY (trusted pointer drag)
  await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_STORE__().focusSearch(false));
  const tiles = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__());
  const tile = tiles.find((t) => t.entryId === 'prim:sphere') || tiles[0];
  const tileCss = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), tile.world);
  const centerCss = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.project(-0.3, 0.2, 0.0));
  const beforeDrag = await nodeCount(page);
  await page.mouse.move(tileCss[0], tileCss[1]); await page.waitForTimeout(120);
  await page.mouse.down(); await page.waitForTimeout(120);
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(tileCss[0] + ((centerCss[0] - tileCss[0]) * i) / 6, tileCss[1] + ((centerCss[1] - tileCss[1]) * i) / 6);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(150); await page.mouse.up();
  await page.waitForTimeout(1300);
  const afterDrag = await nodeCount(page);
  step('library-trusted-drag', `${beforeDrag} → ${afterDrag} (+${afterDrag - beforeDrag})`);
  await page.screenshot({ path: `${OUT}/e2e-03-library-dragged-in.png` });

  // 4) authorship: everything we built maps to real backing nodes
  const authCanvas = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  step('canvas-authorship', `ok=${authCanvas.ok} orphans=${authCanvas.orphans.length} rendered=${authCanvas.renderedCount}`);

  // 5) switch to GALAXY — the whole built app reads as the unbuilt constellation
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
  await page.waitForTimeout(1800);
  const authGalaxy = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  step('galaxy-authorship', `ok=${authGalaxy.ok} seeded=${authGalaxy.renderedCount}`);
  await page.screenshot({ path: `${OUT}/e2e-04-galaxy.png` });

  // 6) build → preview the app
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(800);
  const total = await nodeCount(page);
  metrics.summary = { start, total, added: total - start, canvasAuthorshipOk: authCanvas.ok, galaxyAuthorshipOk: authGalaxy.ok };
  step('final', `built ${total - start} new nodes; graph now ${total}`);
  await page.screenshot({ path: `${OUT}/e2e-05-final-canvas.png` });

  metrics.consoleErrorCount = metrics.consoleErrors.length;
  metrics.pass = (afterAdd === start + 1) && (afterObj === afterAdd + 1) && (afterDrag === beforeDrag + 1)
    && authCanvas.ok && authGalaxy.ok && metrics.consoleErrors.length === 0;
} catch (e) {
  metrics.error = String(e?.stack || e);
  metrics.pass = false;
} finally {
  writeFileSync(`${OUT}/behavioral-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== EDIT-I2 e2e: pass=${metrics.pass} · consoleErrors=${metrics.consoleErrors.length} ===`);
  console.log(JSON.stringify(metrics.summary, null, 2));
  await browser.close();
  process.exit(metrics.pass ? 0 : 1);
}
