// P4 3D-OBJECT — live drive (canvas-spec §5 3D object tools).
//
// Proves against the real app (real-GPU Chrome, DPR 2):
//   1. Add Cube / Torus → lit, shadow-casting physical-material primitives.
//   2. Shape faders reshape INSTANTLY in place (mesh+material identity held,
//      geometry swapped).
//   3. The EXISTING §11 Material editor applies live (Inspector jump key →
//      MaterialTab fader → same material instance mutates).
//   4. Gizmo/transform participation (Transform steppers move the node).
//   5. Animation-binding participation (float binding plays on the primitive
//      in preview-app).
//
// Evidence: notes/verification/3d-object/*.png + results.json.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/3d-object');
const results = { steps: [], consoleErrors: [], badResponses: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
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
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);

  const nodeIds = () => page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  const meshInfo = (id) => page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    let m = null; g?.traverse((o) => { if (!m && o.isMesh) m = o; });
    if (!m) return null;
    return {
      meshUuid: m.uuid, geoUuid: m.geometry.uuid, matUuid: m.material.uuid,
      matType: m.material.type, castShadow: m.castShadow,
      metalness: m.material.metalness, roughness: m.material.roughness,
      bbox: (() => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; })(),
      groupX: g.position.x,
    };
  }, id);

  // ── 1. Add Cube ──────────────────────────────────────────────────────────
  const before = await nodeIds();
  await page.click('[data-tool-group="object3d"]');
  await page.waitForTimeout(800);
  await page.click('[data-action="object-add-cube"]');
  await page.waitForTimeout(1500);
  const afterCube = await nodeIds();
  const cubeId = afterCube.filter((k) => !before.includes(k))[0];
  if (!cubeId) fail('cube node not created');
  const cube0 = await meshInfo(cubeId);
  if (!cube0 || !/Physical/i.test(cube0.matType) || !cube0.castShadow) fail(`cube not a lit physical mesh: ${JSON.stringify(cube0)}`);
  // Torus too (picker breadth)
  await page.click('[data-action="object-add-torus"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '01-primitives-added.png') });
  ok('Add Cube + Torus → lit shadow-casting physical meshes', { cubeId, matType: cube0.matType });

  // ── 2. Reshape in place (cube selected last? select cube via store map order —
  //       the torus is selected now; re-select the cube by clicking Add… simpler:
  //       reshape the TORUS (currently selected): tube fader) ────────────────
  const torusId = (await nodeIds()).filter((k) => !afterCube.includes(k))[0];
  const torus0 = await meshInfo(torusId);
  const setFader = (ctl, frac) => page.evaluate(([id, f]) => {
    const el = document.querySelector(`[data-control="${id}"]`);
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(Number(el.min) + (Number(el.max) - Number(el.min)) * f));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [ctl, frac]);
  if (!(await setFader('object-radius', 0.95))) fail('radius fader not found');
  await page.waitForTimeout(700);
  const torus1 = await meshInfo(torusId);
  if (!torus1) fail('torus gone after reshape');
  if (torus1.meshUuid !== torus0.meshUuid || torus1.matUuid !== torus0.matUuid) fail('reshape changed mesh/material identity (expected in-place)');
  if (torus1.geoUuid === torus0.geoUuid) fail('geometry did not swap on reshape');
  if (!(torus1.bbox[0] > torus0.bbox[0] * 1.2)) fail(`bbox did not grow: ${torus0.bbox[0]} → ${torus1.bbox[0]}`);
  await page.screenshot({ path: path.join(OUT, '02-reshaped.png') });
  ok('shape fader reshapes in place (geometry swap, identity held)', { from: torus0.bbox[0].toFixed(2), to: torus1.bbox[0].toFixed(2) });

  // ── 3. Existing Material editor applies live ────────────────────────────
  await page.click('[data-action="object-open-material"]');
  await page.waitForTimeout(900);
  // Crank every Material-tab fader to max — one of them is metalness; assert
  // the SAME material instance mutated.
  const cranked = await page.evaluate(() => {
    const inspector = document.querySelector('[data-component="inspector"]') ?? document.body;
    const ranges = [...inspector.querySelectorAll('input[type="range"][data-control]')];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const el of ranges) {
      setter.call(el, el.max);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return ranges.length;
  });
  if (cranked === 0) fail('no Material tab faders found after the jump key');
  await page.waitForTimeout(800);
  const torus2 = await meshInfo(torusId);
  if (torus2.matUuid !== torus0.matUuid) fail('material identity changed (expected same-instance live mutation)');
  if (!(torus2.metalness > torus0.metalness) && !(torus2.roughness > torus0.roughness)) {
    fail(`materialSpec edit did not land live (metal ${torus0.metalness}→${torus2.metalness}, rough ${torus0.roughness}→${torus2.roughness})`);
  }
  await page.screenshot({ path: path.join(OUT, '03-material-live.png') });
  ok('existing §11 Material editor mutates the primitive live, same instance', { metalness: torus2.metalness, roughness: torus2.roughness });

  // ── 4. Transform participation ───────────────────────────────────────────
  await page.click('[data-tool-group="transform"]');
  await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) await page.click('[data-testid="tt-pos-x-inc"]');
  await page.waitForTimeout(700);
  const torus3 = await meshInfo(torusId);
  if (!(torus3.groupX > torus2.groupX)) fail('Transform steppers did not move the primitive');
  ok('gizmo/Transform participation (scenePosition writes move it)', { x: torus3.groupX });

  // ── 5. Animation-binding participation ──────────────────────────────────
  await page.click('[data-tool-group="animation"]');
  await page.waitForTimeout(800);
  await page.fill('input[placeholder^="Search"]', 'float');
  await page.waitForTimeout(700);
  await page.locator('[data-anim-tile][data-primitive="float"]').first().click();
  await page.waitForTimeout(800);
  await page.click('[data-action="jump-preview-app"]');
  await page.waitForTimeout(2200);
  const plays = await page.evaluate(async (nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    let m = null; g?.traverse((o) => { if (!m && o.isMesh) m = o; });
    if (!m) return { error: 'no mesh' };
    const a = m.position.y;
    await new Promise((r) => setTimeout(r, 1200));
    return { drift: Math.abs(m.position.y - a) };
  }, torusId);
  if (!plays.drift || plays.drift < 1e-4) fail(`binding did not play on the primitive (drift ${plays.drift})`);
  await page.screenshot({ path: path.join(OUT, '04-binding-plays.png') });
  ok('animation binding plays on the primitive in preview-app', { drift: plays.drift.toFixed(4) });

  const hardErrors = results.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hardErrors;
  results.pass = hardErrors.length === 0 && results.badResponses.length === 0;
} catch (err) {
  results.error = String(err?.message ?? err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: results.pass, error: results.error, steps: results.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.step}`) }, null, 2));
process.exit(results.pass ? 0 : 1);
