#!/usr/bin/env node
// T08 — Verify §10.13: "Single-finger touch drag scrolls on mobile/tablet with
// natural momentum and flick physics — feels like a real native app scroll,
// not a basic DOM scroll."
//
// Spec (extract line 1197, criterion #13):
//   "Single-finger touch drag scrolls on mobile/tablet with natural momentum
//    and flick physics — feels like a real native app scroll, not a basic
//    DOM scroll"
//
// §12 SCROLL VIEWPORT SPEC (extract line 1265):
//   "Mobile/touch: single-finger drag scrolls, momentum scrolling with flick
//    physics (natural decay)"
//
// Acceptance — §10.13 operationalises as three independent contracts:
//
//   (C1) DRAG CONTRACT — while one finger is down and moving, scrollY tracks
//        the finger 1:1 (pull up → scrollY rises; pull down → scrollY
//        falls). This is the baseline that distinguishes "drag scrolls" from
//        "tap ignored".
//
//   (C2) FLICK CONTRACT — if the finger is released with nontrivial velocity
//        (≥40px/s in the scroll-viewport impl), scrollY MUST continue moving
//        AFTER the release — i.e. y_post_release > y_at_release (up-flick)
//        or < (down-flick). This is the "flick physics" clause; a basic DOM
//        scroll would stop exactly at release.
//
//   (C3) DECAY CONTRACT — the post-release motion must be smooth, not
//        instant. Concretely: y sampled ~80ms after release is strictly
//        between y_at_release and y_final. A step-function (instant
//        assignment to target) would have y_early === y_final in IEEE-754
//        doubles; an eased GSAP tween produces float-level interpolation
//        noise between them. This is the "natural decay" clause.
//
//   (C4) WEAK-DRAG CONTRACT — a slow drag released below the flick velocity
//        threshold MUST NOT produce post-release momentum (scroll stops at
//        release). This is the counterweight to C2: "flick physics" means
//        flicks keep going AND slow-drags don't.
//
//   (C5) SINGLE-FINGER CONTRACT — a two-finger touchstart MUST NOT engage
//        the drag gesture at all. Spec names "single-finger touch drag" —
//        pinch/two-finger gestures are reserved for future zoom behaviour
//        and must not scroll.
//
// Inputs covered:
//   (P1) Up-flick  — 1-finger drag up 100px in ~200ms, release with velocity
//        ~500px/s → flick target ≈ +350px past release; total scroll ≈ 450px.
//   (P2) Down-flick — from y=600, drag finger down 100px in ~200ms, release
//        with velocity → flick target ≈ -350px past release; total ≈ 150px.
//   (P3) Slow drag — 1-finger drag up 20px over 640ms (velocity 31px/s <
//        40px/s threshold), release → scrollY stops at ~20px.
//   (P4) Two-finger touchstart — scrollY unchanged.
//
// Pre-conditions:
//   (A1) hub.layout.contentHeight > hub.layout.viewportHeight (scrollable)
//   (A2) initial scrollY === 0
//
// Strategy: spawn `npm run dev -- -p 4784`, driver at 1280×900 with
//   hasTouch:true (kept >=900px so the desktop layout's `[data-pane=preview]`
//   wrapper is present — see T05's SHOULD-FIX (a): mobile <900px layout has
//   no data-pane markers). Touch handlers on the canvas fire regardless of
//   viewport size. Dispatch TouchEvent/Touch in-page so step timing is
//   deterministic (Playwright RPC latency per call would dwarf the 15-20ms
//   inter-step intervals we need for realistic velocity).
//
// Port 4784 — avoids 4777 (browser-smoke), 4778 (T01), 4779 (T02),
// 4780 (T04), 4781 (T05), 4782 (T06), 4783 (T07).
//
// Run: node tests/lib/prism/player/T08.test.mjs

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4784;
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
    check('§10.13 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T08 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'load' });
    check('§10.13 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200, `status=${response?.status()}`);

    const prismReady = await page.waitForFunction(() => {
      const p = (window).__prism;
      return !!p && p.viewport && typeof p.viewport.getScrollY === 'function';
    }, { timeout: 30000 }).then(() => true).catch((e) => { serverLog.push(String(e)); return false; });
    check('§10.13 — window.__prism.viewport exposes getScrollY()',
      prismReady, prismReady ? '' : 'window.__prism.viewport.getScrollY never resolved');
    if (!prismReady) return;

    // (A1/A2) Scrollable hub + zeroed initial state.
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
    check('§10.13 — (A1) contentHeight > viewportHeight (hub is scrollable)',
      layout.contentHeight > layout.viewportHeight,
      `contentHeight=${layout.contentHeight} viewportHeight=${layout.viewportHeight}`);
    check('§10.13 — (A2) initial viewport.getScrollY() === 0',
      layout.initialScrollY === 0, `scrollY=${layout.initialScrollY}`);
    const maxScroll = Math.max(0, layout.contentHeight - layout.viewportHeight);

    const canvasRect = await page.evaluate(() => {
      const c = document.querySelector('[data-pane="preview"] canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    if (!canvasRect) { check('§10.13 — preview canvas has a bounding rect', false); return; }

    // Reset scroll instantaneously (duration:0 cancels any active tween) so
    // the next swipe starts from a known y.
    async function resetScrollTo(y) {
      await page.evaluate((target) => { (window).__prism.viewport.scrollTo(target, { duration: 0 }); }, y);
      await page.waitForTimeout(80);
    }

    // Run a 1-finger swipe in-page. startY = finger starting clientY;
    // signedDyPerStep > 0 means finger moves UP the screen (clientY
    // decreases), which in the impl produces positive dy -> scrollY
    // increases (content scrolls up). Negative means finger moves down
    // (clientY increases) -> scrollY decreases.
    // Headless Chromium throttles setTimeout to ~4fps (we measured ~365ms per
    // step with setTimeout(r, 20)), which drops the impl's dy/dt velocity
    // below its 40 px/s flick threshold. So we fire all touchmoves
    // synchronously and shim performance.now during the swipe — the impl
    // reads performance.now() directly for dt — so `dt` between moves is
    // exactly stepMs. performance.now is restored BEFORE touchend so the
    // GSAP tween that scrollTo starts runs on the real RAF clock.
    async function swipe1f({ startX, startY, steps, signedDyPerStep, stepMs }) {
      return await page.evaluate(({ startX, startY, steps, signedDyPerStep, stepMs }) => {
        const canvas = document.querySelector('[data-pane="preview"] canvas');
        if (!canvas) throw new Error('no preview canvas');
        const makeTouch = (y) => new Touch({
          identifier: 1, target: canvas, clientX: startX, clientY: y,
          radiusX: 1, radiusY: 1, force: 1,
        });
        const dispatch = (type, y) => {
          const t = makeTouch(y);
          const empty = type === 'touchend' || type === 'touchcancel';
          const e = new TouchEvent(type, {
            cancelable: true, bubbles: true,
            touches: empty ? [] : [t],
            targetTouches: empty ? [] : [t],
            changedTouches: [t],
          });
          canvas.dispatchEvent(e);
        };
        const origNow = performance.now.bind(performance);
        let fakeT = origNow();
        let y = startY;
        Object.defineProperty(performance, 'now', { value: () => fakeT, configurable: true });
        try {
          dispatch('touchstart', startY);
          for (let i = 1; i <= steps; i++) {
            fakeT += stepMs;
            y = startY - i * signedDyPerStep;
            dispatch('touchmove', y);
          }
          fakeT += 1;
        } finally {
          Object.defineProperty(performance, 'now', { value: origNow, configurable: true });
        }
        dispatch('touchend', y);
        return { scrollYAfterEnd: (window).__prism.viewport.getScrollY() };
      }, { startX, startY, steps, signedDyPerStep, stepMs });
    }

    // Two-finger touchstart (then release). Should do nothing.
    async function touch2fStartEnd({ startX, startY }) {
      await page.evaluate(({ startX, startY }) => {
        const canvas = document.querySelector('[data-pane="preview"] canvas');
        if (!canvas) throw new Error('no preview canvas');
        const make = (id, y, dx = 0) => new Touch({
          identifier: id, target: canvas, clientX: startX + dx, clientY: y,
          radiusX: 1, radiusY: 1, force: 1,
        });
        const t1 = make(1, startY, 0);
        const t2 = make(2, startY, 60);
        canvas.dispatchEvent(new TouchEvent('touchstart', {
          cancelable: true, bubbles: true,
          touches: [t1, t2], targetTouches: [t1, t2], changedTouches: [t1, t2],
        }));
        canvas.dispatchEvent(new TouchEvent('touchend', {
          cancelable: true, bubbles: true,
          touches: [], targetTouches: [], changedTouches: [t1, t2],
        }));
      }, { startX, startY });
    }

    const cx = canvasRect.left + canvasRect.width / 2;
    const cy = canvasRect.top + canvasRect.height / 2;
    const getScrollY = () => page.evaluate(() => (window).__prism.viewport.getScrollY());

    // ========================================================================
    // (P1) Up-flick — 1-finger drag up 100px in 200ms, release with velocity.
    //   Drag:  10 steps × 10px / 20ms each → 100px total, ~500px/s velocity.
    //   Flick: |flick|=500 ≥ 40 threshold → scrollTo(scrollY + 500*0.35)
    //   ≈ +175px past release. Duration = max(0.5, 500/1000) = 0.5s.
    // ========================================================================
    await resetScrollTo(0);
    await swipe1f({ startX: cx, startY: cy + 60, steps: 10, signedDyPerStep: 10, stepMs: 20 });
    // y_at_release: right after touchend has fired. Impl moves scrollY
    // synchronously during touchmove, so scrollY should equal total drag ≈100.
    const p1_atRelease = await getScrollY();
    await page.waitForTimeout(80);
    const p1_early = await getScrollY();
    await page.waitForTimeout(900);
    const p1_final = await getScrollY();

    // (C1) DRAG: scrollY rose during drag. y_at_release > 50 proves
    //   at least half the drag landed (conservative; headless Chromium
    //   can drop a frame or two so we don't demand exact 100).
    check('§10.13 — (P1·C1) up-drag moved scrollY during the gesture',
      p1_atRelease > 50,
      `y_at_release=${p1_atRelease.toFixed(2)} (expected > 50 from a 100px drag)`);

    // (C2) FLICK: y continued rising AFTER release. y_final significantly
    //   above y_at_release proves momentum, not a basic DOM stop.
    const p1_flickContinued = p1_final > p1_atRelease + 20;
    check('§10.13 — (P1·C2) up-flick scrollY continues past release (momentum)',
      p1_flickContinued,
      `y_at_release=${p1_atRelease.toFixed(2)} y_final=${p1_final.toFixed(2)} |diff|=${(p1_final - p1_atRelease).toFixed(2)} (expected > 20)`);

    // (C3) DECAY: y_early is strictly between y_at_release and y_final
    //   (not instant, not reversed). Allow 1px float slack on the bounds.
    const p1_inBetween = p1_early > p1_atRelease - 1 && p1_early < p1_final - 0.1;
    check('§10.13 — (P1·C3) up-flick decays smoothly (y_early between release and final)',
      p1_inBetween,
      `y_at_release=${p1_atRelease.toFixed(2)} y_early=${p1_early.toFixed(2)} y_final=${p1_final.toFixed(2)}`);

    // Bound the total excursion: impl schedules scrollTo(scrollY + flick*0.35)
    // with flick≈500px/s (dy=10/step, stepMs=20), so target ≈ 100 + 175 =
    // 275px. Generous tolerance (±80) absorbs headless RAF jitter on the
    // 0.5s post-release tween and any stepMs / dyPerStep slight mismatch
    // between shimmed and actual event-ordering.
    const p1_expectTotal = Math.min(maxScroll, 100 + Math.round(500 * 0.35));
    check('§10.13 — (P1) total scroll ≈ drag + flick ' + `(expect ≈${p1_expectTotal}px ±80)`,
      Math.abs(p1_final - p1_expectTotal) <= 80,
      `y_final=${p1_final.toFixed(2)} expected≈${p1_expectTotal}`);

    // ========================================================================
    // (P2) Down-flick — from mid-scroll, drag finger down 100px in 200ms.
    //   scrollY should decrease during drag and continue decreasing after.
    // ========================================================================
    const p2_start = 600;
    await resetScrollTo(p2_start);
    await swipe1f({ startX: cx, startY: cy - 60, steps: 10, signedDyPerStep: -10, stepMs: 20 });
    const p2_atRelease = await getScrollY();
    await page.waitForTimeout(80);
    const p2_early = await getScrollY();
    await page.waitForTimeout(900);
    const p2_final = await getScrollY();

    check('§10.13 — (P2·C1) down-drag moved scrollY down during the gesture',
      p2_atRelease < p2_start - 50,
      `y_at_release=${p2_atRelease.toFixed(2)} (expected < ${p2_start - 50} from a 100px drag down)`);
    check('§10.13 — (P2·C2) down-flick scrollY continues past release (momentum)',
      p2_final < p2_atRelease - 20,
      `y_at_release=${p2_atRelease.toFixed(2)} y_final=${p2_final.toFixed(2)} |diff|=${(p2_atRelease - p2_final).toFixed(2)} (expected > 20)`);
    const p2_inBetween = p2_early < p2_atRelease + 1 && p2_early > p2_final + 0.1;
    check('§10.13 — (P2·C3) down-flick decays smoothly (y_early between release and final)',
      p2_inBetween,
      `y_at_release=${p2_atRelease.toFixed(2)} y_early=${p2_early.toFixed(2)} y_final=${p2_final.toFixed(2)}`);

    // ========================================================================
    // (P3) Slow drag — velocity 31px/s (< 40px/s flick threshold).
    //   Drag 20px up over 640ms → no post-release continuation.
    // ========================================================================
    await resetScrollTo(0);
    // 8 steps × 2.5px / 80ms = 20px total, velocity = 2.5/80 = 0.031 px/ms
    // = 31.25 px/s → below the 40 px/s flick threshold in scroll-viewport.
    await swipe1f({ startX: cx, startY: cy + 60, steps: 8, signedDyPerStep: 2.5, stepMs: 80 });
    const p3_atRelease = await getScrollY();
    await page.waitForTimeout(800);
    const p3_final = await getScrollY();
    check('§10.13 — (P3·C1) slow-drag moved scrollY by drag distance',
      p3_atRelease > 10 && p3_atRelease < 30,
      `y_at_release=${p3_atRelease.toFixed(2)} (expected ≈ 20px from a 20px drag)`);
    // (C4) WEAK-DRAG: no flick, y must NOT continue. 2px tolerance
    //   accommodates a stray RAF tick but rules out any meaningful momentum.
    check('§10.13 — (P3·C4) slow-drag below flick threshold does NOT add momentum',
      Math.abs(p3_final - p3_atRelease) < 2,
      `y_at_release=${p3_atRelease.toFixed(2)} y_final=${p3_final.toFixed(2)} |drift|=${Math.abs(p3_final - p3_atRelease).toFixed(2)} (expected < 2)`);

    // ========================================================================
    // (P4) Two-finger touchstart — single-finger contract excludes pinches.
    //   scrollY must not change.
    // ========================================================================
    await resetScrollTo(400);
    const p4_before = await getScrollY();
    await touch2fStartEnd({ startX: cx, startY: cy });
    await page.waitForTimeout(120);
    const p4_after = await getScrollY();
    check('§10.13 — (P4·C5) two-finger touch does not engage drag (single-finger only)',
      Math.abs(p4_after - p4_before) < 0.5,
      `before=${p4_before.toFixed(2)} after=${p4_after.toFixed(2)} |drift|=${Math.abs(p4_after - p4_before).toFixed(2)}`);

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T08: all §10.13 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T08: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
