// HEADLESS behavioral verification — EDIT-I3 w-inspector.
// Proves the DOCKED Inspector edits the SELECTED node's FULL schema, LIVE, on the
// real app graph:
//  • a created cube is auto-selected and the Inspector shows its schema;
//  • a TRUSTED canvas click selects a node (click-to-select);
//  • TRUSTED fader drags edit geometry (width), transform (scale) and material
//    (roughness) and the node schema updates live;
//  • a TRUSTED swatch click recolors the node (materialSpec.baseColor);
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
const faders = () => page.evaluate(() => window.__PRISM_EDITOR_FADER_LIST__());

async function dragFader(id, dir = 'right') {
  const list = await faders();
  const f = list.find((x) => x.id === id);
  if (!f) return { ok: false, reason: 'no-fader-' + id };
  const start = await project(f.knob);
  const target = await project(dir === 'right' ? f.right : f.left);
  await page.mouse.move(start[0], start[1]);
  await page.mouse.down();
  // ease toward target so the window pointermove handler tracks it
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(start[0] + (target[0] - start[0]) * (i / 6), start[1] + (target[1] - start[1]) * (i / 6));
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  return { ok: true, start, target };
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0
      && typeof w.__PRISM_EDITOR_INSPECTOR__ === 'function'
      && typeof w.__PRISM_EDITOR_FADER_LIST__ === 'function'
      && typeof w.__PRISM_EDITOR_TOOLBAR_FN__ === 'function';
  }, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2600);

  const backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.());
  ok('renderer-backend', !!backend, JSON.stringify(backend));

  // ── create a cube (auto-selected) → Inspector shows its schema ──────────────
  const addStatus = await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(1400);
  const insp0 = await inspector();
  const cubeId = insp0.nodeId;
  ok('inspector-shows-schema', !!cubeId && insp0.kind === 'cube' && !!insp0.params && typeof insp0.params.width === 'number',
    `id=${cubeId} kind=${insp0.kind} params=${JSON.stringify(insp0.params)} (${addStatus})`);
  await page.screenshot({ path: `${OUT}/insp-01-selected-cube.png` });

  // ── the inspector exposes per-type faders ───────────────────────────────────
  const fl = await faders();
  const ids = fl.map((f) => f.id);
  const wantd = ['insp:width', 'insp:height', 'insp:depth', 'insp:roughness', 'insp:metalness', 'insp:scale', 'insp:opacity'];
  ok('faders-present', wantd.every((w) => ids.includes(w)), `${ids.length} faders: ${ids.join(',')}`);

  // ── TRUSTED canvas click selects a node ─────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SELECT__(null));
  await page.waitForTimeout(400);
  const sel = await page.evaluate((id) => {
    const arr = window.__PRISM_EDITOR_SELECTABLE_POS__();
    return arr.find((p) => p.nodeId === id) ?? arr[0] ?? null;
  }, cubeId);
  if (sel) {
    const css = await project(sel.world);
    await page.mouse.move(css[0], css[1]);
    await page.waitForTimeout(120);
    await page.mouse.click(css[0], css[1]);
    await page.waitForTimeout(700);
  }
  const inspAfterClick = await inspector();
  ok('trusted-click-selects', !!inspAfterClick.nodeId,
    `clicked node → selected ${inspAfterClick.nodeId} (target ${sel?.nodeId})`);
  await page.screenshot({ path: `${OUT}/insp-02-trusted-click-select.png` });

  // re-select the cube deterministically for the edit chain
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), cubeId);
  await page.waitForTimeout(700);

  // ── TRUSTED fader: edit GEOMETRY width → live rebuild ───────────────────────
  const w0 = (await inspector()).params.width;
  await dragFader('insp:width', 'right');
  const w1 = (await inspector()).params.width;
  ok('edit-geometry-width-live', w1 > w0 + 0.05, `width ${w0?.toFixed(2)} → ${w1?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/insp-03-width-widened.png` });

  // ── TRUSTED fader: edit TRANSFORM scale (live, no rebuild) ──────────────────
  const s0 = (await inspector()).scenePosition?.scaleX ?? 1;
  await dragFader('insp:scale', 'right');
  const s1 = (await inspector()).scenePosition?.scaleX ?? 1;
  ok('edit-transform-scale-live', s1 > s0 + 0.05, `scaleX ${s0?.toFixed(2)} → ${s1?.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/insp-04-scaled.png` });

  // ── TRUSTED fader: edit MATERIAL roughness ──────────────────────────────────
  const r0 = (await inspector()).materialSpec?.roughness ?? 0;
  await dragFader('insp:roughness', 'right');
  const r1 = (await inspector()).materialSpec?.roughness ?? 0;
  ok('edit-material-roughness', Math.abs(r1 - r0) > 0.05, `roughness ${r0?.toFixed(2)} → ${r1?.toFixed(2)}`);

  // ── TRUSTED swatch click: recolor (materialSpec.baseColor) ──────────────────
  const swatches = await page.evaluate(() => window.__PRISM_EDITOR_SWATCH_LIST__());
  const cur = ((await inspector()).materialSpec?.baseColor ?? '').toLowerCase();
  const target = swatches.find((s) => s.color.toLowerCase() !== cur) ?? swatches[0];
  let colorOk = false;
  if (target) {
    const css = await project(target.world);
    await page.mouse.move(css[0], css[1]);
    await page.waitForTimeout(100);
    await page.mouse.click(css[0], css[1]);
    await page.waitForTimeout(600);
    const c1 = ((await inspector()).materialSpec?.baseColor ?? '').toLowerCase();
    colorOk = c1 === target.color.toLowerCase();
  }
  ok('edit-material-color-swatch', colorOk, `${swatches.length} swatches → baseColor now ${(await inspector()).materialSpec?.baseColor}`);
  await page.screenshot({ path: `${OUT}/insp-05-recolored.png` });

  // ── authorship still clean after all the edits ──────────────────────────────
  const auth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('canvas-authorship-ok', auth.ok === true, `orphans=${auth.orphans.length} unrealized=${auth.unrealizedActiveHub.length} rendered=${auth.renderedCount}`);

  // deselect → inspector clears
  await page.evaluate(() => window.__PRISM_EDITOR_SELECT__(null));
  await page.waitForTimeout(500);
  const inspNull = await inspector();
  ok('deselect-clears-inspector', !inspNull.nodeId, `nodeId=${inspNull.nodeId}`);
  await page.screenshot({ path: `${OUT}/insp-06-deselected.png` });

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== EDIT-I3 inspector: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
