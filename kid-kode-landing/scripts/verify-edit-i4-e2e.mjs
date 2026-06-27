// HEADLESS end-to-end behavioral verification — EDIT-I4 (THE BIG PASS).
// ONE continuous session: BUILD A SMALL APP in /editor — add via TOOLBAR, DRAG
// from the LIBRARY, EDIT in the INSPECTOR, STACK + CONNECT, KEYFRAME one, assign
// HEADER + FOOTER global slots, switch to PREVIEW (the app renders/runs), SAVE →
// RELOAD → confirm the app persists EXACTLY. Captures frames + metrics. Offscreen.
// Writes live-graph.json (caller git-checkouts it after). Frames → notes/verification/edit-i4/.

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

const inspector = () => page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__());
const count = () => page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length);
const snapshot = () => page.evaluate(() => window.__PRISM_EDITOR_GRAPH_SNAPSHOT__());
const faders = () => page.evaluate(() => window.__PRISM_EDITOR_FADER_LIST__());
const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);
const slotOf = async (id) => { const s = await snapshot(); const l = s.nodes.find((x) => x.startsWith(id + '§')); return l ? l.split('§')[4] : ''; };

async function newCube() {
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(900);
  return (await inspector()).nodeId;
}
async function waitFader(id, ms = 9000) {
  try { await page.waitForFunction((fid) => (window.__PRISM_EDITOR_FADER_LIST__?.() ?? []).some((f) => f.id === fid), id, { timeout: ms }); return true; } catch { return false; }
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
    return typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function' && typeof w.__PRISM_EDITOR_LIBRARY_DROP__ === 'function'
      && typeof w.__PRISM_EDITOR_MANIP__ === 'object' && typeof w.__PRISM_EDITOR_KEYFRAME__ === 'function'
      && typeof w.__PRISM_EDITOR_SET_SLOT__ === 'function' && typeof w.__PRISM_EDITOR_SAVE__ === 'function'
      && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function' && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2600);
  const n0 = await count();
  await page.screenshot({ path: `${OUT}/e2e-01-editor.png` });

  // ── 1. TOOLBAR: add a node ──────────────────────────────────────────────────
  const A = await newCube();
  const nAfterAdd = await count();
  ok('toolbar-add', !!A && nAfterAdd === n0 + 1, `add cube ${A?.slice(0, 8)} ${n0}→${nAfterAdd}`);

  // ── 2. LIBRARY: drag-to-instantiate (the same drop sink a trusted tile-drag
  //      reaches — proven trusted in I-2; here exercised functionally) ──────────
  const tiles = await page.evaluate(() => window.__PRISM_EDITOR_LIBRARY_TILES__());
  const entryId = tiles.find((t) => t.entryId === 'prim:cube')?.entryId ?? tiles[0]?.entryId ?? 'prim:cube';
  const dropped = await page.evaluate((id) => window.__PRISM_EDITOR_LIBRARY_DROP__(id), entryId);
  await page.waitForTimeout(700);
  const nAfterLib = await count();
  const B = Array.isArray(dropped) ? dropped[0] : null;
  ok('library-drag-instantiate', !!B && nAfterLib > nAfterAdd, `dropped "${entryId}" +${nAfterLib - nAfterAdd} (B=${B?.slice(0, 8)})`);
  await page.screenshot({ path: `${OUT}/e2e-02-add-library.png` });

  // ── 3. INSPECTOR: edit full schema live ─────────────────────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  const w0 = (await inspector()).params?.width;
  await dragFader('insp:width', 'right');
  const w1 = (await inspector()).params?.width;
  ok('inspector-edit-live', w1 > w0 + 0.1, `width ${w0?.toFixed(2)}→${w1?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/e2e-03-inspector.png` });

  // ── 4. STACK + CONNECT ──────────────────────────────────────────────────────
  await page.evaluate(([c, p]) => window.__PRISM_EDITOR_MANIP__.stack(c, p), [B, A]);
  const bParent = (await page.evaluate((id) => window.__PRISM_EDITOR_MANIP__.nodeMeta(id), B)).parentNodeId === A;
  const conn0 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  await page.evaluate(([a, b]) => window.__PRISM_EDITOR_MANIP__.connect(a, b), [A, B]);
  await page.waitForTimeout(700);
  const conn1 = await page.evaluate(() => window.__PRISM_EDITOR_CONNECTOR_COUNT__());
  ok('stack-connect', bParent && conn1 > conn0, `stack B.parent=${bParent}; connectors ${conn0}→${conn1}`);
  await page.screenshot({ path: `${OUT}/e2e-04-stack-connect.png` });

  // ── 5. KEYFRAME the selection + scrub (node animates) ───────────────────────
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(250);
  await dragFader('kf:posY', 'right');
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(250);
  await dragFader('kf:posY', 'left');
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(0));
  await page.waitForTimeout(350); const a0 = await page.evaluate(() => window.__PRISM_EDITOR_KEYFRAME__());
  await page.evaluate(() => window.__PRISM_EDITOR_KF_SET_PLAYHEAD__(2.5));
  await page.waitForTimeout(350); const a25 = await page.evaluate(() => window.__PRISM_EDITOR_KEYFRAME__());
  const animated = a0.groupY != null && a25.groupY != null && Math.abs(a0.groupY - a25.groupY) > 0.3;
  ok('keyframe-animates', a25.keyframeCount >= 2 && animated, `kfs=${a25.keyframeCount} groupYΔ=${a0.groupY != null && a25.groupY != null ? Math.abs(a0.groupY - a25.groupY).toFixed(2) : 'n/a'}`);
  await page.screenshot({ path: `${OUT}/e2e-05-keyframe.png` });

  // ── 6. HEADER + FOOTER global slots ─────────────────────────────────────────
  const H = await newCube();
  await page.evaluate((id) => window.__PRISM_EDITOR_SET_SLOT__(id, 'header'), H);
  const F = await newCube();
  await page.evaluate((id) => window.__PRISM_EDITOR_SET_SLOT__(id, 'footer'), F);
  await page.waitForTimeout(300);
  ok('header-footer-slots', (await slotOf(H)) === 'header' && (await slotOf(F)) === 'footer', `H=header F=footer`);

  // ── 7. PREVIEW: the app renders / runs ──────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('preview-app'));
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_PREVIEW__ === 'function', { timeout: 30000 });
  await page.waitForTimeout(5000);
  const pv = await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW__());
  const hPos = await page.evaluate((id) => window.__PRISM_EDITOR_PREVIEW_NODE_POS__(id), H);
  const fPos = await page.evaluate((id) => window.__PRISM_EDITOR_PREVIEW_NODE_POS__(id), F);
  ok('preview-runs-app', pv.running && pv.headerNodeIds.includes(H) && pv.footerNodeIds.includes(F)
    && pv.contentCount > 0 && !!hPos && !!fPos && hPos[1] > fPos[1] + 1.0,
    `header=${pv.headerCount} footer=${pv.footerCount} content=${pv.contentCount}; headerY=${hPos?.[1]?.toFixed(2)} > footerY=${fPos?.[1]?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/e2e-06-preview.png` });

  // ── 8. SAVE → RELOAD → the app persists EXACTLY ─────────────────────────────
  const before = await snapshot();
  const saveRes = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_SHELL_STORE__ === 'function' && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2600);
  const after = await snapshot();
  const nodesEqual = JSON.stringify(before.nodes) === JSON.stringify(after.nodes);
  const edgesEqual = JSON.stringify(before.edges) === JSON.stringify(after.edges);
  const builtNodesPresent = [A, B, H, F].every((id) => after.nodes.some((l) => l.startsWith(id + '§')));
  ok('save-reload-persists', saveRes.ok && nodesEqual && edgesEqual && builtNodesPresent,
    `save.ok=${saveRes.ok} nodesEqual=${nodesEqual} edgesEqual=${edgesEqual} builtNodesPresent=${builtNodesPresent}`);
  await page.screenshot({ path: `${OUT}/e2e-07-reloaded.png` });

  // ── 9. header/footer slots survive the reload ───────────────────────────────
  ok('slots-survive-reload', (await slotOf(H)) === 'header' && (await slotOf(F)) === 'footer',
    `after reload H=${await slotOf(H)} F=${await slotOf(F)}`);

  // ── 10. preview still runs the persisted app ────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('preview-app'));
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_PREVIEW__ === 'function', { timeout: 30000 });
  await page.waitForTimeout(4500);
  const pv2 = await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW__());
  const auth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('preview-after-reload', pv2.running && pv2.headerNodeIds.includes(H) && pv2.footerNodeIds.includes(F) && auth.orphans.length === 0,
    `header=${pv2.headerCount} footer=${pv2.footerCount} content=${pv2.contentCount} orphans=${auth.orphans.length}`);
  await page.screenshot({ path: `${OUT}/e2e-08-preview-after-reload.png` });

  // ── 11. authorship across views + console ───────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2200);
  const authC = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
  await page.waitForTimeout(1800);
  const authG = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('authorship-all-views', authC.ok && authG.ok, `canvas orphans=${authC.orphans.length}/${authC.renderedCount}; galaxy orphans=${authG.orphans.length}/${authG.renderedCount}`);
  await page.screenshot({ path: `${OUT}/e2e-09-galaxy.png` });
  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  Object.assign(metrics, {
    nodesStart: n0, addedToolbar: A, addedLibrary: B, header: H, footer: F,
    widthEdit: [w0, w1], stack: bParent, connectors: [conn0, conn1], keyframes: a25.keyframeCount,
    keyframeGroupYDelta: a0.groupY != null && a25.groupY != null ? Math.abs(a0.groupY - a25.groupY) : null,
    preview: { header: pv.headerCount, footer: pv.footerCount, content: pv.contentCount, headerY: hPos?.[1], footerY: fPos?.[1] },
    save: { ok: saveRes.ok, nodesEqual, edgesEqual, builtNodesPresent },
    previewAfterReload: { header: pv2.headerCount, footer: pv2.footerCount, content: pv2.contentCount },
    canvasOrphans: authC.orphans.length, canvasRendered: authC.renderedCount, galaxyOrphans: authG.orphans.length, galaxyRendered: authG.renderedCount,
    consoleErrors: consoleErrors.length, backend: await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.()),
  });
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  metrics.checks = `${pass}/${results.length}`;
  metrics.results = results;
  writeFileSync(`${OUT}/behavioral-metrics-i4.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== EDIT-I4 e2e: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
