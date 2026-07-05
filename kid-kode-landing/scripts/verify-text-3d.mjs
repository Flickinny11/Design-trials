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

  // Optional: REAL fal prompt→texture, poured onto the 3D faces (--ai="prompt").
  const aiPrompt = arg('ai', '');
  if (aiPrompt) {
    const gen = await page.evaluate(async (p) => {
      try {
        const r = await fetch('/api/prism/text-fill', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: p, count: 4 }),
        });
        return await r.json();
      } catch (e) { return { error: String(e && e.message || e) }; }
    }, aiPrompt);
    report.ai = {
      prompt: aiPrompt,
      wired: gen?.wired === true,
      count: Array.isArray(gen?.suggestions) ? gen.suggestions.length : 0,
      firstUrl: gen?.suggestions?.[0]?.url ?? null,
      error: gen?.error ?? null,
    };
    if (gen?.wired && gen.suggestions?.length) {
      CFG.textSpec = { ...CFG.textSpec, fill: { kind: 'ai-texture', prompt: aiPrompt, url: gen.suggestions[0].url } };
    }
  }

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

  // Capture the AI-fill preview strip — the user's OWN text rendered in TRUE 3D
  // per candidate (LOGAN-INBOX backlog). Procedural candidates suffice to prove
  // the 3D-strip render (no fal needed); --ai additionally shows generated ones.
  if (aiPrompt || flag('strip')) {
    await page.evaluate((id) => { window.__PRISM_EDITOR_NODE_GROUPS__.get(id)?.rotation.set(0, 0, 0); }, nodeId).catch(() => {});
    // Open the Text flyout ONLY if it isn't rendered at all (count===0). Don't
    // use isVisible — the AI chip is often just scrolled out of the long flyout,
    // and re-clicking the group would TOGGLE IT CLOSED.
    const chipCount = await page.locator('[data-testid="fill-kind-ai"]').count();
    if (chipCount === 0) { await page.click('[data-tool-group="text"]').catch(() => {}); await page.waitForTimeout(700); }
    const chip = page.locator('[data-testid="fill-kind-ai"]').first();
    await chip.scrollIntoViewIfNeeded().catch(() => {});
    await chip.click().catch(() => {});
    await page.waitForTimeout(800);
    const strip = page.locator('[data-component="ai-fill-suggestions"]').first();
    await strip.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(3500); // 3D previews build + intro sway
    report.stripFound = await strip.count();
    await strip.screenshot({ path: join(OUT, 'ai-fill-strip.png') })
      .catch(async () => { await page.screenshot({ path: join(OUT, 'ai-fill-strip.png') }); });
    report.frames.push({ rot: 'ai-fill-strip', file: 'ai-fill-strip.png' });
  }

  // UI evidence (P2 gallery + P6 controls): open the Text flyout and capture
  // the font preview gallery + the new 3D / style / shadow controls.
  if (flag('ui')) {
    await page.evaluate((id) => { window.__PRISM_EDITOR_NODE_GROUPS__.get(id)?.rotation.set(0, 0, 0); }, nodeId).catch(() => {});
    if ((await page.locator('[data-testid="text-3d-on"]').count()) === 0) {
      await page.click('[data-tool-group="text"]').catch(() => {});
      await page.waitForTimeout(800);
    }
    // Flyout top: font preview gallery + content + style flags.
    await page.locator('[data-control="text-content"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, 'ui-flyout-top.png') });
    // Open the font preview gallery — each family rendered IN ITS OWN FACE.
    await page.click('[data-action="font-picker-toggle"]').catch(() => {});
    await page.waitForTimeout(2800); // visible-row Google webfonts swap in
    await page.locator('[data-component="font-picker-gallery"]').first()
      .screenshot({ path: join(OUT, 'ui-font-gallery.png') })
      .catch(async () => { await page.screenshot({ path: join(OUT, 'ui-font-gallery.png') }); });
    report.frames.push({ rot: 'ui-font-gallery', file: 'ui-font-gallery.png' });
    await page.click('[data-action="font-picker-toggle"]').catch(() => {}); // collapse
    // 3D controls section (Extrude toggle, depth, bevel, material, side).
    await page.locator('[data-testid="text-3d-on"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, 'ui-3d-controls.png') });
    report.frames.push({ rot: 'ui-flyout-top', file: 'ui-flyout-top.png' }, { rot: 'ui-3d-controls', file: 'ui-3d-controls.png' });
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
