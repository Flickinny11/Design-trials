// PRISM EDITOR INTEGRATION — I-1 headless behavioral verifier.
//
// HEADLESS Playwright (chromium.launch() — never headed). Drives /editor like a
// user: cold-load canvas, switch galaxy/preview, orbit/pan/zoom; after each
// interaction it screenshots + reads console + queries the in-engine probes
// (authorship, backend). Frames + metrics → notes/verification/edit-i1/.
//
// Usage: node scripts/verify-editor-shell.mjs [baseUrl]   (default localhost:3000)

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.argv[2] || process.env.GATE_URL || 'http://localhost:3000').replace(/\/$/, '');
const URL = `${BASE}/editor`;
const OUT = 'notes/verification/edit-i1';
mkdirSync(OUT, { recursive: true });

const VP = { width: 1680, height: 1000 };
const log = (m) => console.log(m);

async function waitServer(url) {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 200) return true; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const main = async () => {
  if (!(await waitServer(BASE))) { console.error('dev server not reachable at', BASE); process.exit(2); }
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const metrics = { url: URL, viewport: VP, steps: [] };
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    // resize before reading (force a layout pass for full-fidelity capture).
    await page.setViewportSize({ width: VP.width - 1, height: VP.height });
    await page.setViewportSize(VP);

    const booted = await page
      .waitForFunction(() => {
        const w = window;
        return typeof w.__PRISM_EDITOR_AUTHORSHIP__ === 'function'
          && typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
          && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
      }, { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    metrics.booted = booted;
    log(`probe installed + graph loaded: ${booted}`);
    if (!booted) {
      await page.screenshot({ path: join(OUT, 'BOOT-FAIL.png') });
      metrics.consoleErrors = consoleErrors; metrics.pageErrors = pageErrors;
      writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
      await browser.close();
      console.error('BOOT FAIL — probe/graph never appeared'); process.exit(1);
    }

    const backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__());
    const storeInfo = await page.evaluate(() => {
      const s = window.__PRISM_EDITOR_SHELL_STORE__();
      return { view: s.view, activeHubId: s.activeHubId, hubIds: s.hubIds, allNodes: s.allNodeIds.length, activeHubNodes: s.activeHubNodeIds.length };
    });
    metrics.backend = backend; metrics.store = storeInfo;
    log(`backend: ${JSON.stringify(backend)} · store: ${JSON.stringify(storeInfo)}`);

    // ── CANVAS (default) ──
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
    await page.waitForTimeout(9000); // MSDF warm + auto-fit settle
    const canvasAuth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
    await page.screenshot({ path: join(OUT, '01-canvas.png') });
    metrics.steps.push({ step: 'canvas', auth: { view: canvasAuth.view, renderedCount: canvasAuth.renderedCount, orphans: canvasAuth.orphans.length, unrealizedActiveHub: canvasAuth.unrealizedActiveHub.length, ok: canvasAuth.ok } });
    log(`CANVAS: ${canvasAuth.renderedCount} rendered · orphans ${canvasAuth.orphans.length} · unrealized ${canvasAuth.unrealizedActiveHub.length} · ok ${canvasAuth.ok}`);

    // ── GALAXY ──
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('galaxy'));
    await page.waitForTimeout(3500);
    const galaxyAuth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
    await page.screenshot({ path: join(OUT, '02-galaxy.png') });
    metrics.steps.push({ step: 'galaxy', auth: { view: galaxyAuth.view, renderedCount: galaxyAuth.renderedCount, orphans: galaxyAuth.orphans.length, galaxyMissing: galaxyAuth.galaxyMissing.length, ok: galaxyAuth.ok } });
    log(`GALAXY: ${galaxyAuth.renderedCount} dormant seeds · orphans ${galaxyAuth.orphans.length} · missing ${galaxyAuth.galaxyMissing.length} · ok ${galaxyAuth.ok}`);

    // ── PREVIEW ──
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('preview-app'));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '03-preview.png') });
    metrics.steps.push({ step: 'preview', note: 'placeholder (running app wired in I-4)' });
    log('PREVIEW: placeholder captured');

    // ── TRI-STATE SWITCH: trusted-pointer click each segment (in-engine) ──
    // camera is still at its default here (not yet moved), so projection is accurate.
    const switchResults = [];
    for (const target of ['preview-app', 'galaxy', 'canvas']) {
      const css = await page.evaluate((t) => {
        const segs = window.__PRISM_EDITOR_SWITCH_POS__();
        const seg = segs.find((s) => s.view === t);
        if (!seg) return null;
        return window.__PRISM_EDITOR_SHELL_CAM__.project(seg.world[0], seg.world[1], seg.world[2]);
      }, target);
      if (!css) { switchResults.push({ target, clicked: false }); continue; }
      await page.mouse.click(css[0], css[1]);
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_STORE__().view);
      switchResults.push({ target, clickedAt: [Math.round(css[0]), Math.round(css[1])], viewAfter: after, ok: after === target });
      log(`SWITCH click ${target}: view→${after} · ok ${after === target}`);
    }
    await page.screenshot({ path: join(OUT, '05-switch-clicked-canvas.png') });
    metrics.steps.push({ step: 'switch', results: switchResults, allOk: switchResults.every((r) => r.ok) });

    // ── CAMERA orbit / pan / zoom — REAL trusted-pointer interaction (canvas) ──
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
    await page.waitForTimeout(1500);
    const readCam = () => page.evaluate(() => {
      const c = window.__PRISM_EDITOR_SHELL_CAM__.camera;
      return { p: [c.position.x, c.position.y, c.position.z], dist: Math.hypot(c.position.x, c.position.y, c.position.z) };
    });
    const cx = Math.round(VP.width / 2);
    const cy = Math.round(VP.height / 2);
    const c0 = await readCam();
    // ORBIT: left-drag across the canvas center.
    await page.mouse.move(cx - 120, cy + 20);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(cx - 120 + i * 22, cy + 20 + i * 5); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(900);
    const c1 = await readCam();
    const orbitDelta = Math.hypot(c1.p[0] - c0.p[0], c1.p[1] - c0.p[1], c1.p[2] - c0.p[2]);
    await page.screenshot({ path: join(OUT, '04-camera-orbit.png') });
    // ZOOM: mouse wheel toward the content.
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(900);
    const c2 = await readCam();
    const zoomDelta = c1.dist - c2.dist; // >0 means zoomed in
    await page.screenshot({ path: join(OUT, '06-camera-zoom.png') });
    // PAN: right-drag.
    await page.mouse.move(cx, cy);
    await page.mouse.down({ button: 'right' });
    for (let i = 1; i <= 8; i++) { await page.mouse.move(cx + i * 16, cy - i * 6); await page.waitForTimeout(16); }
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(700);
    const c3 = await readCam();
    const panDelta = Math.hypot(c3.p[0] - c2.p[0], c3.p[1] - c2.p[1]);
    const camMoved = orbitDelta;
    const orbitWorks = orbitDelta > 0.5;
    const zoomWorks = Math.abs(zoomDelta) > 0.5;
    const panWorks = panDelta > 0.2;
    metrics.steps.push({ step: 'camera', c0, c1, c2, c3, orbitDelta: +orbitDelta.toFixed(2), zoomDelta: +zoomDelta.toFixed(2), panDelta: +panDelta.toFixed(2), orbitWorks, zoomWorks, panWorks });
    log(`CAMERA: orbit Δ${orbitDelta.toFixed(2)} (${orbitWorks}) · zoom Δ${zoomDelta.toFixed(2)} (${zoomWorks}) · pan Δ${panDelta.toFixed(2)} (${panWorks})`);
    // restore
    await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(0, 0, 27, 0, 0, 0));

    metrics.consoleErrors = consoleErrors;
    metrics.pageErrors = pageErrors;
    const switchOk = switchResults.every((r) => r.ok);
    metrics.pass = booted && canvasAuth.ok && galaxyAuth.ok && switchOk && orbitWorks && zoomWorks && pageErrors.length === 0 && consoleErrors.length === 0;
    writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 2));
    log(`\nconsole errors: ${consoleErrors.length} · page errors: ${pageErrors.length}`);
    log(`OVERALL PASS: ${metrics.pass}`);
    if (consoleErrors.length) log('  console: ' + consoleErrors.slice(0, 5).join(' | '));
    if (pageErrors.length) log('  pageerr: ' + pageErrors.slice(0, 5).join(' | '));
    await browser.close();
    process.exit(metrics.pass ? 0 : 1);
  } catch (e) {
    console.error('FATAL', e?.message ?? e);
    try { await page.screenshot({ path: join(OUT, 'FATAL.png') }); } catch {}
    try { await browser.close(); } catch {}
    process.exit(1);
  }
};

main();
