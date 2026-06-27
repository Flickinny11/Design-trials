// HEADLESS behavioral verification — EDIT-I3 w-manip.
// Proves canvas MANIPULATION on the live app graph:
//  • TRUSTED gizmo drags MOVE / ROTATE / SCALE the selected node;
//  • SNAP rounds a move to the grid;
//  • STACK makes a child follow its parent (move-together, computed root);
//  • CONNECT adds a real edge that renders a 3D glass-tube connector;
//  • GROUP stamps a shared groupId; SAVE-AS-TEMPLATE re-instantiates a fresh subgraph;
//  • authorship stays 0-orphans; 0 console errors.
// Offscreen (headless). Frames → notes/verification/edit-i3/.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'notes/verification/edit-i3';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);
const inspector = () => page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__());
const gizmo = () => page.evaluate(() => window.__PRISM_EDITOR_GIZMO__());
const meta = (id) => page.evaluate((i) => window.__PRISM_EDITOR_MANIP__.nodeMeta(i), id);
const nodeCount = () => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
const selWorld = (id) => page.evaluate((i) => {
  const a = window.__PRISM_EDITOR_SELECTABLE_POS__();
  const e = a.find((p) => p.nodeId === i);
  return e ? e.world : null;
}, id);

async function dragWorld(fromWorld, toWorld, steps = 7) {
  const a = await project(fromWorld);
  const b = await project(toWorld);
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(a[0] + (b[0] - a[0]) * (i / steps), a[1] + (b[1] - a[1]) * (i / steps));
    await page.waitForTimeout(35);
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
}

async function newCube() {
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(1000);
  return (await inspector()).nodeId;
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_GIZMO__ === 'function'
      && typeof w.__PRISM_EDITOR_MANIP__ === 'object'
      && typeof w.__PRISM_EDITOR_CONNECTOR_COUNT__ === 'function'
      && typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
      && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2600);

  const A = await newCube();
  const B = await newCube();
  ok('two-cubes-created', !!A && !!B && A !== B, `A=${A?.slice(0, 8)} B=${B?.slice(0, 8)}`);

  // ── GIZMO MOVE (trusted) ────────────────────────────────────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('move'));
  await page.waitForTimeout(700);
  const mx0 = (await meta(A)).scenePosition?.x ?? 0;
  let gz = await gizmo();
  if (gz.center) {
    await dragWorld(gz.handle, [gz.center[0] + gz.unit * 2.2, gz.center[1], gz.center[2]]);
  }
  const mx1 = (await meta(A)).scenePosition?.x ?? 0;
  ok('gizmo-move', Math.abs(mx1 - mx0) > 0.2, `x ${mx0.toFixed(2)} → ${mx1.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/manip-01-moved.png` });

  // ── SNAP (grid) — a far point rounds to the 0.5 grid via the real helper ────
  const snapRes = await page.evaluate(() => window.__PRISM_EDITOR_MANIP__.snapTest(13.37, -11.13));
  ok('snap-on-grid', Math.abs(snapRes.x - 13.5) < 0.01 && Math.abs(snapRes.y + 11.0) < 0.01, `snap(13.37,-11.13) → (${snapRes.x},${snapRes.y})`);

  // ── GIZMO ROTATE (trusted) ──────────────────────────────────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('rotate'));
  await page.waitForTimeout(500);
  const rz0 = (await meta(A)).scenePosition?.rotationZ ?? 0;
  gz = await gizmo();
  if (gz.center) {
    const c = gz.center, u = gz.unit;
    await dragWorld([c[0] + u, c[1], c[2]], [c[0] + u * Math.cos(1.2), c[1] + u * Math.sin(1.2), c[2]]);
  }
  const rz1 = (await meta(A)).scenePosition?.rotationZ ?? 0;
  ok('gizmo-rotate', Math.abs(rz1 - rz0) > 0.1, `rotZ ${rz0.toFixed(2)} → ${rz1.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/manip-02-rotated.png` });

  // ── GIZMO SCALE (trusted) ───────────────────────────────────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('scale'));
  await page.waitForTimeout(500);
  const sc0 = (await meta(A)).scenePosition?.scaleX ?? 1;
  gz = await gizmo();
  if (gz.center) {
    const c = gz.center, h = gz.handle;
    const dx = h[0] - c[0], dy = h[1] - c[1];
    await dragWorld(h, [h[0] + dx * 1.4, h[1] + dy * 1.4, h[2]]);
  }
  const sc1 = (await meta(A)).scenePosition?.scaleX ?? 1;
  ok('gizmo-scale', sc1 > sc0 + 0.1, `scaleX ${sc0.toFixed(2)} → ${sc1.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/manip-03-scaled.png` });

  // ── STACK: child follows parent (move-together) ─────────────────────────────
  const stacked = await page.evaluate(([c, p]) => window.__PRISM_EDITOR_MANIP__.stack(c, p), [B, A]);
  await page.waitForTimeout(500);
  const bMeta = await meta(B);
  const bWorld0 = await selWorld(B);
  await page.evaluate((id) => {
    const cur = window.__PRISM_EDITOR_MANIP__.nodeMeta(id).scenePosition;
    window.__PRISM_EDITOR_MANIP__.setScenePos(id, { x: (cur?.x ?? 0) + 1.5 });
  }, A);
  await page.waitForTimeout(700);
  const bWorld1 = await selWorld(B);
  const moved = bWorld0 && bWorld1 ? Math.hypot(bWorld1[0] - bWorld0[0], bWorld1[1] - bWorld0[1]) : 0;
  ok('stack-move-together', stacked === true && bMeta.parentNodeId === A && moved > 0.05,
    `B.parent=${bMeta.parentNodeId === A} childMovedWith parent Δ=${moved.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/manip-04-stacked.png` });

  // ── CONNECT: edge → 3D glass-tube connector ─────────────────────────────────
  const conn0 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  const connOk = await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.connect(a, b), [A, B]);
  await page.waitForTimeout(900);
  const conn1 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  ok('connect-edge-connector', connOk === true && conn1 > conn0, `connectors ${conn0} → ${conn1}`);
  await page.screenshot({ path: `${OUT}/manip-05-connected.png` });

  // ── GROUP ───────────────────────────────────────────────────────────────────
  const gid = await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.group([a, b]), [A, B]);
  await page.waitForTimeout(400);
  const aGid = (await meta(A)).groupId;
  ok('group', !!gid && aGid === gid, `groupId=${gid} A.groupId=${aGid}`);

  // ── SAVE-AS-TEMPLATE: fresh registered subgraph ─────────────────────────────
  const n0 = await nodeCount();
  const newIds = await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.save([a, b]), [A, B]);
  await page.waitForTimeout(1200);
  const n1 = await nodeCount();
  const newMeta = newIds[0] ? await meta(newIds[0]) : null;
  ok('save-as-template', Array.isArray(newIds) && newIds.length === 2 && n1 === n0 + 2 && !!newMeta?.groupId,
    `${n0} → ${n1} nodes, new ids ${newIds.length}, fresh group ${newMeta?.groupId}`);
  await page.screenshot({ path: `${OUT}/manip-06-template.png` });

  // ── gizmo stays + is visible after a drag (deselect-guard) ──────────────────
  const C = await newCube();
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), C);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('move'));
  await page.waitForTimeout(700);
  let gzc = await gizmo();
  if (gzc.center) await dragWorld(gzc.handle, [gzc.center[0] + gzc.unit * 1.6, gzc.center[1] + gzc.unit * 0.6, gzc.center[2]]);
  const stillSel = await page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__().nodeId);
  ok('gizmo-persists-after-drag', stillSel === C, `selection after drag-release = ${stillSel === C ? 'kept' : stillSel}`);
  // re-affirm + screenshot a gizmo-visible state
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), C);
  await page.evaluate(() => window.__PRISM_EDITOR_SET_GIZMO_MODE__('move'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/manip-07-gizmo-visible.png` });

  // ── authorship + console ────────────────────────────────────────────────────
  const auth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('canvas-authorship-ok', auth.ok === true, `orphans=${auth.orphans.length} unrealized=${auth.unrealizedActiveHub.length} rendered=${auth.renderedCount}`);
  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== EDIT-I3 manip: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
