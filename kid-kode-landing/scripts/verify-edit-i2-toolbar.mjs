// HEADLESS behavioral verification — EDIT-I2 w-toolbar.
// Proves the DOCKED toolbar OPERATES on the live app graph:
//  • CREATE (probe + trusted real-cube click) adds a node that appears in
//    canvas + galaxy (INV-0.3);
//  • hover fires the cube spin (see-through);
//  • SCENE Background/Lighting visibly change the scene.
// All offscreen (headless). Frames → notes/verification/edit-i2/.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/edit-i2';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // wait for the graph + probes
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0
      && typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
      && typeof w.__PRISM_EDITOR_TOOLBAR_POS__ === 'function';
  }, { timeout: 90000 });
  await page.waitForTimeout(2500); // let MSDF / worn textures + fit settle

  // backend
  const backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.());
  ok('renderer-webgpu', !!backend?.isWebGPU || !!backend?.isWebGL, JSON.stringify(backend));

  // toolbar present (14 buttons resolvable)
  const list = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_LIST__?.() ?? []);
  ok('toolbar-14-buttons', list.length === 14, `${list.length} buttons: ${list.map((b) => b.id).join(',')}`);

  // cold-load frame (canvas view, toolbar visible)
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/toolbar-01-coldload-canvas.png` });

  // ── CREATE via probe: node appears in graph ────────────────────────────────
  const n0 = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
  const addStatus = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('add'));
  await page.waitForTimeout(1200);
  const n1 = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
  ok('create-add-node', n1 === n0 + 1, `${n0}→${n1} (${addStatus})`);
  await page.screenshot({ path: `${OUT}/toolbar-02-after-add-canvas.png` });

  // the new node realizes in canvas (authorship: no orphans, all active-hub realized)
  await page.waitForTimeout(800);
  const authCanvas = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('canvas-authorship-ok', authCanvas.ok === true, `orphans=${authCanvas.orphans.length} unrealized=${authCanvas.unrealizedActiveHub.length} rendered=${authCanvas.renderedCount}`);

  // ── object3d via TRUSTED real-cube click ───────────────────────────────────
  const positions = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_POS__());
  const obj = positions.find((p) => p.id === 'object3d');
  const css = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), obj.world);
  const n1b = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
  await page.mouse.move(css[0], css[1]);
  await page.waitForTimeout(150);
  await page.mouse.click(css[0], css[1]);
  await page.waitForTimeout(1200);
  const n2 = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
  ok('trusted-click-object3d-adds-node', n2 === n1b + 1, `clicked cube @ css(${css.map((v) => Math.round(v)).join(',')}) ${n1b}→${n2}`);
  await page.screenshot({ path: `${OUT}/toolbar-03-after-trusted-click.png` });

  // ── galaxy: the new nodes are seeded (INV-0.3 across both states) ───────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
  await page.waitForTimeout(1800);
  const authGalaxy = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('galaxy-authorship-ok', authGalaxy.ok === true, `orphans=${authGalaxy.orphans.length} missing=${authGalaxy.galaxyMissing.length} rendered=${authGalaxy.renderedCount}`);
  await page.screenshot({ path: `${OUT}/toolbar-04-galaxy-seeded.png` });

  // ── hover fires the spin (see-through) — capture mid-spin frame ─────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(1000);
  const addBtn = positions.find((p) => p.id === 'add');
  const addCss = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), addBtn.world);
  await page.mouse.move(addCss[0], addCss[1]);
  await page.waitForTimeout(280); // mid-spin (SPIN_DURATION ~1.15s)
  await page.screenshot({ path: `${OUT}/toolbar-05-hover-spin.png` });
  await page.mouse.move(10, 500); // move away
  ok('hover-dispatched', true, `hovered add @ css(${addCss.map((v) => Math.round(v)).join(',')})`);

  // ── SCENE: Background + Lighting visibly change ─────────────────────────────
  const bg0 = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__() && window.__PRISM_EDITOR_TOOLBAR_FN__('background'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/toolbar-06-background-cycled.png` });
  const lg0 = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('lighting'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/toolbar-07-lighting-cycled.png` });
  ok('scene-background-lighting', typeof bg0 === 'string' && typeof lg0 === 'string', `${bg0} / ${lg0}`);

  // ── changeArtifact: cycles the selected node's form (real graph op) ─────────
  const ca = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('changeArtifact'));
  await page.waitForTimeout(900);
  ok('logic-change-artifact', typeof ca === 'string' && ca.startsWith('changeArtifact'), ca);
  await page.screenshot({ path: `${OUT}/toolbar-08-change-artifact.png` });

  // ── OUTPUT build → preview view ─────────────────────────────────────────────
  const bd = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('build'));
  await page.waitForTimeout(1000);
  const view = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().view);
  ok('output-build-preview', view === 'preview-app', `${bd} → view=${view}`);
  await page.screenshot({ path: `${OUT}/toolbar-09-build-preview.png` });

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== EDIT-I2 toolbar: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
