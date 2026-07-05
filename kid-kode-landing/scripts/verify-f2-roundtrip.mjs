#!/usr/bin/env node
// verify-f2-roundtrip — FINISH F-2 task 3: UNBUILT vs BUILT semantics, proven
// with ONE real round-trip driven like a user (real Chrome, real GPU, real UI
// clicks — the verify-image-media idiom):
//
//   1. Canvas → Add Element → a stage-0 UNBUILT bubble node is created.
//   2. Galaxy shows the new node as first-class STRUCTURE (projection member,
//      listed unbuilt by the app's own galaxy-semantics via the parity probe).
//   3. Preview App does NOT mount it ("not rendered in Canvas/Preview until
//      Built" — the played app has no unbuilt elements).
//   4. BUILD it: populate with a real image asset through the Add Object
//      image-link path (upload API → URL input → Use) → surgical rebuild.
//   5. Now it renders BUILT in canvas AND preview (textured plane, no bubble).
//   6. saveToServer → reload → the built node PERSISTS from live-graph.json.
//
// The live-graph fixture is checked-in demo data: after this proof the runner
// restores it via git (the proof is persistence THROUGH the server round-trip,
// not a permanent fixture edit) — same discipline as FINISH F-1.
//
// Usage: node scripts/verify-f2-roundtrip.mjs   (dev server on :3000, or GATE_URL)

import { mkdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.GATE_URL || 'http://localhost:3000';
const OUT = path.resolve('notes/verification/finish-f2/roundtrip');
const results = { steps: [], consoleErrors: [], pageErrors: [] };
function ok(step, detail = {}) {
  results.steps.push({ step, pass: true, ...detail });
  console.log(`[PASS] ${step}`, JSON.stringify(detail));
}
function fail(step, detail = {}) {
  results.steps.push({ step, pass: false, ...detail });
  console.error(`[FAIL] ${step}`, JSON.stringify(detail));
  writeFileSync(path.join(OUT, 'roundtrip.json'), JSON.stringify(results, null, 2) + '\n');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

// ── 0. A real image asset via the upload API (content-hashed URL). ──────────
const png = await sharp({
  create: { width: 320, height: 200, channels: 4, background: { r: 200, g: 40, b: 56, alpha: 1 } },
}).png().toBuffer();
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'f2-roundtrip.png');
const up = await fetch(`${BASE}/api/prism/assets`, { method: 'POST', body: form });
if (!up.ok) fail('asset upload', { status: up.status });
const { url: assetUrl } = await up.json();
ok('asset uploaded', { assetUrl });

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  // Keep the first-visit walkthrough out of the proof (it drives viewMode).
  await context.addInitScript(() => {
    try { window.localStorage.setItem('prism.guidedTips.seen.v1', '1'); } catch { /* fine */ }
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => results.pageErrors.push(e.message.slice(0, 200)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PARITY__ === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(4500);

  // ── 1. Canvas → Add Element (real UI clicks) → stage-0 bubble. ───────────
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  const preAdd = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.click('[data-action="add-element"]');
  await page.waitForTimeout(1500);
  const postAdd = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  const bubbleId = postAdd.filter((k) => !preAdd.includes(k))[0];
  if (!bubbleId) fail('bubble created', { preAdd: preAdd.length, postAdd: postAdd.length });
  await page.screenshot({ path: path.join(OUT, '01-canvas-unbuilt-bubble.png') });
  ok('Add Element created a stage-0 bubble node in canvas', { bubbleId });

  // ── 2. The app's OWN semantics call it UNBUILT structure in galaxy. ──────
  const unbuiltParity = await page.evaluate((nid) => {
    const p = window.__PRISM_GALAXY_PARITY__();
    return {
      role: p.roles[nid] ?? null,
      unbuilt: p.unbuilt.includes(nid),
      inProjection: p.projection.some((el) => el.memberIds.includes(nid)),
    };
  }, bubbleId);
  if (!(unbuiltParity.role === 'content' && unbuiltParity.unbuilt && unbuiltParity.inProjection)) {
    fail('unbuilt node is first-class galaxy structure', unbuiltParity);
  }
  ok('galaxy semantics: node is CONTENT + UNBUILT + first-class in the projection', unbuiltParity);

  await page.getByRole('button', { name: 'Galaxy', exact: true }).first().click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, '02-galaxy-unbuilt-structure.png') });
  ok('galaxy frame captured with the unbuilt node present as structure');

  // ── 3. Preview App does NOT mount the unbuilt node. ──────────────────────
  await page.getByRole('button', { name: 'Preview App', exact: true }).first().click();
  await page.waitForTimeout(3000);
  const inPreviewUnbuilt = await page.evaluate(
    (nid) => window.__PRISM_EDITOR_NODE_GROUPS__?.has(nid) ?? false, bubbleId);
  if (inPreviewUnbuilt) fail('unbuilt hidden in preview', { bubbleId, mounted: true });
  await page.screenshot({ path: path.join(OUT, '03-preview-unbuilt-absent.png') });
  ok('preview-app: unbuilt node NOT mounted (built-status law)', { bubbleId });

  // ── 4. BUILD it: populate with the uploaded image via the real UI. ───────
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.evaluate((nid) => {
    window.__PRISM_DEBUG_STORES__?.graphEditor?.getState().selectNode(nid);
  }, bubbleId);
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  // The image populate controls live behind the lifecycle strip's "Add Object"
  // key (enabled only while the selected node is a stage-0 bubble).
  await page.click('[data-stage-action="Add Object"]');
  await page.waitForTimeout(600);
  await page.fill('input[placeholder="…or paste an image link"]', assetUrl);
  await page.click('[data-action="add-object-use-url"]');
  await page.waitForTimeout(2500);
  const built = await page.evaluate(async (nid) => {
    for (let i = 0; i < 30; i++) {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let img = null, bubble = null;
      g?.traverse((o) => {
        if (o.isMesh && o.material?.map) img = o;
        if (o.isMesh && o.material && o.material.transmission !== undefined && o.material.transmission > 0.5) bubble = o;
      });
      if (img && !bubble) return { built: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { built: false };
  }, bubbleId);
  if (!built.built) fail('build path produced a textured element in canvas', { bubbleId });
  await page.screenshot({ path: path.join(OUT, '04-canvas-built.png') });
  ok('BUILD: bubble populated → rebuilt as a real textured element in canvas', { bubbleId });

  const builtParity = await page.evaluate((nid) => {
    const p = window.__PRISM_GALAXY_PARITY__();
    return { unbuilt: p.unbuilt.includes(nid), inProjection: p.projection.some((el) => el.memberIds.includes(nid)) };
  }, bubbleId);
  if (builtParity.unbuilt || !builtParity.inProjection) fail('parity probe reports node BUILT', builtParity);
  ok('galaxy semantics now report the node BUILT (still first-class structure)', builtParity);

  // ── 5. BUILT ⟹ visible in Preview App. ──────────────────────────────────
  await page.getByRole('button', { name: 'Preview App', exact: true }).first().click();
  await page.waitForTimeout(3000);
  const previewBuilt = await page.evaluate(async (nid) => {
    for (let i = 0; i < 25; i++) {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let img = null;
      g?.traverse((o) => { if (o.isMesh && o.material?.map) img = o; });
      if (img) return { mounted: true, textured: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { mounted: window.__PRISM_EDITOR_NODE_GROUPS__?.has(nid) ?? false, textured: false };
  }, bubbleId);
  if (!previewBuilt.textured) fail('built node visible in preview-app', previewBuilt);
  await page.screenshot({ path: path.join(OUT, '05-preview-built-visible.png') });
  ok('preview-app now mounts the BUILT element (textured)', { bubbleId, ...previewBuilt });

  // ── 6. Persist: save → reload → still built. ─────────────────────────────
  const save = await page.evaluate(async () => {
    const r = await window.__PRISM_DEBUG_STORES__.graphSource.getState().saveToServer();
    return r;
  });
  if (!save || save.ok === false) fail('saveToServer persisted the graph', { save });
  ok('saved to server (/api/prism/regen → live-graph.json)', { save });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PARITY__ === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  const persisted = await page.evaluate((nid) => {
    const src = window.__PRISM_DEBUG_STORES__.graphSource.getState();
    const node = src.nodes.find((n) => n.nodeId === nid);
    return node
      ? { present: true, sourceAsset: node.visual?.sourceAsset ?? null, renderMode: node.renderMode ?? null }
      : { present: false };
  }, bubbleId);
  if (!persisted.present || persisted.sourceAsset !== assetUrl) {
    fail('node persisted BUILT across reload', { bubbleId, ...persisted });
  }
  const mountedAfterReload = await page.evaluate(async (nid) => {
    for (let i = 0; i < 40; i++) {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let img = null;
      g?.traverse((o) => { if (o.isMesh && o.material?.map) img = o; });
      if (img) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }, bubbleId);
  if (!mountedAfterReload) fail('built node mounts after reload', { bubbleId });
  await page.screenshot({ path: path.join(OUT, '06-reload-persisted-built.png') });
  ok('PERSISTENCE: reload restores the node BUILT from live-graph.json', { bubbleId, ...persisted });

  results.bubbleId = bubbleId;
  results.assetUrl = assetUrl;
  writeFileSync(path.join(OUT, 'roundtrip.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('\nROUNDTRIP COMPLETE — restore the fixture with:');
  console.log('  git checkout -- public/prism-mock/home/live-graph.json');
} finally {
  await browser.close();
}
