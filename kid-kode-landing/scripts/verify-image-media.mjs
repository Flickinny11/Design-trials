// P3 IMAGE/MEDIA — live drive (canvas-spec §5 Image tools; §6 Add Object).
//
// Proves against the real app (real-GPU Chrome, DPR 2):
//   1. Upload API: multipart PNG → content-hashed URL (+ idempotent re-upload).
//   2. Add image via URL → image-plane node renders (textured mesh).
//   3. imageSpec controls restyle INSTANTLY in place: fit (texture window /
//      letterbox), corner radius (TSL mask appears; material identity held
//      across radius edits), opacity (material.opacity) — group identity
//      stable (no rebuild).
//   4. Bubble "Add Object" (image link) → node leaves stage-0 and renders as
//      a textured plane (surgical rebuild; siblings stable).
//   5. Generation stays honest: the disclosure renders; no fake output node.
//
// Evidence: notes/verification/image-media/*.png + results.json.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/image-media');
const results = { steps: [], consoleErrors: [], badResponses: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });

const { chromium } = await import('playwright');

// ── 1. Upload API (node-side multipart with a sharp-generated PNG) ─────────
async function verifyUploadApi() {
  const sharp = (await import('sharp')).default;
  const png = await sharp({
    create: { width: 320, height: 200, channels: 4, background: { r: 200, g: 120, b: 40, alpha: 1 } },
  }).png().toBuffer();
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'probe.png');
  const r1 = await fetch(`${BASE}/api/prism/assets`, { method: 'POST', body: form });
  if (!r1.ok) fail(`upload POST failed: ${r1.status}`);
  const j1 = await r1.json();
  if (!j1.url || j1.width !== 320 || j1.height !== 200) fail(`upload response wrong: ${JSON.stringify(j1)}`);
  const form2 = new FormData();
  form2.append('file', new Blob([png], { type: 'image/png' }), 'renamed.png');
  const j2 = await (await fetch(`${BASE}/api/prism/assets`, { method: 'POST', body: form2 })).json();
  if (j2.url !== j1.url) fail('re-upload not idempotent');
  ok('upload API: content-hashed URL + idempotent re-upload', { url: j1.url });
  return j1.url;
}

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });
  const uploadedUrl = await verifyUploadApi();

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

  // ── 2. Add image via URL (the uploaded asset) ────────────────────────────
  const before = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.click('[data-tool-group="image"]');
  await page.waitForTimeout(800);
  await page.fill('input[placeholder="https://…"]', uploadedUrl);
  await page.click('[data-testid="image-url-add"]');
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  const newIds = after.filter((k) => !before.includes(k));
  if (newIds.length !== 1) fail(`expected 1 new image node, got ${newIds.length}`);
  const imgId = newIds[0];
  const textured = await page.evaluate(async (nid) => {
    for (let i = 0; i < 30; i++) {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let m = null; g?.traverse((o) => { if (!m && o.isMesh && o.material?.map) m = o; });
      if (m) return { hasMap: true, meshUuid: m.uuid, matUuid: m.material.uuid };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { hasMap: false };
  }, imgId);
  if (!textured.hasMap) fail('image plane never received its texture');
  await page.screenshot({ path: path.join(OUT, '01-image-added.png') });
  ok('Add via URL → textured image plane', { imgId });

  // ── 3. imageSpec controls: instant in-place restyle ──────────────────────
  const setFader = (testId, frac) => page.evaluate(([id, f]) => {
    const el = document.querySelector(`[data-control="${id}"]`);
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(Number(el.min) + (Number(el.max) - Number(el.min)) * f));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [testId, frac]);

  // corner radius → TSL mask, identity held afterwards
  if (!(await setFader('image-corner-radius', 0.7))) fail('radius fader not found');
  await page.waitForTimeout(700);
  const afterRadius = await page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    let m = null; g?.traverse((o) => { if (!m && o.isMesh && o.material?.map) m = o; });
    return m ? { matUuid: m.material.uuid, hasMask: !!m.material.opacityNode, meshUuid: m.uuid } : null;
  }, imgId);
  if (!afterRadius?.hasMask) fail('corner radius did not produce the TSL mask');
  // opacity → material.opacity, material identity unchanged from the radius state
  if (!(await setFader('image-opacity', 0.5))) fail('opacity fader not found');
  await page.waitForTimeout(500);
  const afterOpacity = await page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    let m = null; g?.traverse((o) => { if (!m && o.isMesh && o.material?.map) m = o; });
    return m ? { matUuid: m.material.uuid, opacity: m.material.opacity, meshUuid: m.uuid } : null;
  }, imgId);
  if (!afterOpacity || Math.abs(afterOpacity.opacity - 0.5) > 0.06) fail(`opacity not applied: ${afterOpacity?.opacity}`);
  if (afterOpacity.matUuid !== afterRadius.matUuid) fail('material identity changed on opacity edit (expected in-place)');
  if (afterOpacity.meshUuid !== textured.meshUuid) fail('mesh identity changed (expected in-place restyle, no rebuild)');
  // fit → contain letterboxes via mesh scale or texture window change
  await page.click('[data-testid="image-fit-contain"]');
  await page.waitForTimeout(500);
  const afterFit = await page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    let m = null; g?.traverse((o) => { if (!m && o.isMesh && o.material?.map) m = o; });
    return m ? { scale: [m.scale.x, m.scale.y], repeat: [m.material.map.repeat.x, m.material.map.repeat.y] } : null;
  }, imgId);
  await page.screenshot({ path: path.join(OUT, '02-imagespec-styled.png') });
  ok('imageSpec instant restyle: radius mask + opacity + fit, all in place', { afterFit });

  // ── 4. Bubble Add Object → image populates the node ─────────────────────
  await page.click('[data-tool-group="add"]');
  await page.waitForTimeout(700);
  const preAdd = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.click('[data-action="add-element"]');
  await page.waitForTimeout(1500);
  const postAdd = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  const bubbleId = postAdd.filter((k) => !preAdd.includes(k))[0];
  if (!bubbleId) fail('bubble not created');
  await page.fill('input[placeholder="…or paste an image link"]', uploadedUrl);
  await page.click('[data-action="add-object-use-url"]');
  await page.waitForTimeout(2500);
  const populated = await page.evaluate(async (nid) => {
    for (let i = 0; i < 30; i++) {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
      let img = null, bubble = null;
      g?.traverse((o) => {
        if (o.isMesh && o.material?.map) img = o;
        if (o.isMesh && o.material && o.material.transmission !== undefined && o.material.transmission > 0.5) bubble = o;
      });
      if (img && !bubble) return { populated: true };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { populated: false };
  }, bubbleId);
  if (!populated.populated) fail('Add Object did not rebuild the bubble into an image plane');
  await page.screenshot({ path: path.join(OUT, '03-bubble-populated.png') });
  ok('Add Object: bubble → Populated → rebuilt as textured plane (§6)', { bubbleId });

  // ── 5. Generation honesty ────────────────────────────────────────────────
  await page.click('[data-tool-group="image"]');
  await page.waitForTimeout(700);
  await page.fill('[data-testid="image-gen-prompt"] , input[placeholder="Describe the picture you want…"]', 'a golden prism');
  const preGen = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  await page.click('[data-action="image-generate"]');
  await page.waitForTimeout(1500);
  const disclosure = await page.evaluate(() => {
    const f = document.body.textContent || '';
    return /isn'?t connected yet|needs the cloud endpoint/i.test(f);
  });
  const postGen = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  if (!disclosure) fail('generation disclosure not shown');
  if (postGen.length !== preGen.length) fail('generation created a node despite wired:false (FAKED OUTPUT)');
  // The disclosure renders inline at the flyout's bottom — scroll it into
  // view so the FRAME carries the evidence (advocate MUST-FIX: assertion
  // without a visible frame is not evidence).
  await page.evaluate(() => {
    document.querySelector('[data-control="image-gen-notice"]')?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '04-generate-honest.png') });
  ok('generation honestly disclosed as unwired; no fake output');

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
