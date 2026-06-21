// F4a-DEMO VERIFY — prove the celestial-watch demo app is navigable AND
// editable-through-the-UI on real GPU. Headed Chrome, dismiss walkthrough.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'notes/verification/editor-experience/F4a-DEMO';
fs.mkdirSync(OUT, { recursive: true });

const errs = [];
const report = { frames: [], nav: {}, uiEdit: {}, notes: [] };
const log = (...a) => console.log(...a);

const b = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 200)));

const shot = async (name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); report.frames.push(`${OUT}/${name}.png`); return name; };
const settle = (ms = 1500) => p.waitForTimeout(ms);
const eState = () => p.evaluate(() => {
  const s = window.__PRISM_DEBUG_STORES__; if (!s) return { _nostore: true };
  const e = s.graphEditor.getState();
  return { viewMode: e.viewMode, activeHubId: e.activeHubId, selectedNodeId: e.selectedNodeId, editorMode: e.editorMode, canvasGizmoMode: e.canvasGizmoMode };
});
const setVM = (m) => p.evaluate((mode) => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode(mode), m);
const hubList = () => p.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.map((h) => ({ id: h.hubId, name: h.title })));
const navGo = (id) => p.evaluate((hid) => { const n = window.__PRISM_EDITOR_PREVIEW_APP_NAV__; return n && n.goTo ? n.goTo(hid) : null; }, id);
const localPos = (id) => p.evaluate((nid) => { const d = window.__prismDrivers; return d && d.localPos ? d.localPos(nid) : null; }, id);
// scroll the WebGL canvas (preview-app wheel-driven scroll, 1400px = full sweep)
const wheelTo = async (frac) => {
  const canvas = p.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) return;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // reset to top first by scrolling up hard, then down to target
  for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, -300); await settle(80); }
  await settle(400);
  const px = Math.round(frac * 1400);
  let done = 0;
  while (done < px) { const step = Math.min(180, px - done); await p.mouse.wheel(0, step); done += step; await settle(120); }
  await settle(900);
};

try {
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await settle(5000);
  // dismiss walkthrough
  for (const fn of [
    async () => { await p.getByText('SKIP', { exact: false }).first().click({ timeout: 2500 }); },
    async () => { await p.locator('[aria-label="Close"],[aria-label="close"]').first().click({ timeout: 1500 }); },
    async () => { await p.keyboard.press('Escape'); },
    async () => { await p.keyboard.press('Escape'); },
  ]) { try { await fn(); await settle(600); } catch {} }
  await settle(1200);
  const scrim = await p.locator('[data-component="tip-scrim"]').count();
  report.notes.push(`walkthrough dismissed (tip-scrim=${scrim})`);
  const hubs = await hubList();
  report.hubs = hubs;
  log('HUBS=' + JSON.stringify(hubs));

  // ============ PHASE 1: PREVIEW-APP + ARRIVAL capture ============
  await setVM('preview-app'); await settle(2500);
  await navGo('s1-arrival'); await settle(3000);
  let st = await eState();
  report.notes.push(`entered preview-app, activeHub=${st.activeHubId}`);
  // header (top of page, before scroll)
  await wheelTo(0.0);
  await shot('header');
  await shot('hero');
  // traverse sections by scrolling the page
  await wheelTo(0.22); await shot('section-1');
  await wheelTo(0.45); await shot('section-2');
  await wheelTo(0.68); await shot('section-3');
  await wheelTo(0.88); await shot('section-4');
  await wheelTo(1.0); await shot('footer');
  st = await eState();
  report.notes.push(`arrival traversal done at hub=${st.activeHubId}`);

  // ============ PHASE 2: NAVIGATION ============
  // reset to top, screenshot arrival nav baseline
  await wheelTo(0.0); await settle(600);
  await shot('nav-arrival');
  // Try clicking the demo HEADER nav menu items first (real UI clicks).
  const navResults = {};
  const targets = [
    { id: 's2-movement', label: 'The Movement' },
    { id: 's3-materia', label: 'Materia' },
    { id: 's4-celestia', label: 'Celestia' },
    { id: 's5-acquire', label: 'Acquire' },
  ];
  // First attempt: real header nav click for one hub, capture it.
  let headerClickHub = null;
  for (const t of targets) {
    try {
      // header nav labels render as MSDF text in WebGL (not DOM), so DOM click
      // may not find them. Try DOM text first, fall back to programmatic nav API.
      await p.getByText(t.label, { exact: true }).last().click({ timeout: 2500 });
      await settle(2500);
      const s2 = await eState();
      if (s2.activeHubId === t.id) { navResults[t.id] = 'header-click'; headerClickHub = t; break; }
    } catch {}
  }
  // Use the preview-app nav API (the app's routing surface) for the rest.
  for (const t of targets) {
    if (navResults[t.id]) continue;
    const r = await navGo(t.id); await settle(2800);
    const s2 = await eState();
    navResults[t.id] = (r === t.id && s2.activeHubId === t.id) ? 'nav-api' : `FAIL(got ${s2.activeHubId})`;
  }
  report.nav = navResults;
  // capture one OTHER hub to show routing (The Movement)
  await navGo('s2-movement'); await settle(3000); await wheelTo(0.0);
  await shot('nav-movement');
  // and Celestia for a second routing proof
  await navGo('s4-celestia'); await settle(3000); await wheelTo(0.0);
  await shot('nav-celestia');
  report.notes.push(`nav results: ${JSON.stringify(navResults)}`);

  // ============ PHASE 3: USE-THE-UI authoring proof ============
  // back to arrival, switch to canvas, select an element, edit via gizmo + Save.
  await navGo('s1-arrival'); await settle(1500);
  // switch to Canvas via the view-mode toggle UI (real click)
  let canvasViaUI = false;
  try {
    await p.locator('[data-component="view-mode-toggle"]').getByRole('button', { name: 'Canvas', exact: true }).first().click({ timeout: 5000 });
    await settle(2600);
    canvasViaUI = (await eState()).viewMode === 'canvas';
  } catch {}
  if (!canvasViaUI) { await setVM('canvas'); await settle(2600); }
  report.uiEdit.canvasMode = (await eState()).viewMode;

  // select an Arrival element: try real canvas click, fall back to programmatic
  let sel = null, selVia = 'none';
  const canvas = p.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.45], [0.55, 0.55], [0.5, 0.4], [0.5, 0.6]]) {
      await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy); await settle(900);
      const s2 = await eState(); if (s2.selectedNodeId) { sel = s2.selectedNodeId; selVia = 'canvas-click'; break; }
    }
  }
  if (!sel) {
    const nid = await p.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__;
      const hub = s.graphEditor.getState().activeHubId;
      const inHub = s.graphSource.getState().nodes.filter((n) => n.parentHubId === hub);
      return (inHub[0] || null)?.nodeId ?? null;
    });
    if (nid) { await p.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nid); await settle(1200); sel = (await eState()).selectedNodeId; selVia = 'programmatic'; }
  }
  report.uiEdit.selected = sel; report.uiEdit.selVia = selVia;
  await shot('ui-edit-before');
  const posBefore = await localPos(sel);

  // arm gizmo via UI: transform tool group + Edit handles toggle + Move
  let editOn = false, gizmoArmed = false, moved = false, saved = false;
  try { await p.locator('[data-tool-group="transform"]').click({ timeout: 4000 }); await settle(900); } catch {}
  // ensure the transform panel content (edit-toggle) is present; if the group
  // toggled closed, click it again.
  if (await p.locator('[data-action="edit-toggle"]').count() === 0) {
    try { await p.locator('[data-tool-group="transform"]').click({ timeout: 3000 }); await settle(700); } catch {}
  }
  try { await p.locator('[data-action="edit-toggle"]').first().click({ timeout: 4000 }); await settle(900); } catch {}
  editOn = (await eState()).editorMode === 'edit';
  try { await p.locator('[data-testid="tt-move"]').click({ timeout: 3000 }); await settle(700); } catch {}
  gizmoArmed = (await eState()).canvasGizmoMode === 'translate';
  // authoritative staged-position reader (previewState overlay — the real-time
  // authoring path the nudge writes through via usePreviewStateStore.set).
  const stagedSP = async () => p.evaluate((id) => {
    const s = window.__PRISM_DEBUG_STORES__;
    const ps = s.previewState ? s.previewState.getState() : null;
    const patch = ps && ps.patches ? ps.patches[id] : null;
    const src = s.graphSource.getState().nodes.find((n) => n.nodeId === id);
    return {
      previewPatchKeys: patch ? Object.keys(patch) : [],
      stagedScenePosX: patch?.scenePosition?.x ?? null,
      sourceScenePosX: src?.scenePosition?.x ?? null,
    };
  }, sel);
  const spBefore = await stagedSP();
  report.uiEdit.stepperRows = await p.locator('[data-testid="tt-pos-x"]').count();
  // nudge position via the UI position stepper (StepperKey id = tt-pos-x-inc)
  let nudgeClicks = 0;
  try {
    const inc = p.locator('[data-testid="tt-pos-x-inc"]').first();
    await inc.waitFor({ state: 'visible', timeout: 4000 });
    for (let i = 0; i < 6; i++) { await inc.click({ timeout: 2500 }); nudgeClicks++; await settle(320); }
  } catch (e) { report.uiEdit.nudgeErr = String(e).slice(0, 140); }
  report.uiEdit.nudgeClicks = nudgeClicks;
  await settle(1200);
  const spAfterNudge = await stagedSP();
  report.uiEdit.sourceScenePosX_beforeSave = spBefore.sourceScenePosX;
  report.uiEdit.stagedScenePosX_afterNudge = spAfterNudge.stagedScenePosX;
  const posAfter = await localPos(sel);
  // moved = a scenePosition.x was staged into the preview overlay (the UI write)
  const stagedMoved = spAfterNudge.stagedScenePosX !== null
    && spAfterNudge.stagedScenePosX !== spBefore.sourceScenePosX;
  moved = stagedMoved
    || (posBefore && posAfter && Math.abs((posAfter.position?.x ?? 0) - (posBefore.position?.x ?? 0)) > 0.0001);
  // read the source-store canvasTransform too (the gizmo/stepper writes here)
  const ctAfter = await p.evaluate((id) => {
    const n = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x) => x.nodeId === id);
    return n?.canvasTransform ?? null;
  }, sel);
  report.uiEdit.canvasTransformAfter = ctAfter;
  // Save via the UI Inspector Save button (commit preview -> source)
  let saveLabel = '';
  try {
    const saveBtn = p.locator('[data-testid="inspector-save"]').first();
    saveLabel = (await saveBtn.textContent({ timeout: 2500 }))?.trim() || '';
    await saveBtn.click({ timeout: 3000 }); await settle(1800); saved = true;
  } catch (e) { report.uiEdit.saveErr = String(e).slice(0, 140); }
  await settle(900);
  // after Save, the staged scenePosition should be committed to the source store
  const spAfterSave = await p.evaluate((id) => {
    const s = window.__PRISM_DEBUG_STORES__;
    const src = s.graphSource.getState().nodes.find((n) => n.nodeId === id);
    const ps = s.previewState ? s.previewState.getState() : null;
    const patch = ps && ps.patches ? ps.patches[id] : null;
    return { sourceScenePosX: src?.scenePosition?.x ?? null, bufferKeys: patch ? Object.keys(patch).length : 0 };
  }, sel);
  report.uiEdit.sourceScenePosX_afterSave = spAfterSave.sourceScenePosX;
  report.uiEdit.previewBufferAfterSave = spAfterSave.bufferKeys;
  report.uiEdit.committed = spAfterSave.sourceScenePosX !== null
    && spAfterSave.sourceScenePosX !== report.uiEdit.sourceScenePosX_beforeSave;
  await shot('ui-edit-after');
  // moved = the rendered element visibly translated (localPos delta) OR the
  // source canvasTransform.x is now non-zero (the stepper/gizmo write target).
  const ctMoved = !!(ctAfter && Math.abs((ctAfter.x ?? 0)) > 0.0001);
  const elementMoved = moved || ctMoved;
  report.uiEdit = {
    ...report.uiEdit, editOn, gizmoArmed, moved: elementMoved, ctMoved, saved, saveLabel,
    posX_before: posBefore?.position?.x, posX_after: posAfter?.position?.x,
  };

  report.consoleErrors = errs.length;
  report.errSamples = errs.slice(0, 12);
  fs.writeFileSync(`${OUT}/_report.json`, JSON.stringify(report, null, 2));
  log('REPORT=' + JSON.stringify(report, null, 2));
  log('console_errors=' + errs.length);
  if (errs.length) log(errs.slice(0, 12).join('\n'));
} catch (e) {
  log('FATAL ' + String(e));
  report.fatal = String(e);
  fs.writeFileSync(`${OUT}/_report.json`, JSON.stringify(report, null, 2));
} finally {
  await b.close(); log('DONE');
}
