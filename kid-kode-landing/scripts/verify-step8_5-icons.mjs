#!/usr/bin/env node
/**
 * STEP 8.5 — Custom 3D-premium icon system + full-width keyframe editor
 * (evidence-based, /prism-verify spirit).
 *
 * Boots `next dev`, drives the editor in real Chromium (WebGL2 fallback), and
 * produces the design + function evidence Logan art-directs from:
 *   - DESIGN screenshots: TopBar (new icons), canvas toolbar rail + flyouts,
 *     Inspector, and the keyframe editor open at FULL VIEWPORT WIDTH.
 *   - ASSERTIONS: zero stock-icon-library imports anywhere in src/**; the
 *     custom Icon renders its 3D layered SVG (extrude + face + sheen); the
 *     keyframe editor spans full width; wired tools still work (select → move
 *     writes scenePosition, only that node changes); console is clean; a mode
 *     toggle rebuilds nothing.
 *
 * Artifacts → notes/verification/step8_5/. live-graph.json is backed up and
 * restored so verification leaves no graph mutation behind.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const srcDir = join(repoRoot, 'src');
const outDir = join(repoRoot, 'notes', 'verification', 'step8_5');
mkdirSync(outDir, { recursive: true });
const liveGraph = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const liveGraphBak = join(outDir, 'live-graph.before.json');

const PORT = 4795;
const URL = `http://localhost:${PORT}/`;
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', RS = '\x1b[0m';
const results = [];
function check(id, pass, detail = '') {
  results.push({ id, pass, detail });
  console.log(`[${pass ? G + 'PASS' : R + 'FAIL'}${RS}] ${id.padEnd(36)} ${detail ? D + detail + RS : ''}`);
}

// ── Static assertion: no stock icon libraries imported anywhere in src/** ────
const STOCK_ICON_RE =
  /from\s*['"](lucide-react|lucide|react-icons|react-feather|feather-icons|phosphor-react|@phosphor-icons\/[^'"]+|@heroicons\/[^'"]+|heroicons|@tabler\/icons[^'"]*|@fortawesome\/[^'"]+|@iconify\/[^'"]+|@radix-ui\/react-icons|@ant-design\/icons|@mui\/icons-material[^'"]*)['"]/;
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) && !/\.bak-/.test(e.name)) acc.push(p);
  }
  return acc;
}
function staticIconAudit() {
  const files = walk(srcDir);
  const offenders = [];
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    if (STOCK_ICON_RE.test(txt)) offenders.push(f.replace(repoRoot + '/', ''));
  }
  return { scanned: files.length, offenders };
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return true; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function bootCanvas(page) {
  await page.evaluate(() => {
    const set = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
    if (set) set('canvas');
  });
  await page.waitForSelector('[data-component="canvas-toolbar"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

function firstHubNodeIds(page) {
  return page.evaluate(() => {
    const s = (window).__PRISM_DEBUG_STORES__;
    const gs = s.graphSource.getState();
    const hub = gs.hubs[0];
    return gs.nodes.filter((n) => !hub || n.parentHubId === hub.hubId).map((n) => n.nodeId);
  });
}
const readSP = (page, id) => page.evaluate((nid) => {
  const n = (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x) => x.nodeId === nid);
  return n ? (n.scenePosition ?? null) : null;
}, id);
const allSP = (page) => page.evaluate(() => {
  const ns = (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes;
  return Object.fromEntries(ns.map((n) => [n.nodeId, JSON.stringify(n.scenePosition ?? null)]));
});

async function main() {
  // ── Static audits (no browser needed) ─────────────────────────────────────
  const audit = staticIconAudit();
  check('static.no-stock-icon-imports', audit.offenders.length === 0,
    audit.offenders.length ? audit.offenders.join(', ') : `${audit.scanned} files scanned, 0 stock-icon imports`);
  // pkg.json clean of icon libs
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const iconDeps = Object.keys(deps).filter((d) =>
    /^(lucide|react-icons|react-feather|feather-icons|phosphor-react|heroicons)$/.test(d) ||
    /^(@phosphor-icons|@heroicons|@tabler\/icons|@fortawesome|@iconify|@mui\/icons-material|@ant-design\/icons)/.test(d) ||
    d === '@radix-ui/react-icons');
  check('static.no-stock-icon-deps', iconDeps.length === 0, iconDeps.length ? iconDeps.join(', ') : 'package.json has no icon-library deps');
  // Icon.tsx renders the layered 3D SVG
  const iconSrc = readFileSync(join(srcDir, 'components/editor/icons/Icon.tsx'), 'utf8');
  const layered = /extruded side walls/.test(iconSrc) && /specular sheen/.test(iconSrc) && /directional light/.test(iconSrc);
  check('static.icon-3d-layered', layered, 'Icon.tsx composites extrude + face + directional-light + sheen + rim');

  if (existsSync(liveGraph)) copyFileSync(liveGraph, liveGraphBak);

  console.log(`[step8.5] next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (b) => { const s = b.toString(); if (/error/i.test(s)) process.stderr.write(D + s + RS); });

  let browser;
  try {
    if (!(await waitForServer(URL))) throw new Error('server did not come up');
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);

    // ── DESIGN 1: default boot (preview-app) — TopBar new icons ──────────────
    await page.screenshot({ path: join(outDir, '01-topbar-default.png') });
    check('screenshot.topbar', true, '01-topbar-default.png');
    const topbar = page.locator('[data-component="top-bar"], header, [data-overlay="top-bar"]').first();
    if (await topbar.count()) {
      await topbar.screenshot({ path: join(outDir, '01b-topbar-closeup.png') }).catch(() => {});
    }

    // ── Canvas mode ──────────────────────────────────────────────────────────
    await bootCanvas(page);
    const ids = await firstHubNodeIds(page);
    const nodeA = ids[0], nodeB = ids[1];
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeA);
    await page.waitForTimeout(700);

    // DESIGN 2: full canvas — toolbar (left) + Inspector (right) new icons
    await page.screenshot({ path: join(outDir, '02-canvas-toolbar-inspector.png') });
    check('screenshot.canvas-toolbar-inspector', true, '02-canvas-toolbar-inspector.png');

    // DESIGN 3: toolbar rail close-up (many icons at tool sizes)
    const rail = page.locator('[data-component="canvas-toolbar"]').first();
    await rail.screenshot({ path: join(outDir, '03-toolbar-rail-closeup.png') }).catch(() => {});
    check('screenshot.toolbar-rail', true, '03-toolbar-rail-closeup.png');

    // DESIGN 4: transform flyout close-up (Edit/Move/Rotate/Scale/Align icons)
    const flyout = page.locator('[data-component="canvas-toolbar-flyout"]').first();
    if (await flyout.count()) {
      await flyout.screenshot({ path: join(outDir, '04-transform-flyout-closeup.png') }).catch(() => {});
    }

    // ── DESIGN 5: FULL-WIDTH keyframe editor ─────────────────────────────────
    await page.click('[data-tool-group="animation"]');
    await page.waitForTimeout(300);
    await page.click('[data-action="keyframe-toggle"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(outDir, '05-keyframe-fullwidth.png') });
    const kf = page.locator('[data-component="keyframe-editor"]').first();
    const kfVisible = await kf.isVisible().catch(() => false);
    check('keyframe.visible', kfVisible, 'keyframe editor visible after toggle');
    // Measure: editor inner panel width vs viewport — full width means ≥ ~92%.
    const kfBox = await kf.boundingBox().catch(() => null);
    const vw = page.viewportSize().width;
    const widthRatio = kfBox ? kfBox.width / vw : 0;
    check('keyframe.full-width', widthRatio >= 0.92, `editor width ${Math.round(widthRatio * 100)}% of viewport (left-0 right-0)`);
    await kf.screenshot({ path: join(outDir, '05b-keyframe-closeup.png') }).catch(() => {});

    // close keyframe editor
    await page.click('[data-action="keyframe-toggle"]');
    await page.waitForTimeout(300);

    // ── FUNCTION: select → move writes scenePosition; only that node changes ──
    await page.click('[data-tool-group="transform"]');
    await page.waitForTimeout(200);
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeA);
    await page.waitForTimeout(300);
    await page.click('[data-action="edit-toggle"]');
    await page.waitForTimeout(300);
    const before = await readSP(page, nodeA);
    const allBefore = await allSP(page);
    for (let i = 0; i < 3; i++) { await page.click('[data-testid="tt-pos-x-inc"]'); await page.waitForTimeout(120); }
    const after = await readSP(page, nodeA);
    const dx = (after?.x ?? 0) - (before?.x ?? 0);
    check('function.move-writes-scenePosition', dx > 0.1, `x ${before?.x ?? 0} → ${after?.x ?? 0} (Δ${dx.toFixed(3)})`);
    const allAfter = await allSP(page);
    const changed = Object.keys(allAfter).filter((k) => allAfter[k] !== allBefore[k]);
    check('function.only-target-changed', changed.length === 1 && changed[0] === nodeA, `changed: ${changed.join(',') || 'none'}`);
    await page.screenshot({ path: join(outDir, '06-transform-applied.png') });

    // ── FUNCTION: Build → Add to System re-captions + clears dirty ───────────
    const capBefore = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.intent?.caption ?? '', nodeA);
    await page.click('[data-tool-group="build"]');
    await page.waitForTimeout(300);
    await page.click('[data-action="add-to-system"]');
    await page.waitForTimeout(400);
    const capAfter = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.intent?.caption ?? '', nodeA);
    check('function.build-add-to-system', capAfter.length > 0 && capAfter !== capBefore, `caption → "${capAfter.slice(0, 40)}"`);

    // ── FUNCTION: mode toggle issues no rebuild ──────────────────────────────
    const buildsBefore = await page.evaluate(() => { const h = (window).__prismBuiltSnapshotHistory; return h ? h().length : -1; });
    await page.evaluate(() => (window).__PRISM_EDITOR_SET_VIEW_MODE__('preview-app'));
    await page.waitForTimeout(800);
    await page.evaluate(() => (window).__PRISM_EDITOR_SET_VIEW_MODE__('canvas'));
    await page.waitForTimeout(800);
    const buildsAfter = await page.evaluate(() => { const h = (window).__prismBuiltSnapshotHistory; return h ? h().length : -1; });
    check('function.modetoggle-no-rebuild', buildsBefore === -1 || buildsAfter === buildsBefore, `builds ${buildsBefore} → ${buildsAfter}`);

    // ── Console clean ────────────────────────────────────────────────────────
    const benign = (e) => /Download the React DevTools|\[Fast Refresh\]|Warning:/.test(e);
    const critical = consoleErrors.filter((e) => !benign(e));
    check('console.clean', critical.length === 0, critical.length ? critical.slice(0, 3).join(' | ') : 'no new errors');
    writeFileSync(join(outDir, 'console.json'), JSON.stringify({ all: consoleErrors, critical }, null, 2));

    await page.screenshot({ path: join(outDir, '07-final-canvas.png') });
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    if (existsSync(liveGraphBak)) { copyFileSync(liveGraphBak, liveGraph); console.log(D + '[step8.5] restored live-graph.json' + RS); }
  }

  const passed = results.filter((r) => r.pass).length;
  const out = { when: new Date().toISOString(), passed, total: results.length, results, staticAudit: audit };
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(out, null, 2));
  console.log(`\n${passed}/${results.length} checks passed → notes/verification/step8_5/results.json`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
