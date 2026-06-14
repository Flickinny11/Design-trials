// verify-text-3d.mjs — real-GPU capture harness for TRUE 3D extruded text.
//
// Drives the REAL editor (canvas mode) via the __PRISM_DEBUG_STORES__ bridge +
// the real Save / Save-and-Rebuild buttons (the same path the Inspector "3D"
// toggle will use), then reorients the REAL mounted extruded mesh
// (__PRISM_EDITOR_NODE_GROUPS__) to photograph genuine depth + sides + shadow.
// Real Chrome, hardware Metal GPU / WebGPU, deviceScaleFactor 2 (Retina). NOT
// DOM-scraping: every datum is a real rendered frame off the real GPU plus
// scene-graph geometry measurements.
//
// Usage: node scripts/verify-text-3d.mjs [--spec=path.json] [--label=name] [--reuse]
//   spec JSON: { textSpec, rotations:[{label,x,y},...] }

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const LABEL = arg('label', 'hero');
const OUT = join(repoRoot, 'notes', 'verification', 'text-3d', LABEL);
mkdirSync(OUT, { recursive: true });
const PORT = parseInt(arg('port', '4811'), 10);
const BASE = `http://localhost:${PORT}`;
const REUSE = flag('reuse');

// Default WOW demo spec (overridable via --spec=path.json).
const DEFAULT = {
  textSpec: {
    content: 'PRISM',
    fontFamily: 'Inter',
    fontSize: 0.62,
    fontWeight: 700,
    align: 'center',
    fill: { kind: 'solid', color: '#f0c46a' },
    extrude: {
      enabled: true,
      depth: 0.32,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 3,
      curveSegments: 12,
      metalness: 0.55,
      roughness: 0.28,
    },
  },
  rotations: [
    { label: 'hero-3q', x: -0.14, y: 0.6 },
    { label: 'front', x: 0, y: 0 },
    { label: 'profile', x: -0.05, y: 1.15 },
  ],
};
const specPath = arg('spec', '');
const CFG = specPath && existsSync(specPath) ? JSON.parse(readFileSync(specPath, 'utf8')) : DEFAULT;

async function waitFor(u, ms = 150000) { const s = Date.now(); while (Date.now() - s < ms) { try { const r = await fetch(u); if (r.ok || r.status === 404) return true; } catch {} await new Promise((r) => setTimeout(r, 500)); } return false; }

let server = null;
if (!REUSE) {
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
}
let log = ''; if (server) { server.stdout.on('data', (b) => (log += b)); server.stderr.on('data', (b) => (log += b)); }
const report = { label: LABEL, startedAt: new Date().toISOString(), backend: null, frames: [], probe: null, consoleErrors: [], networkErrors: [], ok: false };

try {
  if (!(await waitFor(BASE))) throw new Error('server down\n' + log.slice(-1200));
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 880 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => report.consoleErrors.push('pageerror: ' + e.message));
  page.on('response', (res) => { if (res.status() >= 400) report.networkErrors.push(`${res.status()} ${res.url()}`); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await page.waitForSelector('canvas', { timeout: 120000 });
  await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__ && !!window.__PRISM_EDITOR_NODE_GROUPS__, { timeout: 90000 });
  await page.waitForTimeout(4500);
  report.backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');

  // Canvas mode + Add Text.
  await page.getByRole('button', { name: 'Canvas', exact: true }).click().catch(() => {});
  await page.waitForTimeout(1800);
  await page.click('[data-tool-group="text"]').catch(() => {});
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() || [])]);
  await page.getByRole('button', { name: /Add Text/ }).click();
  await page.waitForTimeout(1500);
  const nodeId = await page.evaluate((b) => {
    const m = window.__PRISM_EDITOR_NODE_GROUPS__;
    const fresh = [...m.keys()].filter((k) => !b.includes(k));
    for (const id of (fresh.length ? fresh : [...m.keys()])) {
      let has = false; m.get(id).traverse((o) => { if (o.userData?.textHandle) has = true; });
      if (has) return id;
    }
    return null;
  }, before);
  if (!nodeId) throw new Error('no text node added');
  report.nodeId = nodeId;

  // Select + open Inspector, then preview-edit the textSpec (extrude on), Save,
  // Save-and-Rebuild (re-invokes createNode → factory dispatches to the 3D
  // builder). This is the authentic geometry-kind-change path (RA-16).
  await page.evaluate((id) => { const s = window.__PRISM_DEBUG_STORES__; s.graphEditor.getState().selectNode(id); s.graphEditor.getState().openInspector(); }, nodeId);
  await page.waitForTimeout(600);
  await page.evaluate(({ id, spec }) => {
    const s = window.__PRISM_DEBUG_STORES__;
    const n = s.graphSource.getState().nodes.find((x) => x.nodeId === id);
    s.previewState.getState().set(id, { textSpec: { ...(n.textSpec || {}), ...spec } });
  }, { id: nodeId, spec: CFG.textSpec });
  await page.waitForTimeout(400);
  await page.click('[data-role="save"]').catch(() => {});
  await page.waitForTimeout(500);
  await page.click('[data-role="save-and-rebuild"]').catch(() => {});

  // Wait for the extruded mesh to mount (outline fetch is async).
  const mounted = await page.waitForFunction((id) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id);
    if (!g) return false;
    let ok = false;
    g.traverse((o) => { if (o.isMesh && o.material?.userData?.text3d) ok = true; });
    return ok;
  }, nodeId, { timeout: 30000 }).then(() => true).catch(() => false);
  report.mounted3d = mounted;
  await page.waitForTimeout(1500);

  // Scene-graph geometry probe — proves REAL extrusion (z-depth > 0).
  report.probe = await page.evaluate((id) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__.get(id);
    let glyphs = 0, maxZ = 0, faceFill = null, is3d = false;
    g.traverse((o) => {
      if (o.isMesh && /^glyph-\d+$/.test(o.name)) {
        glyphs++;
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        maxZ = Math.max(maxZ, bb.max.z - bb.min.z);
        if (o.material?.userData?.text3d) { is3d = true; faceFill = o.material.userData.text3dFaceFill; }
      }
    });
    return { glyphs, depthZ: +maxZ.toFixed(4), is3d, faceFill, castShadow: (() => { let c = false; g.traverse((o) => { if (o.isMesh && o.castShadow) c = true; }); return c; })() };
  }, nodeId);

  // Capture each rotation — reorient the REAL mounted group (honest: same mesh).
  for (const rot of (CFG.rotations || DEFAULT.rotations)) {
    await page.evaluate(({ id, x, y }) => {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__.get(id);
      g.rotation.set(x, y, 0);
    }, { id: nodeId, x: rot.x, y: rot.y });
    await page.waitForTimeout(900);
    const f = `${rot.label}.png`;
    await page.screenshot({ path: join(OUT, f) });
    // zoomed crop for DPR-2 sharpness scrutiny (center of canvas).
    const cf = `${rot.label}-crop.png`;
    await page.screenshot({ path: join(OUT, cf), clip: { x: 360, y: 230, width: 560, height: 420 } });
    report.frames.push({ rot: rot.label, file: f, crop: cf });
  }

  report.consoleErrors = report.consoleErrors.filter((t) => !/DevTools|Download the React/.test(t)).slice(0, 12);
  report.ok = mounted && report.probe.is3d && report.probe.depthZ > 0.01 && report.probe.glyphs >= 3;
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: LABEL, backend: report.backend, ...report.probe, frames: report.frames.length, errs: report.consoleErrors.length, ok: report.ok }, null, 2));
  await browser.close();
} catch (e) {
  report.fatal = String(e && e.message || e);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.error('FATAL', report.fatal);
} finally {
  if (server) server.kill('SIGTERM');
}
process.exit(0);
