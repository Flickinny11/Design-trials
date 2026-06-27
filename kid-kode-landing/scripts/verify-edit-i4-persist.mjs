// HEADLESS behavioral verification — EDIT-I4 w-persist (save / load round-trip).
// Adds + moves + restyles a node, flushes a SAVE via the in-engine control, RELOADS
// the route, and proves the durable graph round-trips EXACTLY (the reloaded editor
// restores the saved state). Offscreen (headless). Frames → notes/verification/edit-i4/.
// NOTE: this writes public/prism-mock/home/live-graph.json; the caller restores it
// via `git checkout` after the run so the committed fixture stays clean.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/edit-i4';
mkdirSync(OUT, { recursive: true });

const results = [];
const metrics = {};
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const persist = () => page.evaluate(() => window.__PRISM_EDITOR_PERSIST__());
const snapshot = () => page.evaluate(() => window.__PRISM_EDITOR_GRAPH_SNAPSHOT__());
const inspector = () => page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__());
const count = () => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);

async function waitReady() {
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_PERSIST__ === 'function'
      && typeof w.__PRISM_EDITOR_SAVE__ === 'function'
      && typeof w.__PRISM_EDITOR_GRAPH_SNAPSHOT__ === 'function'
      && typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
      && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);
  const n0 = await count();
  await page.screenshot({ path: `${OUT}/persist-01-editor.png` });

  // ── 1. AUTHOR a distinctive edit (add + move + restyle) ─────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(900);
  const A = (await inspector()).nodeId;
  // deterministic move: nudge the selection +x several times (toolbar transform).
  for (let i = 0; i < 5; i++) {
    await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
    await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('transform'));
    await page.waitForTimeout(80);
  }
  // restyle: recolor via the changeArtifact -> primitive swap is destructive; use
  // the inspector swatch path is interactive — instead drive a known recolor by
  // selecting then changing artifact once (cube->sphere) so the snapshot differs.
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('changeArtifact'));
  await page.waitForTimeout(500);
  const n1 = await count();
  const before = await snapshot();
  const aLineBefore = before.nodes.find((l) => l.startsWith(A + '§'));
  ok('authored-edit', !!A && n1 === n0 + 1 && !!aLineBefore, `added ${A?.slice(0, 8)} count ${n0}→${n1}`);

  // ── 2. dirty state observable, then SAVE flushes it ─────────────────────────
  const pDirty = await persist();
  const saveRes = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(400);
  const pSaved = await persist();
  ok('save-flushes-dirty', pDirty.isDirty === true && saveRes.ok === true && pSaved.isDirty === false && !!pSaved.savedAt,
    `dirty ${pDirty.isDirty}→${pSaved.isDirty}, save.ok=${saveRes.ok}, savedAt=${pSaved.savedAt ? 'set' : 'null'}`);
  await page.screenshot({ path: `${OUT}/persist-02-saved.png` });

  // ── 3. RELOAD → the saved graph round-trips EXACTLY ─────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);
  const after = await snapshot();
  const aLineAfter = after.nodes.find((l) => l.startsWith(A + '§'));
  const nodeCountMatches = after.nodeCount === before.nodeCount;
  const aRoundTrips = !!aLineAfter && aLineAfter === aLineBefore;
  ok('reload-restores-exact-state', nodeCountMatches && aRoundTrips,
    `count ${before.nodeCount}→${after.nodeCount}; A present=${!!aLineAfter}; A identical=${aLineAfter === aLineBefore}`);
  await page.screenshot({ path: `${OUT}/persist-03-reloaded.png` });

  // full-graph durable equality (every node line + edge identical across the round-trip)
  const nodesEqual = JSON.stringify(before.nodes) === JSON.stringify(after.nodes);
  const edgesEqual = JSON.stringify(before.edges) === JSON.stringify(after.edges);
  ok('full-graph-round-trip', nodesEqual && edgesEqual, `nodesEqual=${nodesEqual} edgesEqual=${edgesEqual}`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  Object.assign(metrics, {
    nodesStart: n0, nodesAfterEdit: n1, addedNode: A,
    dirtyBeforeSave: pDirty.isDirty, saveOk: saveRes.ok, dirtyAfterSave: pSaved.isDirty, savedAt: pSaved.savedAt,
    countBefore: before.nodeCount, countAfter: after.nodeCount,
    aLineBefore, aLineAfter, nodesEqual, edgesEqual,
    consoleErrors: consoleErrors.length,
    backend: await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.()),
  });
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  metrics.checks = `${pass}/${results.length}`;
  metrics.results = results;
  writeFileSync(`${OUT}/persist-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== EDIT-I4 persist: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
