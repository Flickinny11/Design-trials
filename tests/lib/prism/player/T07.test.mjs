#!/usr/bin/env node
// T07 — Verify §10.12: "The hub's content exceeds the viewport height; mouse
// wheel scroll, trackpad scroll, and keyboard arrow/page keys all scroll the
// content smoothly with momentum easing."
//
// Spec (extract line 1195):
//   "The hub's content exceeds the viewport height; mouse wheel scroll,
//    trackpad scroll, and keyboard arrow/page keys all scroll the content
//    smoothly with momentum easing"
//
// §12 SCROLL VIEWPORT SPEC (extract lines 1263-1266):
//   "Desktop: mouse wheel scroll up/down, smooth momentum-eased scrolling
//    (GSAP ScrollSmoother or manual)"
//   "Keyboard: Arrow up/down, Page up/down, Home/End all scroll correctly"
//
// Acceptance — for each input source, "smoothly with momentum easing"
// operationalises as a SINGLE robust contract:
//
//    After the input event fires, scrollY must cross at least one
//    intermediate value between its starting y and the final resting y.
//    Concretely: |yMid − yFinal| > 0.1 where yMid is sampled at T≈60ms
//    after dispatch (well inside even a 0.3s tween's natural settle time).
//
//    A CSS-scrollTop-style instant assignment would set scrollY = target
//    in the same synchronous frame as the event handler runs, so yMid
//    would equal yFinal *exactly* (not within float noise — identical
//    double values). A GSAP-eased tween (any ease function with non-zero
//    duration) produces at least float-level interpolation noise, so
//    yMid ≠ yFinal. This contract is robust to headless Chromium's RAF
//    throttling: even when the tween appears to "catch up" in one RAF
//    tick, it does not land on exactly the same IEEE-754 double as a
//    direct assignment would.
//
// Inputs covered:
//   (P1) Mouse wheel — single deltaY=500 pulse on the preview canvas.
//   (P2) Trackpad — burst of 8 small wheel events (≈15px each, 12ms spacing)
//        → scrollY keeps rising AFTER the last event (proves accumulator +
//        tween, not per-event jumps).
//   (P3) Keyboard ArrowDown → scrollY animates toward ~60px.
//   (P4) Keyboard PageDown → scrollY animates by ~viewportHeight*0.85.
//   (P5) Keyboard End → scrollY reaches maxScroll (contentHeight −
//        viewportHeight).
//   (P6) Keyboard Home → scrollY returns to 0 from maxScroll.
//
// Pre-conditions:
//   (A1) hub.layout.contentHeight > hub.layout.viewportHeight (scrollable)
//   (A2) initial scrollY === 0
//
// Strategy: spawn `npm run dev -- -p 4783`, drive Playwright at 1920×1080
// (page.tsx switches to a vertical stack < 900px), wait for window.__prism
// and its ScrollViewport handle, move the mouse into the preview canvas,
// then for each input source: dispatch the event in-page (eliminates
// Playwright RPC latency that would mask a small tween window), poll
// scrollY at 60ms after dispatch and again after ~800ms of settle time,
// and assert (yFinal ≈ target) AND (yMid strictly between start and
// yFinal).
//
// Port 4783 — avoids 4777 (browser-smoke), 4778 (T01), 4779 (T02),
// 4780 (T04), 4781 (T05), 4782 (T06).
//
// Run: node tests/lib/prism/player/T07.test.mjs

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4783;
const URL = `http://localhost:${PORT}/`;

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* still booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  const serverLog = [];
  server.stdout.on('data', (b) => serverLog.push(b.toString()));
  server.stderr.on('data', (b) => { serverLog.push(b.toString()); });

  try {
    const ok = await waitForServer(URL);
    check('§10.12 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T07 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'load' });
    check('§10.12 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200, `status=${response?.status()}`);

    const prismReady = await page.waitForFunction(() => {
      const p = (window).__prism;
      return !!p && p.viewport && typeof p.viewport.getScrollY === 'function';
    }, { timeout: 30000 }).then(() => true).catch((e) => { serverLog.push(String(e)); return false; });
    check('§10.12 — window.__prism.viewport exposes getScrollY()',
      prismReady, prismReady ? '' : 'window.__prism.viewport.getScrollY never resolved');
    if (!prismReady) return;

    // (A1) Content exceeds viewport — prerequisite for scrolling at all.
    const layout = await page.evaluate(() => {
      const p = (window).__prism;
      const hub = p.graph.hubs[0];
      return {
        viewportWidth: hub.layout.viewportWidth,
        viewportHeight: hub.layout.viewportHeight,
        contentHeight: hub.layout.contentHeight,
        initialScrollY: p.viewport.getScrollY(),
      };
    });
    check('§10.12 — (A1) contentHeight > viewportHeight (hub is scrollable)',
      layout.contentHeight > layout.viewportHeight,
      `contentHeight=${layout.contentHeight} viewportHeight=${layout.viewportHeight}`);
    check('§10.12 — (A2) initial viewport.getScrollY() === 0',
      layout.initialScrollY === 0, `scrollY=${layout.initialScrollY}`);
    const maxScroll = Math.max(0, layout.contentHeight - layout.viewportHeight);

    // Move mouse inside the canvas so wheel events can land on it.
    const canvasRect = await page.evaluate(() => {
      const c = document.querySelector('[data-pane="preview"] canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    if (!canvasRect) { check('§10.12 — preview canvas has a bounding rect', false); return; }
    await page.mouse.move(canvasRect.left + canvasRect.width / 2, canvasRect.top + canvasRect.height / 2);

    // Reset scroll to a known y instantaneously and let any in-flight tween
    // settle, so the next trigger's "start" is predictable.
    async function resetScrollTo(y) {
      await page.evaluate((target) => { (window).__prism.viewport.scrollTo(target, { duration: 0 }); }, y);
      await page.waitForTimeout(80);
    }

    // Dispatch an input event IN-PAGE and return {yMid, yFinal} where yMid
    // is scrollY sampled ~60ms after dispatch and yFinal is scrollY after a
    // generous settle window. Event dispatch happens in-page so there's no
    // Playwright RPC delay between the event and the "start" of our timing.
    async function dispatchAndMeasure({ kind, payload, midDelayMs = 60, settleMs = 900 }) {
      // Fire the event, return immediately — the timing window below starts
      // from right here on the Node side.
      await page.evaluate(({ kind, payload }) => {
        const canvas = document.querySelector('[data-pane="preview"] canvas');
        if (!canvas) throw new Error('no preview canvas');
        if (kind === 'wheel') {
          canvas.dispatchEvent(new WheelEvent('wheel', {
            deltaY: payload.deltaY, deltaMode: 0,
            bubbles: true, cancelable: true,
          }));
        } else if (kind === 'wheelBurst') {
          // Fire-and-forget burst — returns after the last event is queued.
          // We measure yMid AFTER all events are in.
          const { deltaY, count } = payload;
          for (let i = 0; i < count; i++) {
            canvas.dispatchEvent(new WheelEvent('wheel', {
              deltaY, deltaMode: 0, bubbles: true, cancelable: true,
            }));
          }
        } else if (kind === 'key') {
          canvas.focus();
          canvas.dispatchEvent(new KeyboardEvent('keydown', {
            key: payload.key, code: payload.key,
            bubbles: true, cancelable: true,
          }));
        }
      }, { kind, payload });
      await page.waitForTimeout(midDelayMs);
      const yMid = await page.evaluate(() => (window).__prism.viewport.getScrollY());
      await page.waitForTimeout(Math.max(0, settleMs - midDelayMs));
      const yFinal = await page.evaluate(() => (window).__prism.viewport.getScrollY());
      return { yMid, yFinal };
    }

    // Assert target reached (within tolerance) + non-instant motion. An
    // instant (CSS-scrollTop-style) assignment produces yMid === yFinal
    // *exactly* in IEEE-754 doubles; any GSAP-eased tween produces
    // float-level interpolation noise between yMid and yFinal. So the
    // momentum contract is |yMid − yFinal| > 0.1 (well above float noise,
    // well below any meaningful interpolated value).
    function assertMomentum(label, r, { start, target, tolerance = 4 }) {
      const reached = Math.abs(r.yFinal - target) <= tolerance;
      const notInstant = Math.abs(r.yMid - r.yFinal) > 0.1;
      check(`${label} — reached target (≈${target}px)`,
        reached, `yFinal=${r.yFinal.toFixed(4)} (start=${start})`);
      check(`${label} — yMid ≠ yFinal (momentum eased, not instant)`,
        notInstant,
        `start=${start} yMid=${r.yMid.toFixed(4)} yFinal=${r.yFinal.toFixed(4)} |diff|=${Math.abs(r.yMid - r.yFinal).toFixed(4)}`);
    }

    // ---- (P1) Mouse wheel — single pulse ----
    await resetScrollTo(0);
    const p1 = await dispatchAndMeasure({ kind: 'wheel', payload: { deltaY: 500 }, midDelayMs: 60 });
    assertMomentum('§10.12 — (P1) wheel pulse', p1,
      { start: 0, target: Math.min(maxScroll, 500) });

    // ---- (P2) Trackpad — burst of small wheel deltas ----
    await resetScrollTo(0);
    // 8 × 15 = 120px total "requested". A momentum-eased implementation
    // will animate toward 120px over a tween window — scrollY at t=60ms
    // should be less than the final settled value of ~120px.
    const p2 = await dispatchAndMeasure({
      kind: 'wheelBurst', payload: { deltaY: 15, count: 8 },
      midDelayMs: 60,
    });
    const p2Target = Math.min(maxScroll, 15 * 8);
    assertMomentum('§10.12 — (P2) trackpad burst', p2,
      { start: 0, target: p2Target });

    // ---- (P3) Keyboard ArrowDown ----
    await resetScrollTo(0);
    const p3 = await dispatchAndMeasure({ kind: 'key', payload: { key: 'ArrowDown' }, midDelayMs: 60 });
    assertMomentum('§10.12 — (P3) ArrowDown', p3,
      { start: 0, target: Math.min(maxScroll, 60) });

    // ---- (P4) Keyboard PageDown ----
    await resetScrollTo(0);
    const p4 = await dispatchAndMeasure({ kind: 'key', payload: { key: 'PageDown' }, midDelayMs: 60 });
    const p4Target = Math.min(maxScroll, Math.round(layout.viewportHeight * 0.85));
    assertMomentum('§10.12 — (P4) PageDown', p4, { start: 0, target: p4Target });

    // ---- (P5) Keyboard End ----
    await resetScrollTo(0);
    const p5 = await dispatchAndMeasure({ kind: 'key', payload: { key: 'End' }, midDelayMs: 60 });
    assertMomentum('§10.12 — (P5) End', p5, { start: 0, target: maxScroll });

    // ---- (P6) Keyboard Home (return from maxScroll) ----
    await resetScrollTo(maxScroll);
    const p6 = await dispatchAndMeasure({ kind: 'key', payload: { key: 'Home' }, midDelayMs: 60 });
    assertMomentum('§10.12 — (P6) Home', p6, { start: maxScroll, target: 0 });

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T07: all §10.12 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T07: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
