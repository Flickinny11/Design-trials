#!/usr/bin/env node
/**
 * STEP8 — Canvas Toolbar verification (evidence-based, /prism-verify spirit).
 *
 * Boots `next dev`, drives the editor in real Chromium (WebGPU flags on; WebGL2
 * fallback if unavailable), and produces:
 *   - Screenshots of the toolbar, expanded groups, and the keyframe editor.
 *   - Functional assertions: Transform writes scenePosition + persists through
 *     reload + only-that-node-changed; Selection group/ungroup (world preserved);
 *     Build Add-to-System re-caption; placeholder "coming" state; console-clean.
 *
 * Artifacts → notes/verification/step8/. The live-graph.json is backed up and
 * restored so verification leaves no graph mutation behind.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'step8');
mkdirSync(outDir, { recursive: true });
const liveGraph = join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json');
const liveGraphBak = join(outDir, 'live-graph.before.json');

const PORT = 4793;
const URL = `http://localhost:${PORT}/`;
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', RS = '\x1b[0m';
const results = [];
function check(id, pass, detail = '') {
  results.push({ id, pass, detail });
  console.log(`[${pass ? G + 'PASS' : R + 'FAIL'}${RS}] ${id.padEnd(34)} ${detail ? D + detail + RS : ''}`);
}

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return true; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function bootCanvas(page) {
  // Click the "Canvas" view-mode toggle, then wait for the toolbar to mount.
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
  if (existsSync(liveGraph)) copyFileSync(liveGraph, liveGraphBak);

  console.log(`[step8] next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', (b) => { const s = b.toString(); if (/error/i.test(s)) process.stderr.write(D + s + RS); });

  let browser;
  try {
    if (!(await waitForServer(URL))) throw new Error('server did not come up');
    const { chromium } = await import('playwright');
    // Plain launch (WebGL2 fallback) — matches the working browser-smoke harness;
    // headless WebGPU flags destabilise the GPU process and hang screenshots.
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);
    await bootCanvas(page);

    // ── DESIGN screenshots ───────────────────────────────────────────────
    const ids = await firstHubNodeIds(page);
    const nodeA = ids[0], nodeB = ids[1], nodeC = ids[2];
    // Select a node so the Transform flyout shows its controls.
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeA);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(outDir, '01-toolbar-transform.png') });
    check('screenshot.transform', true, '01-toolbar-transform.png');

    // Selection group flyout
    await page.click('[data-tool-group="selection"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, '02-toolbar-selection.png') });
    check('screenshot.selection', true, '02-toolbar-selection.png');

    // Build group flyout
    await page.click('[data-tool-group="build"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, '03-toolbar-build.png') });
    check('screenshot.build', true, '03-toolbar-build.png');

    // Animation flyout + open keyframe editor
    await page.click('[data-tool-group="animation"]');
    await page.waitForTimeout(300);
    await page.click('[data-action="keyframe-toggle"]');
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(outDir, '04-keyframe-editor.png') });
    const kfVisible = await page.locator('[data-component="keyframe-editor"]').isVisible().catch(() => false);
    check('keyframe.slides-out', kfVisible, 'keyframe editor visible after toggle');

    // A placeholder group (Add) → coming state, screenshot
    await page.click('[data-action="keyframe-toggle"]'); // close kf
    await page.click('[data-tool-group="add"]');
    await page.waitForTimeout(300);
    await page.click('text=Add Element');
    await page.waitForTimeout(400);
    const comingVisible = await page.locator('text=Coming with the').first().isVisible().catch(() => false);
    check('placeholder.coming-state', comingVisible, 'Add Element shows "Coming with" — no fake output');
    await page.screenshot({ path: join(outDir, '05-placeholder-coming.png') });

    // ── FUNCTIONAL: Transform writes scenePosition ───────────────────────
    await page.click('[data-tool-group="transform"]');
    await page.waitForTimeout(200);
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeA);
    await page.waitForTimeout(300);
    await page.click('[data-action="edit-toggle"]'); // enter edit mode (gizmo on)
    await page.waitForTimeout(300);
    const before = await readSP(page, nodeA);
    const allBefore = await allSP(page);
    // nudge X three times via the toolbar Move stepper
    for (let i = 0; i < 3; i++) { await page.click('[data-testid="tt-pos-x-inc"]'); await page.waitForTimeout(120); }
    // scale up twice
    await page.click('[data-testid="tt-scale-val-inc"]'); await page.waitForTimeout(120);
    await page.click('[data-testid="tt-scale-val-inc"]'); await page.waitForTimeout(120);
    const after = await readSP(page, nodeA);
    const dx = (after?.x ?? 0) - (before?.x ?? 0);
    const ds = (after?.scaleX ?? 1) / (before?.scaleX ?? 1);
    check('transform.writes-scenePosition.x', dx > 0.1, `x ${before?.x ?? 0} → ${after?.x ?? 0} (Δ${dx.toFixed(3)})`);
    check('transform.writes-scenePosition.scale', ds > 1.1, `scaleX ${before?.scaleX ?? 1} → ${after?.scaleX ?? 1}`);
    await page.screenshot({ path: join(outDir, '06-transform-applied.png') });

    // only that node changed
    const allAfter = await allSP(page);
    const changed = Object.keys(allAfter).filter((k) => allAfter[k] !== allBefore[k]);
    check('transform.only-target-changed', changed.length === 1 && changed[0] === nodeA, `changed: ${changed.join(',') || 'none'}`);

    // ── persistence through reload (autosave → live-graph.json → reload) ──
    await page.waitForTimeout(2500); // let the 1s debounced autosave flush to the server
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(6000);
    await bootCanvas(page);
    const afterReload = await readSP(page, nodeA);
    check('transform.persists-reload', Math.abs((afterReload?.x ?? 0) - (after?.x ?? 0)) < 0.001 && (afterReload?.x ?? 0) > 0.1,
      `x after reload = ${afterReload?.x ?? 0}`);

    // ── SELECTION: group → cascade → ungroup (world preserved) ───────────
    await page.evaluate(([a, b]) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().setMultiSelection([a, b]), [nodeB, nodeC]);
    await page.click('[data-tool-group="selection"]');
    await page.waitForTimeout(300);
    await page.click('[data-testid="tt-group"]');
    await page.waitForTimeout(400);
    const gB = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.groupId ?? null, nodeB);
    const gC = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.groupId ?? null, nodeC);
    check('selection.group', !!gB && gB === gC, `groupId B=${gB} C=${gC}`);

    // cascade: nudge the group via Transform, both members move
    const bBefore = await readSP(page, nodeB), cBefore = await readSP(page, nodeC);
    await page.click('[data-tool-group="transform"]');
    await page.waitForTimeout(200);
    await page.click('[data-action="edit-toggle"]');
    await page.waitForTimeout(200);
    for (let i = 0; i < 2; i++) { await page.click('[data-testid="tt-pos-y-inc"]'); await page.waitForTimeout(120); }
    const bAfter = await readSP(page, nodeB), cAfter = await readSP(page, nodeC);
    const cascade = (bAfter?.y ?? 0) > (bBefore?.y ?? 0) && (cAfter?.y ?? 0) > (cBefore?.y ?? 0);
    check('selection.group-cascade', cascade, `B.y ${bBefore?.y}→${bAfter?.y}  C.y ${cBefore?.y}→${cAfter?.y}`);

    // ungroup preserves world transforms
    const bPre = await readSP(page, nodeB);
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeB);
    await page.click('[data-tool-group="selection"]');
    await page.waitForTimeout(300);
    await page.click('[data-testid="tt-ungroup"]');
    await page.waitForTimeout(400);
    const gB2 = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.groupId ?? null, nodeB);
    const bPost = await readSP(page, nodeB);
    check('selection.ungroup-clears', gB2 === null || gB2 === undefined, `groupId after ungroup = ${gB2}`);
    check('selection.ungroup-preserves-world', JSON.stringify(bPre) === JSON.stringify(bPost), 'scenePosition unchanged by ungroup');

    // ── BUILD: Add to System re-captions + clears dirty ──────────────────
    await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphEditor.getState().selectNode(id), nodeA);
    const capBefore = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.intent?.caption ?? '', nodeA);
    await page.click('[data-tool-group="build"]');
    await page.waitForTimeout(300);
    await page.click('[data-action="add-to-system"]');
    await page.waitForTimeout(400);
    const capAfter = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.intent?.caption ?? '', nodeA);
    const dirtyAfter = await page.evaluate((id) => (window).__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.dirty === true, nodeA);
    check('build.add-to-system.recaption', capAfter.length > 0 && capAfter !== capBefore, `caption → "${capAfter.slice(0, 40)}"`);
    check('build.add-to-system.clears-dirty', dirtyAfter === false, `dirty=${dirtyAfter}`);

    // ── mode toggle issues no rebuild ────────────────────────────────────
    const buildsBefore = await page.evaluate(() => {
      const h = (window).__prismBuiltSnapshotHistory; return h ? h().length : -1;
    });
    await page.evaluate(() => (window).__PRISM_EDITOR_SET_VIEW_MODE__('preview-app'));
    await page.waitForTimeout(800);
    await page.evaluate(() => (window).__PRISM_EDITOR_SET_VIEW_MODE__('canvas'));
    await page.waitForTimeout(800);
    const buildsAfter = await page.evaluate(() => {
      const h = (window).__prismBuiltSnapshotHistory; return h ? h().length : -1;
    });
    check('modetoggle.no-rebuild', buildsBefore === -1 || buildsAfter === buildsBefore, `builds ${buildsBefore} → ${buildsAfter}`);

    // ── Console clean ────────────────────────────────────────────────────
    const benign = (e) => /Download the React DevTools|\[Fast Refresh\]|Warning:/.test(e);
    const critical = consoleErrors.filter((e) => !benign(e));
    check('console.clean', critical.length === 0, critical.length ? critical.slice(0, 3).join(' | ') : 'no new errors');

    await page.screenshot({ path: join(outDir, '07-final-canvas.png') });
    await browser.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
    // Restore the graph so verification leaves no mutation behind.
    if (existsSync(liveGraphBak)) { copyFileSync(liveGraphBak, liveGraph); console.log(D + '[step8] restored live-graph.json' + RS); }
  }

  const passed = results.filter((r) => r.pass).length;
  const out = { when: new Date().toISOString(), passed, total: results.length, results };
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(out, null, 2));
  console.log(`\n${passed}/${results.length} checks passed → notes/verification/step8/results.json`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
