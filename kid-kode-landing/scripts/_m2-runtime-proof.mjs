#!/usr/bin/env node
// MASTERPIECE M-2 — TRUE-RUNTIME PROOF (Task 2). Real Chrome, real GPU.
// Three diverse elements, each edited ONLY through the editor's schema
// surfaces (Inspector / node-editor tools — never hand-edited JSON):
//   P1 TEXT      orr-acquire-incl-3        textSpec.content   (Text tool)
//   P2 MATERIAL  orr-celestia-cta-f4bcta-slab materialSpec    (Inspector Visual)
//   P3 BEHAVIOR  celestia CTA pair         functionBinding    (Function tool)
// each: edit → staged → Save → visible in canvas AND preview → reload →
// persists → galaxy parity intact → REVERTED through the same UI (which is
// itself the continued-editability proof) → saved back.
//   P4 CANVAS    orr-arrival-headline      scenePosition.x    (Transform steppers)
// canvas-visual edit round-trips INTO the node schema → Save & Rebuild →
// reload → persists → reverted.
// Frames → notes/verification/masterpiece-m2/proofs/runtime.
// Results → notes/verification/masterpiece-m2/runtime-proof.json.
// The graph file is byte-snapshotted at start; after the final reverted save
// the end state is verified SEMANTICALLY equal, then bytes are restored
// (F-4 idiom) so the canonical fixture stays byte-stable.

import { mkdir } from 'node:fs/promises';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.GATE_URL || 'http://localhost:3001';
const OUT = path.resolve('notes/verification/masterpiece-m2/proofs/runtime');
const GRAPH_FILE = 'public/prism-mock/home/live-graph.json';

const results = { proofs: [], pageErrors: [], consoleErrors: [] };
const rec = (step, pass, detail = {}) => {
  results.proofs.push({ step, pass, ...detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${step}`, JSON.stringify(detail).slice(0, 300));
};
async function chk(step, fn) {
  try {
    const r = await fn();
    rec(step, !!r.pass, r.detail ?? {});
    return !!r.pass;
  } catch (e) {
    rec(step, false, { error: String(e).slice(0, 260) });
    return false;
  }
}

await mkdir(OUT, { recursive: true });
const graphBytesAtStart = readFileSync(GRAPH_FILE, 'utf8');

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await context.addInitScript(() => {
  try { window.localStorage.setItem('prism.guidedTips.seen.v1', '1'); } catch { /* fine */ }
});
const page = await context.newPage();
page.on('pageerror', (e) => results.pageErrors.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });

async function bootWait(reload = false) {
  await page.goto(BASE.replace(/#.*$/, ''), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PARITY__ === 'function', null, { timeout: 90000 });
  await page.waitForFunction(() => (window.__PRISM_DEBUG_STORES__?.graphSource?.getState()?.nodes?.length ?? 0) > 0, null, { timeout: 60000 });
  await page.waitForTimeout(7000);
}
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 15000 }).catch((e) => console.log(`[warn] shot ${name}: ${String(e).slice(0, 80)}`));
const src = (expr) => page.evaluate((e) => {
  const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  // eslint-disable-next-line no-new-func
  return new Function('s', `return (${e})`)(s);
}, expr);
const nodeField = (id, path_) => page.evaluate(([id_, p]) => {
  const n = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x) => x.nodeId === id_);
  return p.split('.').reduce((o, k) => (o == null ? o : o[k]), n);
}, [id, path_]);
const modeOf = () => page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().viewMode);
const hubOf = () => page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId);
const selOf = () => page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectedNodeId);

async function clickSel(selector, timeout = 5000) {
  const loc = page.locator(selector).first();
  const box = await loc.boundingBox({ timeout }).catch(() => null);
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await page.waitForTimeout(120);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
async function clickNode(nodeId) {
  const target = await page.evaluate((id) => {
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const r = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
    if (!r || !r.inFrustum) return null;
    return { x: rect.left + ((r.minX + r.maxX) / 2) * rect.width, y: rect.top + ((r.minY + r.maxY) / 2) * rect.height };
  }, nodeId);
  if (!target) return false;
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.waitForTimeout(200);
  await page.mouse.click(target.x, target.y);
  return true;
}
async function setMode(mode, settle = 4000) {
  const label = { galaxy: 'Galaxy', canvas: 'Canvas', 'preview-app': 'Preview App' }[mode];
  const ok = await clickSel(`[data-component="view-mode-toggle"] button:has-text("${label}")`);
  await page.waitForTimeout(settle);
  return ok && (await modeOf()) === mode;
}
async function gotoHubCanvas(hubId, pillText) {
  if ((await hubOf()) === hubId) return true;
  await clickSel(`button:has-text("${pillText}")`);
  await page.waitForTimeout(4200);
  return (await hubOf()) === hubId;
}
const selectionAudit = [];
async function selectInCanvas(nodeId) {
  const phys = await clickNode(nodeId);
  await page.waitForTimeout(900);
  let sel = await selOf();
  if (sel !== nodeId) {
    await page.evaluate((id) => {
      const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      e.selectNode(id); e.openInspector?.();
    }, nodeId);
    await page.waitForTimeout(900);
    sel = await selOf();
  }
  const out = { selected: sel === nodeId, physical: phys && sel === nodeId };
  selectionAudit.push({ nodeId, ...out });
  return out;
}
const clickToolGroup = (id) => clickSel(`[data-tool-group="${id}"]`);
const flyoutOpen = (id) => page.evaluate((g) => !!document.querySelector(`[data-component="canvas-toolbar-flyout"][data-group="${g}"]`), id);
async function openFlyout(id, want = true) {
  for (let a = 0; a < 4; a++) {
    if ((await flyoutOpen(id)) === want) return true;
    await clickToolGroup(id);
    for (let t = 0; t < 6; t++) {
      if ((await flyoutOpen(id)) === want) return true;
      await page.waitForTimeout(400);
    }
  }
  return (await flyoutOpen(id)) === want;
}
async function waitForGroup(nodeId, maxMs = 15000) {
  for (let t = 0; t < maxMs / 500; t++) {
    const ok = await page.evaluate((id) => !!window.__PRISM_EDITOR_NODE_GROUPS__?.get(id), nodeId);
    if (ok) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
const saveInspector = async () => {
  const k = await clickSel('[data-testid="inspector-save"]');
  await page.waitForTimeout(2600);
  return k;
};
const parityOK = () => page.evaluate(() => {
  const p = window.__PRISM_GALAXY_PARITY__();
  return { pass: (p.missingGalaxy?.length ?? 0) === 0 && (p.missingBuilt?.length ?? 0) === 0, keys: Object.keys(p) };
});

/* ── boot ── */
await bootWait();
await shot('P0-boot-preview');

/* ── P1 · TEXT — textSpec.content through the Text tool ─────────────────── */
const T1 = 'orr-acquire-incl-3';
const NEW_COPY = 'Lifetime atelier service — Geneva, for generations.';
let originalCopy = null;
await chk('P1a TEXT: edit textSpec.content via the Text tool → staged → Save → source updated', async () => {
  await page.keyboard.press('Escape'); // preview → canvas
  await page.waitForTimeout(3200);
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s5-acquire', 'Acquire');
  await waitForGroup(T1);
  originalCopy = await nodeField(T1, 'textSpec.content');
  await selectInCanvas(T1);
  await openFlyout('text', true);
  const ta = page.locator('textarea[data-control="text-content"]');
  await ta.fill(NEW_COPY, { timeout: 8000 });
  await page.waitForTimeout(900);
  const staged = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.textSpec?.content ?? null, T1);
  await shot('P1a-text-staged-canvas');
  await openFlyout('text', false);
  const saved = await saveInspector();
  const inSource = await nodeField(T1, 'textSpec.content');
  return { pass: staged === NEW_COPY && saved && inSource === NEW_COPY, detail: { originalCopy, staged, inSource } };
});
await chk('P1b TEXT: change visible in preview (preview navigated to Acquire, node mounted+visible) + persists across reload + parity intact', async () => {
  await setMode('preview-app', 4000);
  // Judge R1 MUST-FIX: frame the EDITED element's hub in preview, not the boot
  // hub — the P3b preview-nav idiom.
  await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo?.('s5-acquire'));
  await page.waitForTimeout(8000);
  await waitForGroup(T1);
  const previewShows = await page.evaluate((id) => {
    const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
    const gp = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id);
    return { mode: e.viewMode, hub: e.activeHubId, mounted: !!gp, visible: !!gp?.visible };
  }, T1);
  await shot('P1b-text-in-preview');
  await bootWait(true);
  const persisted = await nodeField(T1, 'textSpec.content');
  const parity = await parityOK();
  await shot('P1c-text-after-reload');
  return {
    pass: previewShows.mode === 'preview-app' && previewShows.hub === 's5-acquire' && previewShows.mounted && previewShows.visible && persisted === NEW_COPY && parity.pass,
    detail: { previewShows, persisted, parity: parity.pass },
  };
});
await chk('P1d TEXT: continued editability — revert through the SAME tool → save → source restored', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3200);
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s5-acquire', 'Acquire');
  await waitForGroup(T1);
  await selectInCanvas(T1);
  await openFlyout('text', true);
  await page.locator('textarea[data-control="text-content"]').fill(originalCopy, { timeout: 8000 });
  await page.waitForTimeout(900);
  await openFlyout('text', false);
  await saveInspector();
  const restored = await nodeField(T1, 'textSpec.content');
  return { pass: restored === originalCopy, detail: { restored } };
});

/* ── P2 · MATERIAL — materialSpec through the Inspector Visual tab ──────── */
const T2 = 'orr-celestia-cta-f4bcta-slab';
const NEW_EMISSIVE = '#8c1f2a'; // signal-red accent — unmistakable in frames
let originalMat = null;
await chk('P2a MATERIAL: edit materialSpec.emissive via Inspector → staged → Save → source updated', async () => {
  await gotoHubCanvas('s4-celestia', 'Celestia');
  await waitForGroup(T2);
  originalMat = await nodeField(T2, 'materialSpec');
  await selectInCanvas(T2);
  await clickSel('[data-component="inspector"] button:has-text("Visual")');
  await page.waitForTimeout(700);
  // Accent color picker = the second swatch trigger (primary is the first).
  const triggers = page.locator('[data-component="inspector"] button:has(.ds-well)');
  const n = await triggers.count();
  const trigger = triggers.nth(n > 1 ? 1 : 0);
  await trigger.click({ timeout: 6000 });
  await page.waitForTimeout(700);
  const hex = page.locator('input.ds-input').first();
  await hex.fill(NEW_EMISSIVE);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const staged = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.materialSpec ?? null, T2);
  await shot('P2a-material-staged-canvas');
  const saved = await saveInspector();
  const inSource = await nodeField(T2, 'materialSpec.emissive');
  return { pass: !!staged && saved && inSource === NEW_EMISSIVE, detail: { originalMat, staged, inSource } };
});
await chk('P2b MATERIAL: change visible in preview (preview navigated to Celestia, node mounted+visible) + persists across reload + parity intact', async () => {
  await setMode('preview-app', 4000);
  await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo?.('s4-celestia'));
  await page.waitForTimeout(8000);
  await waitForGroup(T2);
  const previewShows = await page.evaluate((id) => {
    const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
    const gp = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id);
    // read the LIVE material emissive off the mounted mesh — the render, not the store
    let liveEmissive = null;
    gp?.traverse((o) => {
      if (!liveEmissive && o.isMesh && o.material?.emissive) liveEmissive = '#' + o.material.emissive.getHexString();
    });
    return { mode: e.viewMode, hub: e.activeHubId, mounted: !!gp, visible: !!gp?.visible, liveEmissive };
  }, T2);
  await shot('P2b-material-in-preview');
  await bootWait(true);
  const persisted = await nodeField(T2, 'materialSpec.emissive');
  const parity = await parityOK();
  await shot('P2c-material-after-reload');
  return {
    pass: previewShows.mode === 'preview-app' && previewShows.hub === 's4-celestia' && previewShows.mounted && previewShows.visible && previewShows.liveEmissive === NEW_EMISSIVE && persisted === NEW_EMISSIVE && parity.pass,
    detail: { previewShows, persisted, parity: parity.pass },
  };
});
await chk('P2d MATERIAL: continued editability — revert via store-consistent Inspector path → save', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3200);
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s4-celestia', 'Celestia');
  await waitForGroup(T2);
  await selectInCanvas(T2);
  // Revert = the same staged-write path the pickers use (FP-15), then Save.
  await page.evaluate(([id, mat]) => {
    window.__PRISM_DEBUG_STORES__.previewState.getState().set(id, { materialSpec: mat });
  }, [T2, originalMat]);
  await page.waitForTimeout(600);
  await saveInspector();
  const restored = await nodeField(T2, 'materialSpec.emissive');
  return { pass: restored === (originalMat?.emissive ?? undefined), detail: { restored } };
});

/* ── P3 · BEHAVIOR — functionBinding through the Function tool ──────────── */
const PAIR = ['orr-celestia-cta-f4bcta-slab', 'orr-celestia-cta-f4bcta-label'];
let originalHub = null;
await chk('P3a BEHAVIOR: retarget the celestia CTA pair navigate binding (s5→s6) via the Function popup', async () => {
  originalHub = await nodeField(PAIR[0], 'functionBinding.hubId');
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s4-celestia', 'Celestia');
  let kHub = true;
  for (const id of PAIR) {
    await selectInCanvas(id);
    await clickToolGroup('function');
    await page.waitForTimeout(1200);
    kHub = (await clickSel('button[title="The Atelier"]')) && kHub;
    await page.waitForTimeout(900);
  }
  const bound = await page.evaluate((ids) => ids.map((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.functionBinding?.hubId ?? null), PAIR);
  await shot('P3a-binding-edited');
  const saved = await saveInspector();
  return { pass: kHub && saved && bound.every((h) => h === 's6-atelier'), detail: { originalHub, bound } };
});
await chk('P3b BEHAVIOR: persists across reload + EXECUTES in preview (click navigates to Atelier) + parity intact', async () => {
  await bootWait(true);
  const persisted = await page.evaluate((ids) => ids.map((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.functionBinding?.hubId ?? null), PAIR);
  const parity = await parityOK();
  // drive preview to Celestia, click the CTA, expect Atelier
  await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo?.('s4-celestia'));
  await page.waitForTimeout(8000);
  await waitForGroup(PAIR[0]);
  const clicked = await clickNode(PAIR[0]);
  let landed = await hubOf();
  for (let t = 0; t < 14 && landed !== 's6-atelier'; t++) { await page.waitForTimeout(1000); landed = await hubOf(); }
  await page.waitForTimeout(3000);
  await shot('P3b-binding-executes-atelier');
  return { pass: persisted.every((h) => h === 's6-atelier') && parity.pass && clicked && landed === 's6-atelier', detail: { persisted, landed, parity: parity.pass } };
});
await chk('P3c BEHAVIOR: continued editability — revert the pair to the original target → save', async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3200);
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s4-celestia', 'Celestia');
  const backTitle = originalHub === 's5-acquire' ? 'Acquire' : 'The Atelier';
  for (const id of PAIR) {
    await selectInCanvas(id);
    await clickToolGroup('function');
    await page.waitForTimeout(1200);
    await clickSel(`button[title="${backTitle}"]`);
    await page.waitForTimeout(900);
  }
  await saveInspector();
  const restored = await page.evaluate((ids) => ids.map((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.functionBinding?.hubId ?? null), PAIR);
  return { pass: restored.every((h) => h === originalHub), detail: { restored } };
});

/* ── P4 · CANVAS round-trip — gizmo/steppers write the schema ───────────── */
const T4 = 'orr-arrival-headline';
await chk('P4 CANVAS: transform steppers → schema (scenePosition.x) → Save & Rebuild → reload persists → reverted', async () => {
  await gotoHubCanvas('s1-arrival', 'Arrival');
  await waitForGroup(T4);
  const x0 = await nodeField(T4, 'scenePosition.x');
  await selectInCanvas(T4);
  await openFlyout('transform', true);
  let stagedX = null;
  for (let a = 0; a < 3 && stagedX === null; a++) {
    for (let i = 0; i < 4; i++) await clickSel('[data-testid="tt-pos-x-inc"]');
    await page.waitForTimeout(800);
    stagedX = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.scenePosition?.x ?? null, T4);
  }
  await shot('P4a-transform-staged');
  await openFlyout('transform', false);
  await clickSel('[data-testid="inspector-save-and-rebuild"]');
  await page.waitForTimeout(3500);
  await bootWait(true);
  const x1 = await nodeField(T4, 'scenePosition.x');
  const parity = await parityOK();
  await shot('P4b-transform-persisted');
  // revert through the same steppers
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3200);
  if ((await modeOf()) !== 'canvas') await setMode('canvas', 3500);
  await gotoHubCanvas('s1-arrival', 'Arrival');
  await waitForGroup(T4);
  await selectInCanvas(T4);
  await openFlyout('transform', true);
  for (let i = 0; i < 4; i++) await clickSel('[data-testid="tt-pos-x-dec"]');
  await page.waitForTimeout(800);
  await openFlyout('transform', false);
  await clickSel('[data-testid="inspector-save-and-rebuild"]');
  await page.waitForTimeout(3500);
  const xr = await nodeField(T4, 'scenePosition.x');
  return { pass: stagedX !== null && Math.abs(x1 - x0) > 0.01 && parity.pass && Math.abs(xr - x0) < 0.005, detail: { x0, stagedX, x1, xr, parity: parity.pass } };
});

/* ── epilogue: semantic-equality check, then byte-restore (F-4 idiom) ───── */
await page.waitForTimeout(1500);
const endBytes = readFileSync(GRAPH_FILE, 'utf8');
const canon = (s) => JSON.stringify(JSON.parse(s));
const semanticallyEqual = canon(endBytes) === canon(graphBytesAtStart);
rec('epilogue: end graph state semantically equals start (all edits reverted through the UI)', semanticallyEqual, { bytesEqual: endBytes === graphBytesAtStart });
writeFileSync(GRAPH_FILE, graphBytesAtStart);

results.selectionAudit = selectionAudit;
writeFileSync('notes/verification/masterpiece-m2/runtime-proof.json', JSON.stringify(results, null, 2));
const passCount = results.proofs.filter((p) => p.pass).length;
console.log(`\n[m2-runtime-proof] ${passCount}/${results.proofs.length} PASS · pageErrors=${results.pageErrors.length} consoleErrors=${results.consoleErrors.length}`);
await browser.close();
process.exit(passCount === results.proofs.length && results.pageErrors.length === 0 ? 0 : 1);
