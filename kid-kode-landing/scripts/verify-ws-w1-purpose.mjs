// HEADLESS behavioral verification — WS-W1 w-purpose.
// Proves the node editor's purpose edits are LIVE + SYNCED to the shared store
// (both directions, INV-W8) and ROUND-TRIP through save/reload (C4). Offscreen
// (headless). Frames → notes/verification/ws-w1/.
// NOTE: writes public/prism-mock/home/live-graph.json; caller restores via git.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w1';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const purpose = () => page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.purpose());
const label = () => page.evaluate(() => window.__PRISM_EDITOR_CAPTION_LABEL__?.());

async function waitReady() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_NODE_EDITOR__ === 'object'
    && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && typeof window.__PRISM_EDITOR_SHELL_STORE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0,
    { timeout: 90000 });
}

const NEW_CAPTION = 'WS-W1 SYNC PROOF';
const NEW_EMITS = 'click,submit,hover';
const NEW_INPUTS = 'email:string, attempts:number';
const EXT_CAPTION = 'WS-W1 EXTERNAL EDIT';

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);

  // select a realized active-hub node (so the in-canvas label can track it).
  const A = await page.evaluate(() => {
    const s = window.__PRISM_EDITOR_SHELL_STORE__();
    const id = s.activeHubNodeIds[0] || s.allNodeIds[0];
    window.__PRISM_EDITOR_SELECT__(id);
    return id;
  });
  await page.waitForTimeout(1200);

  // ── 1. LIVE edits to caption / behavior / schema land on the shared store ───
  await page.evaluate(([cap, em, inp]) => {
    const ne = window.__PRISM_EDITOR_NODE_EDITOR__;
    ne.setField('ne:caption', cap);
    ne.setField('ne:emits', em);
    ne.setField('ne:inputs', inp);
  }, [NEW_CAPTION, NEW_EMITS, NEW_INPUTS]);
  await page.waitForTimeout(500);
  const pEdit = await purpose();
  ok('live-caption-edit', pEdit.caption === NEW_CAPTION, `caption="${pEdit.caption}"`);
  ok('live-behavior-edit', JSON.stringify(pEdit.emits) === JSON.stringify(['click', 'submit', 'hover']), `emits=${JSON.stringify(pEdit.emits)}`);
  ok('live-schema-edit', pEdit.inputs.email === 'string' && pEdit.inputs.attempts === 'number', `inputs=${JSON.stringify(pEdit.inputs)}`);
  await page.screenshot({ path: `${OUT}/purpose-01-edited.png` });

  // ── 2. SYNC: the in-canvas caption label reflects the node-editor edit ──────
  await page.waitForTimeout(400);
  const lab = await label();
  ok('sync-node-editor-to-canvas', !!lab && lab.caption === NEW_CAPTION && lab.visible === true,
    `label.caption="${lab?.caption}" visible=${lab?.visible}`);

  // ── 3. VICE-VERSA: an external store edit shows in the node editor + label ──
  await page.evaluate(([id, cap]) => window.__PRISM_EDITOR_NODE_EDITOR__.extSetCaption(id, cap), [A, EXT_CAPTION]);
  await page.waitForTimeout(500);
  const pExt = await purpose();
  const labExt = await label();
  ok('sync-canvas-to-node-editor', pExt.caption === EXT_CAPTION && labExt?.caption === EXT_CAPTION,
    `nodeEditor="${pExt.caption}" label="${labExt?.caption}"`);
  await page.screenshot({ path: `${OUT}/purpose-02-vice-versa.png` });

  // restore the caption to the round-trip value for the persist test
  await page.evaluate(([cap]) => window.__PRISM_EDITOR_NODE_EDITOR__.setField('ne:caption', cap), [NEW_CAPTION]);
  await page.waitForTimeout(300);

  // ── 4. SAVE flushes dirty ───────────────────────────────────────────────────
  const pDirty = await page.evaluate(() => window.__PRISM_EDITOR_PERSIST__());
  const saveRes = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(500);
  const pSaved = await page.evaluate(() => window.__PRISM_EDITOR_PERSIST__());
  ok('save-flushes-dirty', pDirty.isDirty === true && saveRes.ok === true && pSaved.isDirty === false,
    `dirty ${pDirty.isDirty}->${pSaved.isDirty}, save.ok=${saveRes.ok}`);

  // ── 5. RELOAD → the purpose edits survive EXACTLY (C4) ──────────────────────
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.waitForTimeout(800);
  const pReload = await purpose();
  const capOk = pReload.caption === NEW_CAPTION;
  const emitsOk = JSON.stringify(pReload.emits) === JSON.stringify(['click', 'submit', 'hover']);
  const inputsOk = pReload.inputs.email === 'string' && pReload.inputs.attempts === 'number';
  ok('reload-round-trip', capOk && emitsOk && inputsOk,
    `caption=${capOk} emits=${emitsOk} inputs=${inputsOk}`);
  await page.screenshot({ path: `${OUT}/purpose-03-reloaded.png` });

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  writeFileSync(`${OUT}/purpose-metrics.json`, JSON.stringify({
    nodeId: A, pEdit, lab, pExt, labExt, pReload, consoleErrors: consoleErrors.length, results,
  }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W1 purpose: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
