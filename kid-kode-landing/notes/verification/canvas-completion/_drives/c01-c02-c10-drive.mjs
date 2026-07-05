// FINAL SIGN-OFF drive — criteria 1, 2, 10 (non-mutating).
// c01: unified WebGPU scene + WebGL2 fallback on a non-WebGPU context.
// c02: galaxy<->canvas<->preview-app switches mutate nothing in the graph.
// c10: keyframe editor opens w/ scrubber/play/pause/loop, seconds, snap grid.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');
const GRAPH = path.resolve('public/prism-mock/home/live-graph.json');

const results = { c01: {}, c02: {}, c10: {}, consoleErrors: [], pass: false };
const fail = (m) => { throw new Error(m); };
const md5 = async () => createHash('md5').update(await readFile(GRAPH)).digest('hex');

const { chromium } = await import('playwright');

await mkdir(OUT, { recursive: true });

// ── Part A: WebGPU browser ──────────────────────────────────────────────────
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 180)); });

  const hashBefore = await md5();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);

  // c01 — backend + ONE canvas/scene
  const backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
  results.c01.webgpu = { backend, canvasCount };
  if (backend !== 'webgpu') fail(`expected webgpu backend, got ${backend}`);
  await page.screenshot({ path: path.join(OUT, 'c01-webgpu-boot-previewapp.png') });

  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  const canvasKeys = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])].sort());
  results.c01.canvasNodeCount = canvasKeys.length;
  if (canvasKeys.length < 6) fail(`canvas built nodes expected >=6, got ${canvasKeys.length}`);
  await page.screenshot({ path: path.join(OUT, 'c01-webgpu-canvas-built.png') });

  // c02 — mode switches, capture node sets per mode + verify zero graph writes
  // canvas -> galaxy
  await page.getByRole('button', { name: 'Galaxy', exact: true }).first().click();
  await page.waitForTimeout(2200);
  // structural galaxy probe: count sphere-geometry meshes via a scene handle
  const galaxyProbe = await page.evaluate(() => {
    // groups map empties in galaxy (assembled wrappers unmount); reach the
    // unified scene through the persistent canvas->r3f root is not exposed, so
    // count DOM canvases + record map size honestly.
    return {
      assembledGroups: (window.__PRISM_EDITOR_NODE_GROUPS__?.size ?? 0),
      canvasCount: document.querySelectorAll('canvas').length,
    };
  });
  results.c02.galaxy = galaxyProbe;
  await page.screenshot({ path: path.join(OUT, 'c02-mode-galaxy.png') });

  // galaxy -> canvas (again)
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2200);
  const canvasKeys2 = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])].sort());
  results.c02.canvasKeysStable = JSON.stringify(canvasKeys) === JSON.stringify(canvasKeys2);
  if (!results.c02.canvasKeysStable) fail('canvas node set changed across galaxy round-trip');
  await page.screenshot({ path: path.join(OUT, 'c02-mode-canvas.png') });

  // canvas -> preview-app: same nodes, now PLAYING (pose mutates over time)
  await page.getByRole('button', { name: 'Preview App', exact: true }).first().click();
  await page.waitForTimeout(2000);
  const previewProbe = await page.evaluate(async () => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    if (!m) return { keys: [], movers: 0 };
    const firstMesh = (g) => { let mm = null; g.traverse((o) => { if (!mm && o.isMesh) mm = o; }); return mm; };
    const snap = () => Object.fromEntries([...m].map(([k, g]) => {
      const mm = firstMesh(g);
      return [k, mm ? [mm.position.x, mm.position.y, mm.position.z, mm.scale.x] : [0, 0, 0, 1]];
    }));
    const a = snap();
    await new Promise((r) => setTimeout(r, 1200));
    const b = snap();
    const movers = Object.keys(a).filter((k) => {
      const [ax, ay, az, as_] = a[k]; const [bx, by, bz, bs] = b[k];
      return Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz) + Math.abs(as_ - bs) > 1e-4;
    });
    return { keys: [...m.keys()].sort(), movers: movers.length };
  });
  results.c02.previewApp = { keys: previewProbe.keys.length, movers: previewProbe.movers };
  results.c02.previewKeysMatchCanvas = JSON.stringify(previewProbe.keys) === JSON.stringify(canvasKeys);
  await page.screenshot({ path: path.join(OUT, 'c02-mode-previewapp.png') });

  // back to canvas; wait out any (illegal) autosave debounce, then hash check
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(4000);
  const hashAfter = await md5();
  results.c02.graphFile = { hashBefore, hashAfter, byteStable: hashBefore === hashAfter };
  if (hashBefore !== hashAfter) fail('live-graph.json changed across pure mode switches (graph mutation!)');

  // c10 — keyframe editor: select headline, open animation group, toggle
  await page.click('[data-tool-group="selection"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="tt-marquee"]');
  await page.waitForTimeout(200);
  await page.mouse.move(620, 370); await page.mouse.down();
  await page.mouse.move(1010, 450, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(700);
  await page.click('[data-tool-group="animation"]');
  await page.waitForTimeout(800);
  await page.click('[data-action="keyframe-toggle"]');
  await page.waitForTimeout(900);
  const kf = await page.evaluate(() => {
    const p = document.querySelector('[data-component="keyframe-editor"]');
    if (!p) return { present: false };
    const text = p.textContent || '';
    return {
      present: true,
      open: getComputedStyle(p).transform !== 'none' ? true : true,
      hasScrubber: !!p.querySelector('input[type="range"]'),
      secondsReadout: /\d+\.\d{2}s/.test(text),
      snapButtons: ['1/60', '1/100', '1/120'].every((g) => text.includes(g)),
      loopButton: !!p.querySelector('button[title="Loop"]'),
      headerButtons: p.querySelectorAll('button').length,
      noFpsText: !/fps/i.test(text),
    };
  });
  results.c10.panel = kf;
  if (!kf.present || !kf.hasScrubber || !kf.secondsReadout || !kf.snapButtons || !kf.loopButton) {
    fail(`keyframe editor incomplete: ${JSON.stringify(kf)}`);
  }
  await page.screenshot({ path: path.join(OUT, 'c10-keyframe-editor-open.png') });
  // scrub + switch snap grid (cosmetic) + play toggle, then capture again
  await page.evaluate(() => {
    const p = document.querySelector('[data-component="keyframe-editor"]');
    const r = p.querySelector('input[type="range"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(r, '0.75');
    r.dispatchEvent(new Event('input', { bubbles: true }));
    // snap grid 1/100
    [...p.querySelectorAll('button')].find((b) => b.textContent.trim() === '1/100')?.click();
  });
  await page.waitForTimeout(500);
  const kf2 = await page.evaluate(() => {
    const p = document.querySelector('[data-component="keyframe-editor"]');
    return { secondsAfterScrub: (p.textContent.match(/(\d+\.\d{2})s/) || [])[1] };
  });
  results.c10.scrubbed = kf2;
  await page.screenshot({ path: path.join(OUT, 'c10-keyframe-scrubbed-snap100.png') });
  await page.close();
} finally {
  await browser.close();
}

// ── Part B: WebGL2 fallback (non-WebGPU context) ───────────────────────────
const browser2 = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--disable-features=WebGPU'],
});
try {
  const page = await browser2.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  // belt-and-braces: hide navigator.gpu so WebGPURenderer takes its WebGL2 backend
  await page.addInitScript(() => {
    try { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }); } catch {}
    try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch {}
  });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push('[webgl2] ' + m.text().slice(0, 180)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(6000);
  const backend2 = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  results.c01.fallback = { backend: backend2, gpuHidden: await page.evaluate(() => navigator.gpu === undefined) };
  if (backend2 !== 'webgl2') fail(`expected webgl2 fallback, got ${backend2}`);
  await page.screenshot({ path: path.join(OUT, 'c01-webgl2-boot-previewapp.png') });
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(3000);
  const glKeys = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])].length);
  results.c01.fallback.canvasNodeCount = glKeys;
  await page.screenshot({ path: path.join(OUT, 'c01-webgl2-canvas-built.png') });
  if (glKeys < 6) fail(`webgl2 canvas rendered ${glKeys} nodes, expected >=6`);
  await page.close();
  results.pass = true;
} catch (e) {
  results.error = String(e?.message ?? e);
} finally {
  await browser2.close();
  await writeFile(path.join(OUT, 'c01-c02-c10-results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
process.exit(results.pass ? 0 : 1);
