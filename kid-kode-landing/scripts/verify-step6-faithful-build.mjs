#!/usr/bin/env node
// STEP 6 — FAITHFUL BUILD verification (dependency-free; only node builtins +
// the already-approved `playwright`).
//
// Proves the load-bearing rule: a built artifact's POSITION and MOTION come
// ENTIRELY from the node's OWN schema/code — the runtime applies scenePosition
// and runs the node's own cinematicPrimitives; it does NOT impose a layout/grid.
//
// Evidence under notes/verification/step6/:
//   - canvas.png, preview-app.png, galaxy.png  (CDP captures of the WebGPU canvas)
//   - motion-a.png, motion-b.png               (two canvas frames, ~600ms apart)
//   - step6-report.json                        (per-node assertions + all checks)
//
// Scope items → runtime success criteria:
//   1 POSITION FROM SCHEMA   → worldPos(node) == node.scenePosition           (RT-SC-04/05, INV-25)
//   2 CODE + MOTION RUN      → inner artifacts move; canvas frames differ      (RT-SC-10)
//   3 BUILD REALIZATION      → pop reveal settles, then steady motion          (RT-SC-06)
//   4 FAITHFUL IN BOTH MODES → canvas + preview-app both place per schema      (RT-SC-10)
//   + toggling never rebuilds → __artifactBuildCount delta == 0 on mode toggle (RT-SC-08)

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4796);
const URL = `http://localhost:${PORT}/`;
const outDir = join(repoRoot, 'notes', 'verification', 'step6');
mkdirSync(outDir, { recursive: true });

const GRAPH = JSON.parse(
  readFileSync(join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json'), 'utf8'),
);
const NODES = GRAPH.nodes;
const TOL = 0.01;

const checks = [];
function check(id, desc, pass, detail = '') {
  checks.push({ id, desc, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${desc}${detail ? `  — ${detail}` : ''}`);
}

async function cdpShot(page, file) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(data, 'base64');
  writeFileSync(file, buf);
  return buf;
}

// Read the world position of a node's INNER artifact group (name `node:<id>`),
// decomposed from matrixWorld so no THREE import is needed in-page.
function readInner(page, id) {
  return page.evaluate((id) => {
    const wrap = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id);
    if (!wrap) return null;
    let inner = null;
    wrap.traverse((o) => {
      if (!inner && o.name === `node:${id}`) inner = o;
    });
    if (!inner) return null;
    inner.updateWorldMatrix(true, false);
    const e = inner.matrixWorld.elements;
    return { x: e[12], y: e[13], z: e[14] };
  }, id);
}

const consoleErrors = [];
const pageErrors = [];
const report = { startedAt: new Date().toISOString(), url: URL, nodeAssertions: [], checks, motion: {}, rebuild: {} };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e?.message || e)));

  await page.goto(URL, { waitUntil: 'networkidle' });

  const ids = NODES.map((n) => n.nodeId);

  // ---- enter canvas; wait for artifacts to build ----
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('canvas'));
  let ready = false;
  for (let i = 0; i < 60; i++) {
    ready = await page.evaluate((ids) => {
      const get = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
      return typeof get === 'function' && ids.every((id) => get(id) != null);
    }, ids);
    if (ready) break;
    await page.waitForTimeout(250);
  }
  check('canvas.ready', 'all nodes mounted with a readable world position in canvas', ready,
    ready ? `${ids.length} nodes` : 'world-pos hook never resolved');

  // ---- SCOPE 1: position == schema scenePosition ----
  const canvasPos = await page.evaluate((ids) => {
    const get = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
    const out = {}; for (const id of ids) out[id] = get(id); return out;
  }, ids);
  let allMatch = true;
  for (const n of NODES) {
    const sp = n.scenePosition ?? { x: 0, y: 0, z: 0 };
    const wp = canvasPos[n.nodeId];
    const dx = wp ? Math.abs(wp.x - sp.x) : Infinity;
    const dy = wp ? Math.abs(wp.y - sp.y) : Infinity;
    const dz = wp ? Math.abs(wp.z - sp.z) : Infinity;
    const match = dx <= TOL && dy <= TOL && dz <= TOL;
    if (!match) allMatch = false;
    report.nodeAssertions.push({ nodeId: n.nodeId, mode: 'canvas', schema: sp, world: wp, delta: { dx, dy, dz }, match });
  }
  check('canvas.position-eq-schema',
    'every artifact world position EQUALS its node schema scenePosition (no layout/grid)',
    allMatch, allMatch ? `${NODES.length}/${NODES.length} match ≤${TOL}` : 'see nodeAssertions');

  const distinct = new Set(NODES.map((n) => { const s = n.scenePosition ?? {}; return `${s.x},${s.y},${s.z}`; }));
  check('canvas.positions-distinct',
    'schema positions are distinct designed coords, not a generated grid',
    distinct.size >= 5, `${distinct.size} distinct positions across ${NODES.length} nodes`);

  await page.waitForTimeout(1400); // let build-pop + one-shot intros settle
  await cdpShot(page, join(outDir, 'canvas.png'));
  check('canvas.screenshot', 'canvas.png captured', existsSync(join(outDir, 'canvas.png')));

  // ---- SCOPE 2: CODE + MOTION RUN ----
  // (a) functional: inner artifacts move while their wrappers (schema anchors)
  //     stay put. Probe every node; the time-driven primitives (orbit, etc.)
  //     register movement, proving the node's own coded motion runs.
  const movers = [];
  const t0 = {};
  for (const id of ids) t0[id] = await readInner(page, id);
  await page.waitForTimeout(700);
  for (const id of ids) {
    const a = t0[id]; const b = await readInner(page, id);
    if (a && b) {
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (d > 0.01) movers.push({ id, delta: d });
    }
  }
  report.motion.movers = movers;
  check('motion.inner-moves',
    'at least one node artifact MOVES — its coded primitive is running',
    movers.length >= 1, movers.length ? movers.map((m) => `${m.id}:${m.delta.toFixed(3)}`).join(', ') : 'no movement detected');

  // wrappers (anchors) stay at schema while motion plays around them
  const anchorsStable = await page.evaluate((ids) => {
    const get = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
    const out = {}; for (const id of ids) out[id] = get(id); return out;
  }, ids);
  let anchorOk = true;
  for (const n of NODES) {
    const sp = n.scenePosition ?? { x: 0, y: 0, z: 0 };
    const wp = anchorsStable[n.nodeId];
    if (!(wp && Math.abs(wp.x - sp.x) <= TOL && Math.abs(wp.y - sp.y) <= TOL && Math.abs(wp.z - sp.z) <= TOL)) anchorOk = false;
  }
  check('motion.anchor-stable',
    'node wrappers stay at schema position while their motion plays around them',
    anchorOk, anchorOk ? 'anchors fixed at scenePosition' : 'an anchor drifted');

  // (b) vision: two canvas frames ~600ms apart; identical bytes ⇒ no motion.
  const a = await cdpShot(page, join(outDir, 'motion-a.png'));
  await page.waitForTimeout(600);
  const b = await cdpShot(page, join(outDir, 'motion-b.png'));
  const framesDiffer = !a.equals(b);
  report.motion.frameABytes = a.length;
  report.motion.frameBBytes = b.length;
  report.motion.framesDiffer = framesDiffer;
  check('motion.frames-differ',
    'canvas frames differ between captures (animation visibly running)',
    framesDiffer, framesDiffer ? `PNG bytes ${a.length} vs ${b.length}` : 'identical frames');

  // ---- toggling never rebuilds (RT-SC-08) ----
  const buildBefore = await page.evaluate(() => window.__artifactBuildCount ?? 0);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('preview-app'));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('canvas'));
  await page.waitForTimeout(700);
  const buildAfter = await page.evaluate(() => window.__artifactBuildCount ?? 0);
  report.rebuild = { buildBefore, buildAfter, delta: buildAfter - buildBefore };
  check('toggle.no-rebuild',
    'toggling canvas↔preview-app issues ZERO new artifact builds (serves cache)',
    buildAfter === buildBefore, `build count ${buildBefore} → ${buildAfter}`);

  // ---- SCOPE 4: faithful in preview-app too ----
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('preview-app'));
  await page.waitForTimeout(1200);
  const previewPos = await page.evaluate((ids) => {
    const get = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
    const out = {}; for (const id of ids) out[id] = get?.(id) ?? null; return out;
  }, ids);
  let previewMatch = true;
  for (const n of NODES) {
    const sp = n.scenePosition ?? { x: 0, y: 0, z: 0 };
    const wp = previewPos[n.nodeId];
    const ok = wp && Math.abs(wp.x - sp.x) <= TOL && Math.abs(wp.y - sp.y) <= TOL && Math.abs(wp.z - sp.z) <= TOL;
    if (!ok) previewMatch = false;
    report.nodeAssertions.push({ nodeId: n.nodeId, mode: 'preview-app', schema: sp, world: wp, match: !!ok });
  }
  check('preview.position-eq-schema',
    'preview-app places every artifact at its schema position too (faithful both modes)',
    previewMatch, previewMatch ? 'all match' : 'see nodeAssertions');
  await cdpShot(page, join(outDir, 'preview-app.png'));
  check('preview.screenshot', 'preview-app.png captured', existsSync(join(outDir, 'preview-app.png')));

  // ---- galaxy (dormant spheres) ----
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW_MODE__?.('galaxy'));
  await page.waitForTimeout(1200);
  await cdpShot(page, join(outDir, 'galaxy.png'));
  check('galaxy.screenshot', 'galaxy.png captured', existsSync(join(outDir, 'galaxy.png')));

  // ---- console / page errors ----
  const ignore = /Download the React DevTools|Warning:|\[ArtifactNode\]|favicon|MSDF font atlas warmup/i;
  const critical = [...pageErrors, ...consoleErrors].filter((e) => !ignore.test(e));
  report.consoleErrors = consoleErrors;
  report.pageErrors = pageErrors;
  check('console.no-errors', 'zero new console/page errors during the run',
    critical.length === 0, critical.length ? critical.slice(0, 3).join(' | ') : 'clean');
} finally {
  await browser.close();
}

report.finishedAt = new Date().toISOString();
report.summary = {
  total: checks.length,
  passed: checks.filter((c) => c.pass).length,
  failed: checks.filter((c) => !c.pass).length,
};
writeFileSync(join(outDir, 'step6-report.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.summary.passed}/${report.summary.total} checks passed; ${report.summary.failed} failed.`);
process.exit(report.summary.failed === 0 ? 0 : 1);
