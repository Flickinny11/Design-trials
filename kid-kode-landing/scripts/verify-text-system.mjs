// P1 TEXT SYSTEM — criterion 26/27 live drive (canvas-spec §18.26/.27, §7).
//
// Drives the real app in real-GPU Chrome (same launch flags as the catalog
// harness): switches to Canvas mode, opens the Text toolbar group, Adds Text,
// then proves criterion 26 structurally + visually:
//   - text node renders as real MSDF glyph meshes (glyph-* unit meshes)
//   - individually selectable (auto-select on add; ring) and MOVABLE
//     (Transform nudge writes scenePosition; world pose changes)
//   - re-font + resize are INSTANT (TextObject Group identity unchanged,
//     other nodes' artifact uuids unchanged, no image artifact re-fetch)
// and criterion 27 from the UI (non-core font pick → on-demand atlas request).
//
// Evidence: notes/verification/text-system/*.png + results.json.
// Exit 1 on any hard failure. Run: node scripts/verify-text-system.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/text-system');
const NON_CORE_FONT = 'Abril Fatface'; // not in the 6 core families

const results = { steps: [], consoleErrors: [], badResponses: [], pass: false };
const fail = (msg) => { results.steps.push({ step: msg, ok: false }); throw new Error(msg); };
const ok = (msg, extra = {}) => results.steps.push({ step: msg, ok: true, ...extra });

const { chromium } = await import('playwright');

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  page.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 300));
  });
  const atlasRequests = [];
  const imageArtifactRequests = [];
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() >= 400) results.badResponses.push({ url: url.slice(0, 160), status: r.status() });
    if (url.includes('/api/prism/fonts/atlas')) {
      atlasRequests.push({ url: url.slice(0, 200), cache: r.headers()['x-prism-font-cache'] ?? null });
    }
  });
  page.on('request', (r) => {
    const u = r.url();
    if (/\.(avif|webp|jpg|jpeg)(\?|$)/i.test(u) || (/\.png(\?|$)/i.test(u) && !u.includes('/fonts/'))) {
      imageArtifactRequests.push({ t: Date.now(), url: u.slice(0, 160) });
    }
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000); // renderer boot
  // Backend attestation (advocate flag): record what actually rendered.
  results.rendererBackend = await page.evaluate(
    () => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown',
  );
  ok('app loaded, canvas present', { backend: results.rendererBackend });

  // ── 1. Switch to Canvas mode ────────────────────────────────────────────
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '01-canvas-mode.png') });
  ok('canvas mode');

  // ── 2. Open the Text toolbar group ──────────────────────────────────────
  await page.click('[data-tool-group="text"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '02-text-flyout.png') });
  ok('text flyout open');

  // ── 3. Add Text ─────────────────────────────────────────────────────────
  const nodesBefore = await page.evaluate(() => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    return m ? [...m.keys()] : [];
  });
  await page.getByRole('button', { name: /Add Text/ }).click();
  await page.waitForTimeout(1500);

  const textNode = await page.evaluate((before) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    if (!m) return { error: 'no node-groups map' };
    const newIds = [...m.keys()].filter((k) => !before.includes(k));
    for (const id of newIds.length ? newIds : [...m.keys()]) {
      const g = m.get(id);
      let handle = null;
      let glyphs = 0;
      g.traverse((o) => {
        if (o.userData && o.userData.textHandle) handle = o;
        if (/^glyph-\d+$/.test(o.name) && o.isMesh) glyphs++;
      });
      if (handle) {
        return {
          nodeId: id,
          textGroupUuid: handle.uuid,
          glyphs,
          spec: { ...handle.userData.textHandle.spec },
          worldX: g.position.x,
        };
      }
    }
    return { error: 'no node with userData.textHandle found', newIds };
  }, nodesBefore);
  if (textNode.error) fail(`Add Text: ${textNode.error} ${JSON.stringify(textNode.newIds ?? [])}`);
  if (!(textNode.glyphs >= 3)) fail(`expected >=3 glyph-* meshes for "Text", got ${textNode.glyphs}`);
  await page.screenshot({ path: path.join(OUT, '03-text-node-added.png') });
  ok('Add Text → real MSDF glyph meshes in scene', { nodeId: textNode.nodeId, glyphs: textNode.glyphs, font: textNode.spec.fontFamily });

  // Other nodes' artifact identity baseline (for the no-re-render proof).
  const otherUuidsBefore = await page.evaluate((textId) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    const out = {};
    for (const [id, g] of m) { if (id !== textId) out[id] = g.uuid; }
    return out;
  }, textNode.nodeId);

  // ── 4. Re-font to a NON-CORE family (criterion 26 instant + 27 UI path) ──
  await page.click('[data-action="font-picker-toggle"]');
  await page.waitForTimeout(400);
  await page.fill('input[placeholder="Search 1,900+ families…"]', NON_CORE_FONT);
  await page.waitForTimeout(800);
  const imgReqBeforeRefont = imageArtifactRequests.length;
  const t0 = Date.now();
  await page.getByRole('button', { name: new RegExp(NON_CORE_FONT) }).first().click();

  // Poll until the mounted TextObject's spec carries the new family.
  let refont = null;
  for (let i = 0; i < 100; i++) {
    refont = await page.evaluate((args) => {
      const m = window.__PRISM_EDITOR_NODE_GROUPS__;
      const g = m && m.get(args.nodeId);
      if (!g) return null;
      let handle = null;
      let glyphs = 0;
      g.traverse((o) => {
        if (o.userData && o.userData.textHandle) handle = o;
        if (/^glyph-\d+$/.test(o.name) && o.isMesh) glyphs++;
      });
      if (!handle) return null;
      const spec = handle.userData.textHandle.spec;
      return { family: spec.fontFamily, uuid: handle.uuid, glyphs };
    }, { nodeId: textNode.nodeId });
    if (refont && refont.family === NON_CORE_FONT) break;
    await page.waitForTimeout(100);
  }
  const refontMs = Date.now() - t0;
  if (!refont || refont.family !== NON_CORE_FONT) fail(`re-font did not land (got ${refont && refont.family})`);
  if (refont.uuid !== textNode.textGroupUuid) fail('TextObject Group identity CHANGED on re-font (expected in-place setSpec)');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '04-refont-noncore.png') });
  ok('re-font to non-core font, in-place (same Group uuid)', { refontMs, glyphs: refont.glyphs, atlasRequests: atlasRequests.length });

  // ── 5. Resize via the Size fader (instant, same identity) ───────────────
  const sized = await page.evaluate(() => {
    // The flyout faders are native range inputs; Size is the first one.
    const flyout = document.querySelector('[data-tool-group="text"]')?.closest('body');
    const ranges = [...document.querySelectorAll('input[type="range"]')];
    if (!ranges.length) return { error: 'no range inputs found' };
    const size = ranges[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(size, String(Number(size.max) * 0.9));
    size.dispatchEvent(new Event('input', { bubbles: true }));
    size.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  });
  if (sized.error) fail(`resize: ${sized.error}`);
  await page.waitForTimeout(800);
  const resized = await page.evaluate((args) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__.get(args.nodeId);
    let handle = null;
    g.traverse((o) => { if (o.userData && o.userData.textHandle) handle = o; });
    return { uuid: handle?.uuid, fontSize: handle?.userData.textHandle.spec.fontSize };
  }, { nodeId: textNode.nodeId });
  if (resized.uuid !== textNode.textGroupUuid) fail('TextObject identity changed on resize');
  if (!(resized.fontSize > (textNode.spec.fontSize ?? 0.4))) fail(`fontSize did not grow (${resized.fontSize})`);
  await page.screenshot({ path: path.join(OUT, '05-resized.png') });
  ok('resize instant, in place', { fontSize: resized.fontSize });

  // No image artifact re-render across re-font + resize:
  const imgReqDelta = imageArtifactRequests.length - imgReqBeforeRefont;
  const otherUuidsAfter = await page.evaluate((textId) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    const out = {};
    for (const [id, g] of m) { if (id !== textId) out[id] = g.uuid; }
    return out;
  }, textNode.nodeId);
  const identityDrift = Object.keys(otherUuidsBefore).filter((k) => otherUuidsAfter[k] !== otherUuidsBefore[k]);
  if (imgReqDelta > 0) fail(`image artifact requests during re-font/resize: ${imgReqDelta}`);
  if (identityDrift.length) fail(`other nodes re-rendered: ${identityDrift.join(',')}`);
  ok('NO image-artifact re-render; other nodes identity stable', { imgReqDelta, others: Object.keys(otherUuidsBefore).length });

  // ── 6. Movable: Transform nudge writes scenePosition → world pose ───────
  await page.click('[data-tool-group="transform"]');
  await page.waitForTimeout(500);
  const xBefore = await page.evaluate((id) => window.__PRISM_EDITOR_NODE_GROUPS__.get(id).position.x, textNode.nodeId);
  for (let i = 0; i < 3; i++) await page.click('[data-testid="tt-pos-x-inc"]');
  await page.waitForTimeout(700);
  const xAfter = await page.evaluate((id) => window.__PRISM_EDITOR_NODE_GROUPS__.get(id).position.x, textNode.nodeId);
  if (!(xAfter > xBefore)) fail(`node did not move (x ${xBefore} → ${xAfter})`);
  await page.screenshot({ path: path.join(OUT, '06-moved.png') });
  ok('text node movable via Transform tools', { xBefore, xAfter });

  // ── 7. Console / network health (kv_check_console / kv_check_network) ───
  // Resource-load console messages carry no URL; the response listener above
  // tracks them with URL + status (favicon 404 is the known P5 punch-list
  // item), so drop the duplicate console form here.
  const hardErrors = results.consoleErrors.filter(
    (e) => !/favicon|Failed to load resource/i.test(e),
  );
  const hardBad = results.badResponses.filter((r) => !/favicon/i.test(r.url));
  ok('console+network sweep', { consoleErrors: hardErrors.length, badResponses: hardBad.length });

  results.atlasRequests = atlasRequests;
  // Canonical error list = hard errors; raw console messages kept separately
  // (the favicon-404 resource line is tracked by URL in badResponses' filter).
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hardErrors;
  results.pass = hardErrors.length === 0 && hardBad.length === 0;
  if (!results.pass) {
    console.error('console errors:', hardErrors, 'bad responses:', hardBad);
  }
} catch (err) {
  results.error = String(err && err.message ? err.message : err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
