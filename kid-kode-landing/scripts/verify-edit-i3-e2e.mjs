// HEADLESS end-to-end behavioral verification — EDIT-I3 (the culminating proof).
// ONE continuous session over the live app graph: select → INSPECT + edit full
// schema live → MOVE/ROTATE/SCALE via gizmo → STACK → CONNECT → GROUP + SAVE →
// KEYFRAME + scrub (node animates). Captures frames + behavioral-metrics.json.
// Offscreen (headless). Frames → notes/verification/edit-i3/.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'notes/verification/edit-i3';
mkdirSync(OUT, { recursive: true });

const results = [];
const metrics = {};
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);
const inspector = () => page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__());
const gizmo = () => page.evaluate(() => window.__PRISM_EDITOR_GIZMO__());
const meta = (id) => page.evaluate((i) => window.__PRISM_EDITOR_MANIP__.nodeMeta(i), id);
const kf = () => page.evaluate(() => window.__PRISM_EDITOR_KEYFRAME__());
const count = () => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
const faders = () => page.evaluate(() => window.__PRISM_EDITOR_FADER_LIST__());

async function newCube() {
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(1000);
  return (await inspector()).nodeId;
}
async function dragWorld(a3, b3, steps = 7) {
  const a = await project(a3), b = await project(b3);
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a[0] + (b[0] - a[0]) * (i / steps), a[1] + (b[1] - a[1]) * (i / steps)); await page.waitForTimeout(35); }
  await page.mouse.up(); await page.waitForTimeout(420);
}
async function waitFader(id, ms = 9000) {
  try {
    await page.waitForFunction((fid) => (window.__PRISM_EDITOR_FADER_LIST__?.() ?? []).some((f) => f.id === fid), id, { timeout: ms });
    return true;
  } catch { return false; }
}
async function dragFader(id, dir) {
  await waitFader(id);
  const f = (await faders()).find((x) => x.id === id); if (!f) return false;
  const s = await project(f.knob), t = await project(dir === 'right' ? f.right : f.left);
  await page.mouse.move(s[0], s[1]); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(s[0] + (t[0] - s[0]) * (i / 6), s[1] + (t[1] - s[1]) * (i / 6)); await page.waitForTimeout(38); }
  await page.mouse.up(); await page.waitForTimeout(420); return true;
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_GIZMO__ === 'function' && typeof w.__PRISM_EDITOR_KEYFRAME__ === 'function'
      && typeof w.__PRISM_EDITOR_MANIP__ === 'object' && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2800);
  const n0 = await count();
  await page.screenshot({ path: `${OUT}/e2e-01-editor.png` });

  // ── 1. SELECT + INSPECT + edit full schema live ─────────────────────────────
  const A = await newCube();
  const w0 = (await inspector()).params.width;
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await dragFader('insp:width', 'right');
  const w1 = (await inspector()).params.width;
  ok('inspect-edit-schema-live', !!A && w1 > w0 + 0.1, `width ${w0?.toFixed(2)}→${w1?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/e2e-02-inspector-edit.png` });

  // ── 2. MOVE / ROTATE / SCALE via gizmo ──────────────────────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('move'));
  await page.waitForTimeout(500);
  let g = await gizmo(); const mx0 = (await meta(A)).scenePosition.x;
  if (g.center) await dragWorld(g.handle, [g.center[0] + g.unit * 2.0, g.center[1] + g.unit * 0.8, g.center[2]]);
  const mx1 = (await meta(A)).scenePosition.x;
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('rotate'));
  await page.waitForTimeout(400); g = await gizmo(); const rz0 = (await meta(A)).scenePosition.rotationZ;
  if (g.center) await dragWorld([g.center[0] + g.unit, g.center[1], g.center[2]], [g.center[0] + g.unit * Math.cos(1.1), g.center[1] + g.unit * Math.sin(1.1), g.center[2]]);
  const rz1 = (await meta(A)).scenePosition.rotationZ;
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('scale'));
  await page.waitForTimeout(400); g = await gizmo(); const sc0 = (await meta(A)).scenePosition.scaleX;
  if (g.center) await dragWorld(g.handle, [g.handle[0] + (g.handle[0] - g.center[0]) * 1.3, g.handle[1] + (g.handle[1] - g.center[1]) * 1.3, g.handle[2]]);
  const sc1 = (await meta(A)).scenePosition.scaleX;
  ok('gizmo-move-rotate-scale', Math.abs(mx1 - mx0) > 0.1 && Math.abs(rz1 - rz0) > 0.1 && sc1 > sc0 + 0.1, `Δx=${(mx1 - mx0).toFixed(2)} Δrz=${(rz1 - rz0).toFixed(2)} scale ${sc0.toFixed(2)}→${sc1.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/e2e-03-gizmo.png` });

  // ── 3. STACK (move-together) ────────────────────────────────────────────────
  const B = await newCube();
  await page.evaluate(([c, p]) => window.__PRISM_EDITOR_MANIP__.stack(c, p), [B, A]);
  const bParent = (await meta(B)).parentNodeId === A;
  ok('stack', bParent, `B.parent=${bParent}`);

  // ── 4. CONNECT (edge → connector) ───────────────────────────────────────────
  const conn0 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.connect(a, b), [A, B]);
  await page.waitForTimeout(700);
  const conn1 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  ok('connect', conn1 > conn0, `connectors ${conn0}→${conn1}`);
  await page.screenshot({ path: `${OUT}/e2e-04-stack-connect.png` });

  // ── 5. GROUP + SAVE-AS-TEMPLATE ─────────────────────────────────────────────
  const gid = await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.group([a, b]), [A, B]);
  const nBefore = await count();
  const newIds = await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.save([a, b]), [A, B]);
  await page.waitForTimeout(1100);
  const nAfter = await count();
  ok('group-save-template', !!gid && newIds.length === 2 && nAfter === nBefore + 2, `group=${!!gid} template +${nAfter - nBefore}`);
  await page.screenshot({ path: `${OUT}/e2e-05-group-save.png` });

  // ── 6. KEYFRAME the selection + scrub (node animates) ───────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(250);
  await dragFader('kf:posY', 'right');
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(250);
  await dragFader('kf:posY', 'left');
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(350); const a0 = await kf();
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(350); const a25 = await kf();
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(1.25));
  await page.waitForTimeout(350);
  const animated = a0.groupY != null && a25.groupY != null && Math.abs(a0.groupY - a25.groupY) > 0.3;
  ok('keyframe-scrub-animates', a25.keyframeCount >= 2 && animated, `kfs=${a25.keyframeCount} groupY Δ=${a0.groupY != null && a25.groupY != null ? Math.abs(a0.groupY - a25.groupY).toFixed(2) : 'n/a'}`);
  await page.screenshot({ path: `${OUT}/e2e-06-keyframe.png` });

  // ── authorship + galaxy + console ───────────────────────────────────────────
  const authC = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
  await page.waitForTimeout(1600);
  const authG = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('authorship-canvas-galaxy', authC.ok && authG.ok, `canvas orphans=${authC.orphans.length} rendered=${authC.renderedCount}; galaxy orphans=${authG.orphans.length} rendered=${authG.renderedCount}`);
  await page.screenshot({ path: `${OUT}/e2e-07-galaxy.png` });
  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  Object.assign(metrics, {
    nodesStart: n0, nodesEnd: await count(), widthEdit: [w0, w1], gizmo: { dx: mx1 - mx0, drz: rz1 - rz0, scale: [sc0, sc1] },
    stack: bParent, connectors: [conn0, conn1], template: newIds.length, keyframes: a25.keyframeCount,
    keyframeGroupYDelta: a0.groupY != null && a25.groupY != null ? Math.abs(a0.groupY - a25.groupY) : null,
    canvasOrphans: authC.orphans.length, canvasRendered: authC.renderedCount, galaxyOrphans: authG.orphans.length, galaxyRendered: authG.renderedCount,
    consoleErrors: consoleErrors.length, backend: await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.()),
  });
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  metrics.checks = `${pass}/${results.length}`;
  metrics.results = results;
  writeFileSync(`${OUT}/behavioral-metrics-i3.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== EDIT-I3 e2e: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
