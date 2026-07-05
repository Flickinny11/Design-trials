// HEADLESS behavioral verification — EDIT-I2 w-library.
// Proves the DOCKED library palette browses/searches and DRAG-INSTANTIATES into
// the REAL app graph (INV-0.3): a dropped primitive/material/composite becomes a
// genuine node in galaxy + canvas — NOT a library-local instance.
// Frames → notes/verification/edit-i2/.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/edit-i2';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const nodeCount = (page) => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0
      && typeof w.__PRISM_EDITOR_LIBRARY_TILES__ === 'function'
      && typeof w.__PRISM_EDITOR_LIBRARY_DROP__ === 'function';
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(3000); // palette textures + tiles + fit settle

  // palette tiles present (Primitives default section)
  const tiles0 = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__());
  ok('library-tiles-present', tiles0.length >= 3, `${tiles0.length} tiles: ${tiles0.map((t) => t.entryId).join(',')}`);
  await page.screenshot({ path: `${OUT}/library-01-coldload.png` });

  // ── functional drop into REAL graph (probe) ─────────────────────────────────
  const n0 = await nodeCount(page);
  const dropIds = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_DROP__('prim:cube'));
  await page.waitForTimeout(1200);
  const n1 = await nodeCount(page);
  ok('drop-primitive-into-graph', n1 === n0 + 1 && dropIds.length === 1, `${n0}→${n1} ids=${JSON.stringify(dropIds)}`);
  const authC = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('drop-realizes-canvas', authC.ok === true, `orphans=${authC.orphans.length} unrealized=${authC.unrealizedActiveHub.length}`);
  await page.screenshot({ path: `${OUT}/library-02-after-drop-cube.png` });

  // ── composite drop → N real nodes ───────────────────────────────────────────
  const n1b = await nodeCount(page);
  const compIds = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_DROP__('comp:nav-header'));
  await page.waitForTimeout(1200);
  const n2 = await nodeCount(page);
  ok('drop-composite-N-nodes', n2 === n1b + compIds.length && compIds.length >= 1, `${n1b}→${n2}, ${compIds.length} member nodes`);

  // ── material drop (sphere wearing a registry material) ──────────────────────
  const n2b = await nodeCount(page);
  const matIds = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_DROP__('mat:metal.gold'));
  await page.waitForTimeout(1000);
  const n3 = await nodeCount(page);
  ok('drop-material-into-graph', n3 === n2b + 1 && matIds.length === 1, `${n2b}→${n3}`);

  // ── TRUSTED real drag: tile → viewport center ───────────────────────────────
  // ensure search not focused (keystrokes would otherwise go to it)
  await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_STORE__().focusSearch(false));
  const tiles = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__());
  const sphere = tiles.find((t) => t.entryId === 'prim:sphere') || tiles[0];
  const tileCss = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), sphere.world);
  const centerCss = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.project(0.0, -0.4, 0.0));
  const nDragBefore = await nodeCount(page);
  await page.mouse.move(tileCss[0], tileCss[1]);
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(120);
  // travel in steps so DragGhost's useFrame tracks the pointer onto the drop plane
  for (let i = 1; i <= 6; i++) {
    const x = tileCss[0] + ((centerCss[0] - tileCss[0]) * i) / 6;
    const y = tileCss[1] + ((centerCss[1] - tileCss[1]) * i) / 6;
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1300);
  const nDragAfter = await nodeCount(page);
  ok('trusted-drag-instantiates-node', nDragAfter === nDragBefore + 1, `drag tile@${tileCss.map((v) => Math.round(v))} → center@${centerCss.map((v) => Math.round(v))}: ${nDragBefore}→${nDragAfter}`);
  await page.screenshot({ path: `${OUT}/library-03-after-trusted-drag.png` });

  // ── SEARCH filters the palette (real keystrokes) ────────────────────────────
  const tilesBeforeSearch = (await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__())).length;
  await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_STORE__().focusSearch(true));
  await page.keyboard.type('cube', { delay: 90 });
  await page.waitForTimeout(700);
  const query = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_STORE__().query);
  const tilesAfterSearch = (await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__())).length;
  ok('search-filters-palette', query.toLowerCase().includes('cube') && tilesAfterSearch <= tilesBeforeSearch && tilesAfterSearch >= 1, `query="${query}" tiles ${tilesBeforeSearch}→${tilesAfterSearch}`);
  await page.screenshot({ path: `${OUT}/library-04-search-cube.png` });
  // clear search
  await page.evaluate(() => { const s = window.__PRISM_EDITOR_LIBRARY_STORE__(); s.setQuery(''); s.focusSearch(false); });
  await page.waitForTimeout(500);

  // ── galaxy: every dropped node is a real backing node (Law 0) ───────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
  await page.waitForTimeout(1800);
  const authG = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('galaxy-authorship-ok', authG.ok === true, `orphans=${authG.orphans.length} missing=${authG.galaxyMissing.length} rendered=${authG.renderedCount}`);
  await page.screenshot({ path: `${OUT}/library-05-galaxy-after-drops.png` });

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== EDIT-I2 library: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
