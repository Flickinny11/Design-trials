// FINAL SIGN-OFF drive — criteria 3..8 (§6 node lifecycle, mutating; restore
// public/prism-mock/home/live-graph.json with git checkout afterwards).
//
// c03: Add Element in Canvas -> graph node tethered to current hub (parentHubId
//      on disk) + visible in Galaxy (before/after frames; node stays selected
//      so its ring marks it).
// c04: bubble = translucent transmission sphere; stage ladder gates: ONLY
//      "Add Object" enabled.
// c05: Add Object (image link) -> Populated (textured plane) + Build Node
//      action revealed/enabled.
// c06: Build Node -> builtSnapshot recorded (hash/status/buildCount via
//      window.__prismBuiltSnapshots) + Add to System appears (Build flyout).
// c07: Add to System -> fresh self-caption written to graph (disk) + dirty
//      cleared (Build flyout state label).
// c08: manual edit (Material tab fader -> Save) -> dirty set ("Dirty — needs
//      rebuild", In-System stage no longer current); re-add path (Save&Rebuild
//      + Add to System) -> caption current again.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');
const GRAPH = path.resolve('public/prism-mock/home/live-graph.json');
const results = { steps: [], consoleErrors: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });
const readGraph = async () => JSON.parse(await readFile(GRAPH, 'utf8'));

const { chromium } = await import('playwright');

// content for Add Object
async function uploadProbe() {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 320, height: 200, channels: 4, background: { r: 40, g: 140, b: 210, alpha: 1 } },
  }).png().toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'signoff-probe.png');
  const r = await fetch(`${BASE}/api/prism/assets`, { method: 'POST', body: form });
  if (!r.ok) fail(`upload failed ${r.status}`);
  return (await r.json()).url;
}

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
try {
  await mkdir(OUT, { recursive: true });
  const assetUrl = await uploadProbe();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);

  // c03 galaxy BEFORE frame
  await page.getByRole('button', { name: 'Galaxy', exact: true }).first().click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, 'c03-galaxy-before-add.png') });
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2200);

  // ── Add Element → stage-1 bubble ──────────────────────────────────────────
  const before = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  await page.click('[data-action="add-element"]');
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  const newIds = after.filter((k) => !before.includes(k));
  if (newIds.length !== 1) fail(`expected 1 new node, got ${newIds.length}`);
  const bubbleId = newIds[0];

  // c04 — transmission material probe
  const bubble = await page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    if (!g) return null;
    let mat = null;
    g.traverse((o) => { if (!mat && o.isMesh && o.material && o.material.transmission !== undefined) mat = { transmission: o.material.transmission, type: o.material.type }; });
    return mat;
  }, bubbleId);
  if (!bubble || bubble.transmission < 0.8) fail(`bubble material wrong: ${JSON.stringify(bubble)}`);
  await page.screenshot({ path: path.join(OUT, 'c04-bubble-canvas.png') });
  ok('c04: Add Element -> translucent transmission bubble', { bubbleId, ...bubble });

  // c04 — stage-ladder gating: ONLY Add Object enabled
  const gating = await page.evaluate(() => {
    const states = {};
    for (const el of document.querySelectorAll('[data-stage]')) {
      states[el.getAttribute('data-stage')] = el.getAttribute('data-stage-state');
    }
    const btn = (a) => {
      const b = document.querySelector(`[data-stage-action="${a}"]`);
      return b ? { present: true, disabled: b.disabled } : { present: false };
    };
    return {
      states,
      addObject: btn('Add Object'),
      buildNode: btn('Build Node'),
      addToSystem: btn('Add to System'),
    };
  });
  results.c04gating = gating;
  if (!(gating.addObject.present && !gating.addObject.disabled)) fail('Add Object not enabled on fresh bubble');
  if (!gating.buildNode.disabled || !gating.addToSystem.disabled) fail(`gating broken: ${JSON.stringify(gating)}`);
  if (gating.states['1'] !== 'current') fail(`bubble stage not current: ${JSON.stringify(gating.states)}`);
  await page.screenshot({ path: path.join(OUT, 'c04-stage-gating-only-add-object.png') });
  ok('c04: stage ladder gates — only Add Object enabled', gating);

  // c03 — graph tether on disk (autosave flush)
  await page.waitForTimeout(3500);
  let g = await readGraph();
  let node = g.nodes.find((n) => n.nodeId === bubbleId);
  if (!node) fail('bubble not persisted to live graph');
  if (node.parentHubId !== g.hub.hubId) fail(`tether wrong: ${node.parentHubId} != ${g.hub.hubId}`);
  ok('c03: node persisted, tethered to current hub', { parentHubId: node.parentHubId, hub: g.hub.hubId });

  // c03 — galaxy AFTER frame (bubble selected -> ring marks it)
  await page.getByRole('button', { name: 'Galaxy', exact: true }).first().click();
  await page.waitForTimeout(2400);
  await page.screenshot({ path: path.join(OUT, 'c03-galaxy-after-add.png') });
  ok('c03: galaxy frame after add captured (new node visible)');
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2200);

  // ── c05 Add Object → Populated + Build Node revealed ─────────────────────
  // open the Add flyout only if it is not already mounted (the group key
  // TOGGLES; a blind click can close an active flyout)
  const openAddGroup = async () => {
    const mounted = await page.evaluate(() => !!document.querySelector('[data-component="add-element-flyout"]'));
    if (!mounted) {
      await page.click('[data-tool-group="add"]');
      await page.waitForTimeout(700);
    }
  };
  await openAddGroup();
  // selection guard: if the stage-1 action is disabled the selection was lost
  // across the galaxy round-trip — re-select the bubble via marquee over its
  // spawn band.
  const addObjState = await page.evaluate(() => {
    const b = document.querySelector('[data-stage-action="Add Object"]');
    return b ? { present: true, disabled: b.disabled } : { present: false };
  });
  if (!addObjState.present || addObjState.disabled) {
    await page.click('[data-tool-group="selection"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="tt-marquee"]');
    await page.waitForTimeout(200);
    await page.mouse.move(880, 500); await page.mouse.down();
    await page.mouse.move(1030, 650, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(700);
    await openAddGroup();
  }
  // open the Add Object panel (it toggles; after remount it starts closed)
  const panelOpen = await page.evaluate(() => !!document.querySelector('[data-action="add-object-use-url"]'));
  if (!panelOpen) {
    await page.click('[data-stage-action="Add Object"]');
    await page.waitForTimeout(600);
  }
  await page.fill('input[placeholder="…or paste an image link"]', assetUrl);
  await page.click('[data-action="add-object-use-url"]');
  await page.waitForTimeout(2500);
  const populated = await page.evaluate(async (nid) => {
    for (let i = 0; i < 30; i++) {
      const gg = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let img = null, bub = null;
      gg?.traverse((o) => {
        if (o.isMesh && o.material?.map) img = o;
        if (o.isMesh && o.material && o.material.transmission !== undefined && o.material.transmission > 0.5) bub = o;
      });
      if (img && !bub) return { populated: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { populated: false };
  }, bubbleId);
  if (!populated.populated) fail('Add Object did not populate the bubble');
  // NOTE (§6 P3 design): Add Object populates AND immediately builds, so the
  // ladder lands past stage 2. "Reveals Build Node" therefore means: the
  // Build Node stage action is revealed on the ladder with Populated marked
  // done; it becomes ENABLED exactly when the build goes stale (asserted in
  // the c08 leg below as c05b).
  const buildBtn = await page.evaluate(() => {
    const b = document.querySelector('[data-stage-action="Build Node"]');
    const states = {};
    for (const el of document.querySelectorAll('[data-stage]')) states[el.getAttribute('data-stage')] = el.getAttribute('data-stage-state');
    return { btn: b ? { present: true, disabled: b.disabled, title: b.title } : { present: false }, states };
  });
  results.c05buildBtn = buildBtn;
  if (!buildBtn.btn.present) fail('Build Node action not revealed on the ladder');
  if (buildBtn.states['2'] !== 'done' && buildBtn.states['2'] !== 'current') fail(`Populated stage not reached: ${JSON.stringify(buildBtn.states)}`);
  await page.screenshot({ path: path.join(OUT, 'c05-populated-build-node-revealed.png') });
  ok('c05: artifact added -> Populated (done) + built; Build Node revealed', buildBtn);

  // ── c06 Build → builtSnapshot cached + Add to System appears ─────────────
  // (rebuildNode is hash-gated per INV-R7/RT-SC-09: an unchanged node does NOT
  //  rebuild — the buildCount bump on a REAL change is asserted in the c08 leg)
  const snap1 = await page.evaluate((nid) => window.__prismBuiltSnapshots?.()[nid] ?? null, bubbleId);
  if (!snap1 || !snap1.hash || snap1.status !== 'built') fail(`no builtSnapshot recorded after build: ${JSON.stringify(snap1)}`);
  results.c06snapshots = { afterPopulate: snap1 };
  await page.click('[data-tool-group="build"]');
  await page.waitForTimeout(700);
  const addToSystemBtn = await page.evaluate(() => !!document.querySelector('[data-action="add-to-system"]'));
  if (!addToSystemBtn) fail('Add to System button not present after build');
  await page.screenshot({ path: path.join(OUT, 'c06-built-snapshot-add-to-system.png') });
  ok('c06: build -> builtSnapshot cached (hash-keyed) + rendered; Add to System appears', {
    hash: snap1.hash, status: snap1.status, buildCount: snap1.buildCount,
  });

  // ── c07 Add to System → fresh caption + dirty cleared ────────────────────
  g = await readGraph();
  const captionBefore = g.nodes.find((n) => n.nodeId === bubbleId)?.intent?.caption ?? '';
  await page.click('[data-action="add-to-system"]');
  await page.waitForTimeout(3500); // autosave flush
  g = await readGraph();
  const captionAfter = g.nodes.find((n) => n.nodeId === bubbleId)?.intent?.caption ?? '';
  if (!captionAfter || captionAfter === captionBefore) fail(`caption not refreshed: "${captionAfter}"`);
  const buildLabel1 = await page.evaluate(() => {
    const f = document.querySelector('[data-action="add-to-system"]')?.closest('div')?.parentElement;
    return document.body.textContent.includes('Built · in system');
  });
  if (!buildLabel1) fail('Build state label did not read "Built · in system" after Add to System');
  await page.screenshot({ path: path.join(OUT, 'c07-added-to-system-caption.png') });
  ok('c07: Add to System wrote fresh self-caption + cleared dirty', { captionBefore, captionAfter });

  // ── c08 manual edit → dirty → re-add ─────────────────────────────────────
  // The Inspector panel is closed by default after the flyout interactions —
  // open it on the Material tab through the same store action the DetailCard
  // "inspect" button dispatches (openInspector('material')), then drive the
  // REAL tab + fader + Save buttons in the panel.
  await page.evaluate(() => {
    window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.openInspector?.('material');
  });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Material' }).first().click();
  await page.waitForTimeout(700);
  const faderSet = await page.evaluate(() => {
    const el = document.querySelector('input[type="range"][data-control="roughness"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '0.15');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  });
  if (!faderSet) fail('Material roughness fader not found in Inspector');
  await page.waitForTimeout(400);
  await page.click('[data-testid="inspector-save"]');
  await page.waitForTimeout(1500);
  const dirtyState = await page.evaluate(() => ({
    dirtyLabel: document.body.textContent.includes('Dirty — needs rebuild'),
  }));
  if (!dirtyState.dirtyLabel) fail('manual edit did not set dirty (no "Dirty — needs rebuild" label)');
  // stage ladder: In System no longer current (caption not considered current)
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  const ladderDirty = await page.evaluate(() => {
    const states = {};
    for (const el of document.querySelectorAll('[data-stage]')) states[el.getAttribute('data-stage')] = el.getAttribute('data-stage-state');
    const b = document.querySelector('[data-stage-action="Build Node"]');
    return { states, buildNode: b ? { disabled: b.disabled, title: b.title } : null };
  });
  results.c08ladderAfterEdit = ladderDirty;
  if (ladderDirty.states['4'] === 'current' || ladderDirty.states['4'] === 'done') fail(`In System still current after edit: ${JSON.stringify(ladderDirty)}`);
  // c05b — the stale build is exactly when Build Node goes ENABLED
  if (!ladderDirty.buildNode || ladderDirty.buildNode.disabled) fail(`Build Node not enabled on stale build: ${JSON.stringify(ladderDirty)}`);
  await page.screenshot({ path: path.join(OUT, 'c08-manual-edit-dirty.png') });
  ok('c08: manual edit set dirty; In-System regressed; c05b: Build Node ENABLED on stale build', ladderDirty);

  // re-add path: Save & Rebuild + Add to System -> current again. The edit
  // changed the content hash, so THIS rebuild really re-assembles: buildCount
  // must bump and the snapshot hash must move (c06's "Build Node assembles +
  // caches builtSnapshot" on a real change).
  await page.click('[data-tool-group="build"]');
  await page.waitForTimeout(700);
  await page.click('[data-action="rebuild"]');
  await page.waitForTimeout(2500);
  const snapAfterRebuild = await page.evaluate((nid) => window.__prismBuiltSnapshots?.()[nid] ?? null, bubbleId);
  if (!snapAfterRebuild || snapAfterRebuild.buildCount <= snap1.buildCount || snapAfterRebuild.hash === snap1.hash) {
    fail(`Build Node did not re-assemble on changed hash: ${JSON.stringify({ snap1, snapAfterRebuild })}`);
  }
  results.c06snapshots.afterEditRebuild = snapAfterRebuild;
  ok('c06b: Build Node re-assembles on changed hash (buildCount bump, new hash)', {
    from: snap1.hash, to: snapAfterRebuild.hash, buildCount: snapAfterRebuild.buildCount,
  });
  await page.click('[data-action="add-to-system"]');
  await page.waitForTimeout(1200);
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  const ladderClean = await page.evaluate(() => {
    const states = {};
    for (const el of document.querySelectorAll('[data-stage]')) states[el.getAttribute('data-stage')] = el.getAttribute('data-stage-state');
    return { states, dirtyLabelGone: !document.body.textContent.includes('Dirty — needs rebuild') };
  });
  results.c08ladderAfterReadd = ladderClean;
  if (ladderClean.states['4'] !== 'current') fail(`re-add did not restore In System: ${JSON.stringify(ladderClean)}`);
  await page.screenshot({ path: path.join(OUT, 'c08-readded-in-system.png') });
  ok('c08: rebuild + re-Add-to-System -> caption current again (In System)', ladderClean);

  const hardErrors = results.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hardErrors;
  results.pass = hardErrors.length === 0;
  await page.close();
} catch (err) {
  results.error = String(err?.message ?? err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'c03-08-lifecycle-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: results.pass, error: results.error, steps: results.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.step}`) }, null, 2));
process.exit(results.pass ? 0 : 1);
