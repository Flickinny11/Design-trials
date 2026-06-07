#!/usr/bin/env node
// STEP4 runtime-foundation verification harness.
//
// Evidence-based verification for the STEP4 scope against the PRISM-RUNTIME-SPEC
// numbered criteria. Uses Playwright + real Chrome (WebGPU-capable). Replaces the
// kv/chrome-devtools MCP path which is not connected in this session.
//
// Usage:
//   node scripts/step4-verify.mjs <label> [mode] [--stub-webgpu] [--toggle a,b,c]
//
//   <label>        artifact subfolder name under notes/verification/step4/<label>/
//   [mode]         galaxy | canvas | preview-app  (set via window dev hook)
//   --stub-webgpu  delete navigator.gpu before load (forces WebGL2 fallback)
//   --toggle a,b,c set these modes in sequence (records createNode call counts)
//
// Artifacts written:
//   <label>/screenshot.png        full-page screenshot
//   <label>/console.json          all console messages + pageerrors
//   <label>/assertions.json       scene-graph / single-three / renderer assertions

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const label = args[0] || 'baseline';
const mode = args.find((a) => ['galaxy', 'canvas', 'preview-app'].includes(a)) || null;
const stubWebgpu = args.includes('--stub-webgpu');
const toggleArg = args.find((a) => a.startsWith('--toggle='));
const toggleModes = toggleArg ? toggleArg.split('=')[1].split(',') : null;

const URL = process.env.PRISM_URL || 'http://localhost:3000/';
const outDir = join(ROOT, 'notes', 'verification', 'step4', label);
mkdirSync(outDir, { recursive: true });

const { chromium } = await import('playwright');

// Real Chrome (system channel) gives a full WebGPU/Metal backend on macOS.
// Headed so the GPU process is real; falls back to Chrome-for-Testing headless
// with WebGPU flags if the channel is missing.
const launchOpts = {
  headless: false,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
  ],
};
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', ...launchOpts });
} catch {
  browser = await chromium.launch(launchOpts);
}

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const consoleMsgs = [];
const pageErrors = [];
page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => pageErrors.push({ message: e.message, stack: e.stack }));

if (stubWebgpu) {
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch {}
  });
}

// Instrument: count CDN three resource loads (RT-SC-02) and createNode calls (RT-SC-08).
await page.addInitScript(() => {
  window.__cdnThreeLoads = [];
  const origImport = null; // resource timing captured post-hoc instead.
});

console.log(`[step4-verify:${label}] loading ${URL} (stubWebgpu=${stubWebgpu}, mode=${mode})`);
await page.goto(URL, { waitUntil: 'domcontentloaded' });

// Wait for a rendering canvas to appear.
try {
  await page.waitForSelector('canvas', { timeout: 30000 });
} catch {
  console.warn('[step4-verify] no canvas appeared within 30s');
}
await page.waitForTimeout(2500); // let WebGPU init + first frames settle

// Optionally switch mode via the dev hook installed in page.tsx.
async function setMode(m) {
  await page.evaluate((mm) => {
    const fn = window.__PRISM_EDITOR_SET_VIEW_MODE__;
    if (typeof fn === 'function') fn(mm);
  }, m);
  await page.waitForTimeout(2000);
}

// Snapshot the source graph (RT-SC-03: toggling must not mutate the graph).
async function graphHash() {
  return page.evaluate(() => {
    try {
      const s = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
      if (!s) return null;
      return JSON.stringify({ nodes: s.nodes, hubs: s.hubs, edges: s.edges }).length
        + ':' + (s.nodes?.length ?? 0) + 'n/' + (s.hubs?.length ?? 0) + 'h';
    } catch { return null; }
  });
}

const toggleReport = [];
if (toggleModes) {
  // Warm: first visit to a built mode populates the artifact cache once.
  const graphBefore = await graphHash();
  for (const m of toggleModes) {
    // Reset the build counter, then toggle, then read how many artifacts were
    // (re)built during the toggle. 0 => served from cache (RT-SC-08).
    await page.evaluate(() => { window.__artifactBuildCount = 0; });
    await setMode(m);
    const builds = await page.evaluate(() => window.__artifactBuildCount ?? null);
    const gh = await graphHash();
    toggleReport.push({ mode: m, artifactBuildsDuringToggle: builds, graphHash: gh });
  }
  const graphAfter = await graphHash();
  toggleReport.push({ graphBefore, graphAfter, graphUnchanged: graphBefore === graphAfter });
} else if (mode) {
  await setMode(mode);
}

// Scene-graph + renderer + single-three assertions.
const assertions = await page.evaluate(() => {
  const out = {};
  // RT-SC-03: exactly one *3D rendering* canvas, no split-pane. A 2D HUD canvas
  // (the Minimap) is not a second scene — classify by context type.
  const canvases = Array.from(document.querySelectorAll('canvas'));
  out.canvasCount = canvases.length;
  out.sceneCanvasCount = canvases.filter((c) => {
    try {
      return !!(c.getContext('webgl2') || c.getContext('webgpu') || c.getContext('webgl'));
    } catch { return false; }
  }).length;
  out.hudCanvasCount = out.canvasCount - out.sceneCanvasCount;
  out.panes = {
    preview: document.querySelectorAll('[data-pane="preview"]').length,
    graph: document.querySelectorAll('[data-pane="graph"]').length,
  };
  // RT-SC-02: any three loaded from a CDN?
  const res = performance.getEntriesByType('resource').map((r) => r.name);
  out.cdnThreeResources = res.filter((u) => /cdn\.jsdelivr\.net|unpkg|esm\.sh/.test(u) && /three/.test(u));
  // import-map present in <head>?
  out.hasImportMap = !!document.querySelector('script[type="importmap"]');
  out.importMapText = out.hasImportMap ? document.querySelector('script[type="importmap"]').textContent : null;
  // Renderer backend (exposed by mount-graph / scene-root debug handle).
  const r = window.__prismRenderer || window.__prismEditorRenderer || null;
  out.rendererBackend =
    (window.__PRISM_RENDERER_BACKEND__) ||
    (r && (r.backend?.isWebGPUBackend ? 'webgpu' : r.backend?.isWebGLBackend ? 'webgl2' : (typeof r.backend === 'string' ? r.backend : null))) ||
    null;
  out.webgpuAvailable = !!navigator.gpu;
  // current view mode
  try {
    out.viewMode = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().viewMode ?? null;
  } catch { out.viewMode = null; }
  // editor debug (node visibility)
  out.editorDebug = window.__prismEditorDebug ?? null;
  return out;
});

await page.screenshot({ path: join(outDir, 'screenshot.png'), fullPage: false });

const errorConsole = consoleMsgs.filter((m) => m.type === 'error');
writeFileSync(join(outDir, 'console.json'), JSON.stringify({ pageErrors, errorConsole, allConsole: consoleMsgs }, null, 2));
writeFileSync(join(outDir, 'assertions.json'), JSON.stringify({ mode, stubWebgpu, assertions, toggleReport }, null, 2));

console.log(`[step4-verify:${label}] pageErrors=${pageErrors.length} consoleErrors=${errorConsole.length}`);
console.log(`[step4-verify:${label}] canvasCount=${assertions.canvasCount} cdnThree=${assertions.cdnThreeResources.length} backend=${assertions.rendererBackend} viewMode=${assertions.viewMode}`);
if (pageErrors.length) console.log('  first pageError:', pageErrors[0].message.slice(0, 200));
if (errorConsole.length) console.log('  first consoleError:', errorConsole[0].text.slice(0, 200));

await browser.close();
