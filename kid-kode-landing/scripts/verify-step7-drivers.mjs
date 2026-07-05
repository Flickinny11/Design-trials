#!/usr/bin/env node
// STEP7 — driver verification harness.
//
// Boots `next dev`, drives the built preview-app in headless Chromium, and
// produces EVIDENCE that the four previously-missing drivers now PLAY each
// node's OWN declared animation in response to real input:
//   - ScrollDriver  — home-headline (parallax-scroll) moves with scroll.
//   - PointerDriver — home-feature-card (magnetic-cursor) follows the pointer.
//   - inview/Event  — home-parallax-stack (displacement-transition) PLAYS.
//   - State/Event   — input paths wired (state set / event fire reach dispatch).
//
// Measurement is via the window.__prismDrivers debug handle installed by
// SceneDriverHost (deterministic setScroll/setPointer + localPos/timelineState
// probes). Screenshots are saved under notes/verification/step7/.
//
// Run: node scripts/verify-step7-drivers.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = join(repoRoot, 'notes', 'verification', 'step7');
mkdirSync(outDir, { recursive: true });

const PORT = 4788;
const BASE = `http://localhost:${PORT}/`;
const results = [];
const evidence = {};
function check(id, desc, pass, detail = '') {
  results.push({ id, desc, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${id.padEnd(26)} ${desc}${detail ? `  — ${detail}` : ''}`);
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return true;
    } catch {
      /* still booting / compiling */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log(`[step7] starting next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  server.stdout.on('data', (b) => {
    const s = b.toString();
    if (/error/i.test(s)) process.stderr.write(`[next] ${s}`);
  });
  server.stderr.on('data', (b) => process.stderr.write(`[next] ${b}`));

  let browser;
  try {
    const ok = await waitForServer(BASE);
    if (!ok) throw new Error('next dev did not come up in 120s');

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: [
        '--enable-unsafe-webgpu',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist',
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const consoleLogs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => pageErrors.push(e.message));

    // First dev navigation triggers a compile; allow a generous timeout.
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Wait for SceneDriverHost to install the debug handle (built scene mounted
    // in preview-app, which is the boot default — RA-17).
    await page.evaluate(() => {
      const w = window;
      if (typeof w.__PRISM_EDITOR_SET_VIEW_MODE__ === 'function') {
        w.__PRISM_EDITOR_SET_VIEW_MODE__('preview-app');
      }
    }).catch(() => {});

    const handleReady = await page
      .waitForFunction(
        () =>
          typeof window.__prismDrivers === 'object' &&
          window.__prismDrivers !== null &&
          typeof window.__prismDrivers.localPos === 'function' &&
          // built nodes registered
          !!window.__PRISM_EDITOR_NODE_GROUPS__ &&
          window.__PRISM_EDITOR_NODE_GROUPS__.has('home-feature-card'),
        { timeout: 90000, polling: 500 },
      )
      .then(() => true)
      .catch(() => false);
    check('handle.ready', 'window.__prismDrivers installed + nodes built', handleReady);
    if (!handleReady) throw new Error('driver handle / built nodes never appeared');

    const backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
    evidence.rendererBackend = backend;
    console.log(`[step7] renderer backend: ${backend}`);

    // Let the scene settle (font warmup + inview animations + build pop).
    await page.waitForTimeout(3500);

    // ── Baseline screenshot ────────────────────────────────────────────────
    await page.screenshot({ path: join(outDir, '01-preview-app-baseline.png') });

    // ════════════════════════════════════════════════════════════════════
    // 1. ScrollDriver — home-headline parallax-scroll moves with scroll.
    // ════════════════════════════════════════════════════════════════════
    const scrollMeasure = await page.evaluate(async () => {
      const d = window.__prismDrivers;
      const node = 'home-headline';
      const read = () => d.localPos(node)?.position ?? null;
      d.setScroll(0);
      await new Promise((r) => setTimeout(r, 250));
      const at0 = read();
      d.setScroll(1);
      await new Promise((r) => setTimeout(r, 250));
      const at1 = read();
      d.setScroll(0.5);
      await new Promise((r) => setTimeout(r, 250));
      const atHalf = read();
      d.setScroll(0);
      await new Promise((r) => setTimeout(r, 200));
      return { at0, atHalf, at1 };
    });
    evidence.scroll = scrollMeasure;
    const dyScroll =
      scrollMeasure.at1 && scrollMeasure.at0
        ? scrollMeasure.at1.y - scrollMeasure.at0.y
        : 0;
    check(
      'scroll.parallax',
      'home-headline (parallax-scroll) Y responds to scroll 0→1',
      Math.abs(dyScroll) > 0.02,
      `Δy = ${dyScroll.toFixed(4)} (p0.y=${scrollMeasure.at0?.y?.toFixed(4)}, p1.y=${scrollMeasure.at1?.y?.toFixed(4)})`,
    );

    // Screenshot mid-scroll for the report.
    await page.evaluate(() => window.__prismDrivers.setScroll(1));
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(outDir, '02-scroll-progress-1.png') });
    await page.evaluate(() => window.__prismDrivers.setScroll(0));
    await page.waitForTimeout(200);

    // ════════════════════════════════════════════════════════════════════
    // 2. PointerDriver — home-feature-card magnetic-cursor follows pointer.
    // ════════════════════════════════════════════════════════════════════
    const pointerMeasure = await page.evaluate(async () => {
      const d = window.__prismDrivers;
      const node = 'home-feature-card';
      const read = () => d.localPos(node)?.position ?? null;
      // Center pointer + let it settle.
      d.setPointer(0, 0);
      await new Promise((r) => setTimeout(r, 600));
      const centered = read();
      // Push pointer to the upper-right; magnetic-cursor lerps toward it.
      d.setPointer(0.85, 0.65);
      await new Promise((r) => setTimeout(r, 900));
      const pulled = read();
      return { centered, pulled };
    });
    evidence.pointer = pointerMeasure;
    const dxPtr =
      pointerMeasure.pulled && pointerMeasure.centered
        ? pointerMeasure.pulled.x - pointerMeasure.centered.x
        : 0;
    const dyPtr =
      pointerMeasure.pulled && pointerMeasure.centered
        ? pointerMeasure.pulled.y - pointerMeasure.centered.y
        : 0;
    check(
      'pointer.magnetic',
      'home-feature-card (magnetic-cursor) drifts toward pointer',
      dxPtr > 0.02 && dyPtr > 0.02,
      `Δx = ${dxPtr.toFixed(4)}, Δy = ${dyPtr.toFixed(4)} (toward +x,+y pointer)`,
    );
    await page.screenshot({ path: join(outDir, '03-pointer-pulled.png') });
    await page.evaluate(() => window.__prismDrivers.setPointer(0, 0));

    // ════════════════════════════════════════════════════════════════════
    // 3. inview / displacement-transition PLAYS on its trigger.
    // ════════════════════════════════════════════════════════════════════
    const dispState = await page.evaluate(
      () => window.__prismDrivers.timelineState('home-parallax-stack'),
    );
    evidence.displacement = dispState;
    const dispPlayed = dispState.some(
      (s) => s.duration > 0 && (s.progress ?? 0) > 0,
    );
    check(
      'inview.displacement',
      'home-parallax-stack (displacement-transition) played on inview',
      dispPlayed,
      JSON.stringify(dispState),
    );

    // ════════════════════════════════════════════════════════════════════
    // 4. State + Event driver INPUT paths are wired (reach dispatch).
    // ════════════════════════════════════════════════════════════════════
    const inputWiring = await page.evaluate(() => {
      const d = window.__prismDrivers;
      let threw = null;
      try {
        d.setState('home-feature-card', 'hover', true);
        d.setState('home-feature-card', 'hover', false);
        d.fireEvent('click', 'home-parallax-stack');
      } catch (e) {
        threw = String(e);
      }
      return {
        threw,
        frameSize: d.frameSize(),
        magneticResults: d.nodeResultCount('home-feature-card'),
        headlineResults: d.nodeResultCount('home-headline'),
      };
    });
    evidence.inputWiring = inputWiring;
    check(
      'state-event.wired',
      'StateDriver/EventDriver inputs reach dispatch without error',
      inputWiring.threw === null &&
        inputWiring.frameSize >= 1 &&
        inputWiring.magneticResults >= 1,
      `frameSize=${inputWiring.frameSize}, magneticResults=${inputWiring.magneticResults}`,
    );

    // ════════════════════════════════════════════════════════════════════
    // 5. INV-6 — keyframes unchanged across driver (re)assignment.
    // ════════════════════════════════════════════════════════════════════
    const inv6 = await page.evaluate(() => {
      const d = window.__prismDrivers;
      const node = 'home-parallax-stack';
      const snap = () => JSON.stringify(d.timelineState(node).map((s) => s.duration));
      const before = snap();
      // Re-fire every driver input; none may change the timeline's duration
      // (the keyframe model).
      d.setScroll(0.3);
      d.setState(node, 'hover', true);
      d.setState(node, 'hover', false);
      d.fireEvent('click', node);
      const after = snap();
      d.setScroll(0);
      return { before, after };
    });
    evidence.inv6 = inv6;
    check(
      'inv6.keyframes',
      'INV-6: timeline keyframe duration unchanged across driver inputs',
      inv6.before === inv6.after,
      `before=${inv6.before} after=${inv6.after}`,
    );

    // ════════════════════════════════════════════════════════════════════
    // 6. Mode toggle rebuilds nothing (RT-SC-08 / FP-R4).
    // ════════════════════════════════════════════════════════════════════
    const toggleRebuild = await page.evaluate(async () => {
      const w = window;
      const before = w.__artifactBuildCount ?? 0;
      const set = w.__PRISM_EDITOR_SET_VIEW_MODE__;
      if (typeof set !== 'function') return { supported: false };
      set('canvas');
      await new Promise((r) => setTimeout(r, 600));
      set('preview-app');
      await new Promise((r) => setTimeout(r, 600));
      const after = w.__artifactBuildCount ?? 0;
      return { supported: true, before, after, delta: after - before };
    });
    evidence.toggleRebuild = toggleRebuild;
    check(
      'toggle.norebuild',
      'canvas↔preview-app toggle issues 0 artifact rebuilds',
      toggleRebuild.supported ? toggleRebuild.delta === 0 : true,
      toggleRebuild.supported ? `Δbuilds=${toggleRebuild.delta}` : 'set-view-mode hook absent (skipped)',
    );

    // ── Console / page errors ──────────────────────────────────────────────
    const criticalErrors = [
      ...pageErrors,
      ...consoleLogs.filter((l) => l.type === 'error').map((l) => l.text),
    ].filter(
      (e) =>
        !/Download the React DevTools/.test(e) &&
        !/Warning:/.test(e) &&
        !/\[Fast Refresh\]/.test(e),
    );
    evidence.consoleErrors = criticalErrors;
    check(
      'console.clean',
      'zero new console / page errors in preview-app',
      criticalErrors.length === 0,
      criticalErrors.length ? criticalErrors.slice(0, 3).join(' | ') : 'clean',
    );

    await page.screenshot({ path: join(outDir, '04-final-state.png') });
  } catch (e) {
    check('fatal', 'verification fatal error', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  const report = { results, evidence };
  writeFileSync(
    join(outDir, 'verify-step7-drivers.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} checks passed`);
  console.log(`evidence + screenshots → ${join('notes', 'verification', 'step7')}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
