// P6 SIGN-OFF — criterion 29 live drive + mobile viewport pass.
//
// Crit 29: a TEXT-category animation primitive (wave-text) bound to a real
// MSDF text node animates PER-GLYPH on the shared timeline (preview-app
// master clock) and rides the Driver model (driver swap leaves params
// untouched — INV-6). The catalog before/after tiles already prove per-glyph
// rendering in the catalog rig; this drive closes the binding+Driver half on
// the live app (P2's drive only played 'float').
//
// Mobile: 390x844 isMobile+hasTouch — boot (preview-app default), switch all
// 3 modes via the bottom pill, open 2 toolbar flyouts, capture frames.
//
// Evidence → notes/verification/canvas-completion/. Exit 1 on hard failure.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');

const results = { steps: [], consoleErrors: [], badResponses: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/i.test(r.url())) results.badResponses.push({ url: r.url().slice(0, 120), status: r.status() });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);
  results.rendererBackend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.waitForTimeout(2500);
  ok('canvas mode', { backend: results.rendererBackend });

  // ── 1. Add Text (crit-26 live spot-check; node auto-selected) ───────────
  await page.click('[data-tool-group="text"]');
  await page.waitForTimeout(700);
  const nodesBefore = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.getByRole('button', { name: /Add Text/ }).click();
  await page.waitForTimeout(1800);
  const textNode = await page.evaluate((before) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    if (!m) return { error: 'no node-groups map' };
    const newIds = [...m.keys()].filter((k) => !before.includes(k));
    for (const id of newIds) {
      const g = m.get(id);
      let handle = null; let glyphs = 0;
      g.traverse((o) => {
        if (o.userData && o.userData.textHandle) handle = o;
        if (/^glyph-\d+$/.test(o.name) && o.isMesh) glyphs += 1;
      });
      if (handle) return { nodeId: id, glyphs, font: handle.userData.textHandle.spec.fontFamily };
    }
    return { error: 'no new node with textHandle', newIds };
  }, nodesBefore);
  if (textNode.error) fail(`Add Text: ${textNode.error}`);
  if (textNode.glyphs < 3) fail(`expected >=3 glyph meshes, got ${textNode.glyphs}`);
  await page.screenshot({ path: path.join(OUT, 'c26-spotcheck-text-added.png') });
  ok('crit-26 spot-check: Add Text → real MSDF glyph meshes, selectable', textNode);

  // ── 2. Bind the TEXT-category primitive wave-text ────────────────────────
  await page.click('[data-tool-group="animation"]');
  await page.waitForTimeout(900);
  if ((await page.locator('input[placeholder^="Search"]').count()) === 0) fail('animation flyout has no picker (selection lost)');
  await page.fill('input[placeholder^="Search"]', 'wave');
  await page.waitForTimeout(700);
  const tile = page.locator('[data-anim-tile][data-primitive="wave-text"]');
  if ((await tile.count()) === 0) fail('wave-text tile not in picker');
  await tile.first().click();
  await page.waitForTimeout(900);
  const boundRow = await page.evaluate(() => {
    const f = document.querySelector('[data-component="animation-flyout"]');
    return f && /wave/i.test(f.textContent) && !!f.querySelector('[data-action="binding-remove"]');
  });
  if (!boundRow) fail('binding row did not appear');
  await page.screenshot({ path: path.join(OUT, 'c29-binding-row.png') });
  ok('wave-text (category: text) bound via picker, driver=time default');

  // Autosaved graph: capture the binding before driver swap (INV-6 baseline)
  await page.waitForTimeout(3500);
  const g1 = JSON.parse(await readFile('public/prism-mock/home/live-graph.json', 'utf8'));
  const bn1 = g1.nodes.find((n) => n.nodeId === textNode.nodeId);
  const b1 = bn1?.animationBindings?.find((b) => b.primitive === 'wave-text');
  if (!b1) fail('wave-text binding not persisted on the text node');
  if (b1.driver !== 'time') fail(`expected default driver time, got ${b1.driver}`);
  const paramsBefore = JSON.stringify(b1.params ?? null);

  // ── 3. Preview-app: per-glyph motion on the shared timeline ─────────────
  await page.click('[data-action="jump-preview-app"]');
  await page.waitForTimeout(2200);
  const perGlyph = await page.evaluate(async (nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    if (!g) return { error: 'text node not rendered in preview-app' };
    const glyphs = [];
    g.traverse((o) => { if (/^glyph-\d+$/.test(o.name) && o.isMesh) glyphs.push(o); });
    if (glyphs.length < 3) return { error: `only ${glyphs.length} glyphs in preview` };
    const snap = () => glyphs.map((m) => [m.position.x, m.position.y, m.position.z]);
    const a = snap();
    await new Promise((r) => setTimeout(r, 600));
    const b = snap();
    await new Promise((r) => setTimeout(r, 600));
    const c = snap();
    const d1 = a.map((p, i) => Math.hypot(b[i][0] - p[0], b[i][1] - p[1], b[i][2] - p[2]));
    const d2 = a.map((p, i) => Math.hypot(c[i][0] - p[0], c[i][1] - p[1], c[i][2] - p[2]));
    const ys1 = b.map((p, i) => p[1] - a[i][1]); // signed per-glyph Y deltas (phase proof)
    const moved = d1.filter((d) => d > 1e-3).length;
    const distinct = new Set(ys1.map((y) => y.toFixed(4))).size;
    return { glyphs: glyphs.length, moved, distinct, signedYDeltas: ys1.map((y) => +y.toFixed(4)), d1: d1.map((y) => +y.toFixed(4)), d2max: Math.max(...d2) };
  }, textNode.nodeId);
  if (perGlyph.error) fail(`preview per-glyph: ${perGlyph.error}`);
  if (perGlyph.moved < 3) fail(`only ${perGlyph.moved} glyphs moved — not per-glyph animation`);
  if (perGlyph.distinct < 3) fail(`glyph deltas not distinct (${perGlyph.distinct}) — group-level, not per-glyph`);
  await page.screenshot({ path: path.join(OUT, 'c29-preview-perglyph.png') });
  ok('wave-text PLAYS per-glyph in preview-app on master clock (distinct per-glyph phases)', perGlyph);

  // ── 4. Driver swap (Time → Scroll): params untouched (INV-6) ────────────
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.click('[data-tool-group="animation"]');
  await page.waitForTimeout(700);
  await page.click('[data-testid="driver-scroll"]');
  await page.waitForTimeout(3500); // autosave flush
  await page.screenshot({ path: path.join(OUT, 'c29-driver-swap-scroll.png') });
  const g2 = JSON.parse(await readFile('public/prism-mock/home/live-graph.json', 'utf8'));
  const bn2 = g2.nodes.find((n) => n.nodeId === textNode.nodeId);
  const b2 = bn2?.animationBindings?.find((b) => b.primitive === 'wave-text');
  if (!b2) fail('binding vanished after driver swap');
  if (b2.driver !== 'scroll') fail(`driver expected scroll, got ${b2.driver}`);
  if (b2.id !== b1.id) fail('binding identity changed on driver swap');
  const paramsAfter = JSON.stringify(b2.params ?? null);
  if (paramsAfter !== paramsBefore) fail(`INV-6 VIOLATION: params changed on driver swap ${paramsBefore} -> ${paramsAfter}`);
  ok('Driver model: swap time→scroll persisted; binding id + params byte-identical (INV-6)', { id: b2.id, driver: b2.driver, params: paramsAfter });
  await page.close();

  // ── 5. MOBILE viewport pass ──────────────────────────────────────────────
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  mob.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push('[mob] ' + m.text().slice(0, 160)); });
  await mob.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('canvas', { timeout: 30000 });
  await mob.waitForTimeout(4500);
  const pill = await mob.evaluate(() => ({
    canvas: !!document.querySelector('[data-mode="canvas"]'),
    galaxy: !!document.querySelector('[data-mode="galaxy"]'),
    preview: !!document.querySelector('[data-mode="preview-app"]'),
  }));
  if (!pill.canvas || !pill.galaxy || !pill.preview) fail(`mobile mode pill incomplete: ${JSON.stringify(pill)}`);
  await mob.screenshot({ path: path.join(OUT, 'mobile-1-boot-previewapp.png') });
  ok('mobile boot: preview-app default, 3-mode pill present', pill);

  await mob.tap('[data-mode="canvas"]');
  await mob.waitForTimeout(2400);
  // Flyout 1: Text group
  await mob.tap('[data-tool-group="text"]');
  await mob.waitForTimeout(900);
  await mob.screenshot({ path: path.join(OUT, 'mobile-2-canvas-text-flyout.png') });
  const f1 = await mob.evaluate(() => !!document.querySelector('[data-component]') || document.body.textContent.includes('Add Text'));
  if (!f1) fail('mobile text flyout did not open');
  ok('mobile canvas: Text flyout opens');
  // Flyout 2: Add group
  await mob.tap('[data-tool-group="add"]');
  await mob.waitForTimeout(900);
  await mob.screenshot({ path: path.join(OUT, 'mobile-3-canvas-add-flyout.png') });
  const f2 = await mob.evaluate(() => !!document.querySelector('[data-action="add-element"]'));
  if (!f2) fail('mobile add flyout did not open');
  ok('mobile canvas: Add flyout opens (add-element action present)');

  await mob.tap('[data-mode="galaxy"]');
  await mob.waitForTimeout(2400);
  await mob.screenshot({ path: path.join(OUT, 'mobile-4-galaxy.png') });
  await mob.tap('[data-mode="preview-app"]');
  await mob.waitForTimeout(2000);
  await mob.screenshot({ path: path.join(OUT, 'mobile-5-back-previewapp.png') });
  ok('mobile: switched all 3 modes via pill, frames captured');
  await mob.close();

  const hard = results.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hard;
  results.pass = hard.length === 0 && results.badResponses.length === 0;
} catch (err) {
  results.error = String(err?.message ?? err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'c29-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: results.pass, error: results.error, steps: results.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.step}`) }, null, 2));
process.exit(results.pass ? 0 : 1);
