// HEADLESS end-to-end behavioral verification — WS-W1 (the blocking pass).
// Drives /editor like a user: select a node -> the glass NODE EDITOR opens ->
// edit the CAPTION with a REAL trusted pointer-click + REAL keyboard typing
// (near-human, not just probes) -> edit behavior/schema -> confirm canvas SYNC
// (both ways) -> SAVE -> reload -> the edits survive EXACTLY. Also confirms the
// node editor is purpose-only (NO visual faders on the NODE tab; C2) and the
// NODE/VISUAL tab switch. Offscreen (headless). Frames -> notes/verification/ws-w1/.
// NOTE: writes live-graph.json; caller restores via git.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w1';
mkdirSync(OUT, { recursive: true });

const results = [];
const metrics = {};
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const purpose = () => page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.purpose());
const fields = () => page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.fields());
const label = () => page.evaluate(() => window.__PRISM_EDITOR_CAPTION_LABEL__?.());

async function waitReady() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_NODE_EDITOR__ === 'object'
    && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && typeof window.__PRISM_EDITOR_SHELL_CAM__ === 'object'
    && typeof window.__PRISM_EDITOR_SHELL_STORE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0,
    { timeout: 90000 });
}

// project a world point to screen px via the editor camera rig.
const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);
  metrics.backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.());
  await page.screenshot({ path: `${OUT}/e2e-01-editor.png` });

  // ── 1. select a node → the node editor opens with the purpose surface ───────
  const A = await page.evaluate(() => {
    const s = window.__PRISM_EDITOR_SHELL_STORE__();
    const id = s.activeHubNodeIds[0] || s.allNodeIds[0];
    window.__PRISM_EDITOR_SELECT__(id);
    return id;
  });
  await page.waitForTimeout(1000);
  const fs = await fields();
  const ids = fs.map((f) => f.id).sort();
  const expected = ['ne:caption', 'ne:effect', 'ne:emits', 'ne:event', 'ne:inputs', 'ne:listens', 'ne:outputs'].sort();
  ok('select-opens-purpose-surface', JSON.stringify(ids) === JSON.stringify(expected), `${fs.length} purpose fields`);
  await page.screenshot({ path: `${OUT}/e2e-02-node-editor.png` });

  // C2 — the NODE tab is purpose-only: every field is a purpose field (ne:*),
  // and no transform/geometry/material faders are present on this tab.
  const allPurpose = fs.every((f) => f.id.startsWith('ne:'));
  const faderCountOnNodeTab = await page.evaluate(() =>
    (window.__PRISM_EDITOR_FADER_LIST__ ? window.__PRISM_EDITOR_FADER_LIST__() : []).length);
  ok('node-editor-is-purpose-only', allPurpose && faderCountOnNodeTab === 0,
    `purpose-only=${allPurpose}, visual-faders-on-node-tab=${faderCountOnNodeTab}`);

  // ── 2. NEAR-HUMAN: real trusted pointer-click to focus CAPTION, real typing ──
  const capField = fs.find((f) => f.id === 'ne:caption');
  let [px, py] = await project(capField.world);
  // if the field projects off-screen (dock at the frame edge), frame the dock.
  if (px < 40 || px > 1640 || py < 40 || py > 960) {
    await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(8.5, -0.1, 13, 8.5, -0.1, 1));
    await page.waitForTimeout(700);
    const cf = (await fields()).find((f) => f.id === 'ne:caption');
    [px, py] = await project(cf.world);
  }
  const capBefore = (await purpose()).caption;
  await page.mouse.click(px, py); // TRUSTED pointer event → R3F onClick → focus
  await page.waitForTimeout(300);
  const focusedId = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.focusedId());
  ok('trusted-click-focuses-field', focusedId === 'ne:caption', `focusedId=${focusedId} @(${Math.round(px)},${Math.round(py)})`);
  const SENTINEL = ' USEREDIT'; // ASCII only (Playwright trusted keyboard = US layout)
  await page.keyboard.type(SENTINEL, { delay: 25 }); // TRUSTED keydown events
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const capAfter = (await purpose()).caption;
  ok('trusted-keyboard-edits-caption', capAfter === capBefore + SENTINEL && capAfter !== capBefore,
    `"${capBefore}" -> "${capAfter}"`);
  await page.screenshot({ path: `${OUT}/e2e-03-trusted-edit.png` });

  // ── 3. structured behavior + schema edits (probe path) ──────────────────────
  await page.evaluate(() => {
    const ne = window.__PRISM_EDITOR_NODE_EDITOR__;
    ne.setField('ne:event', 'click');
    ne.setField('ne:effect', 'open detail overlay');
    ne.setField('ne:emits', 'click,submit');
    ne.setField('ne:inputs', 'email:string, attempts:number');
    ne.setField('ne:outputs', 'ok:boolean');
  });
  await page.waitForTimeout(400);
  const pEdit = await purpose();
  const behaviorOk = pEdit.event === 'click' && pEdit.effect === 'open detail overlay'
    && JSON.stringify(pEdit.emits) === JSON.stringify(['click', 'submit']);
  const schemaOk = pEdit.inputs.email === 'string' && pEdit.inputs.attempts === 'number' && pEdit.outputs.ok === 'boolean';
  ok('edit-behavior-schema', behaviorOk && schemaOk, `behavior=${behaviorOk} schema=${schemaOk}`);

  // ── 4. SYNC both ways ───────────────────────────────────────────────────────
  await page.waitForTimeout(300);
  const lab = await label();
  ok('sync-node-editor-to-canvas', lab?.caption === capAfter && lab?.visible === true, `label="${lab?.caption}" vis=${lab?.visible}`);
  await page.evaluate((id) => window.__PRISM_EDITOR_NODE_EDITOR__.extSetCaption(id, 'WS-W1 RT FINAL'), A);
  await page.waitForTimeout(400);
  const pExt = await purpose();
  const labExt = await label();
  ok('sync-canvas-to-node-editor', pExt.caption === 'WS-W1 RT FINAL' && labExt?.caption === 'WS-W1 RT FINAL',
    `nodeEditor="${pExt.caption}" label="${labExt?.caption}"`);

  // ── 5. tab switch NODE <-> VISUAL ───────────────────────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.setTab('visual'));
  await page.waitForTimeout(700);
  const visualUp = await page.evaluate(() => typeof window.__PRISM_EDITOR_INSPECTOR__ === 'function' && window.__PRISM_EDITOR_INSPECTOR__().nodeId != null);
  await page.screenshot({ path: `${OUT}/e2e-04-visual-tab.png` });
  await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.setTab('node'));
  await page.waitForTimeout(500);
  const backNode = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.tab());
  ok('tab-switch-node-visual', visualUp && backNode === 'node', `visual-inspector=${visualUp} back=${backNode}`);

  // ── 6. SAVE → reload → round-trip EXACT ─────────────────────────────────────
  const saveRes = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(500);
  ok('save-ok', saveRes.ok === true, `save.ok=${saveRes.ok}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.waitForTimeout(800);
  const pRe = await purpose();
  const rt = pRe.caption === 'WS-W1 RT FINAL'
    && pRe.event === 'click' && pRe.effect === 'open detail overlay'
    && JSON.stringify(pRe.emits) === JSON.stringify(['click', 'submit'])
    && pRe.inputs.email === 'string' && pRe.inputs.attempts === 'number' && pRe.outputs.ok === 'boolean';
  ok('reload-round-trip-exact', rt, `caption="${pRe.caption}" emits=${JSON.stringify(pRe.emits)} inputs=${JSON.stringify(pRe.inputs)}`);
  await page.screenshot({ path: `${OUT}/e2e-05-reloaded.png` });

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
  Object.assign(metrics, { nodeId: A, capBefore, capAfter, pEdit, pExt, pRe, consoleErrors: consoleErrors.length });
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  metrics.checks = `${pass}/${results.length}`;
  metrics.results = results;
  writeFileSync(`${OUT}/e2e-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== WS-W1 e2e: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
