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

    // ── CAMERA orbit / pan / zoom (back in canvas) ──
    await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
    await page.waitForTimeout(1500);
    const camBefore = await page.evaluate(() => {
      const c = window.__PRISM_EDITOR_SHELL_CAM__.camera;
      return [c.position.x, c.position.y, c.position.z];
    });
    // zoom in + orbit by moving the camera through the rig, then drag to orbit.
    await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(7, 3, 20, 0, 0, 0));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, '04-camera-orbit.png') });
    const camAfter = await page.evaluate(() => {
      const c = window.__PRISM_EDITOR_SHELL_CAM__.camera;
      return [c.position.x, c.position.y, c.position.z];
    });
    const camMoved = Math.hypot(camAfter[0] - camBefore[0], camAfter[1] - camBefore[1], camAfter[2] - camBefore[2]);
    metrics.steps.push({ step: 'camera', camBefore, camAfter, camMoved: Number(camMoved.toFixed(2)), works: camMoved > 1 });
    log(`CAMERA: moved ${camMoved.toFixed(2)} world units · works ${camMoved > 1}`);
    // restore
    await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(0, 0, 27, 0, 0, 0));

    metrics.consoleErrors = consoleErrors;
    metrics.pageErrors = pageErrors;
    metrics.pass = booted && canvasAuth.ok && galaxyAuth.ok && pageErrors.length === 0 && consoleErrors.length === 0;
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
