#!/usr/bin/env node
// T09 — Verify §10.16: "Every interactive sprite responds to pointerover/
// pointerout/pointerdown/pointerup/pointertap with visible state feedback —
// the app feels alive, not like a static image with click regions."
//
// Spec (extract L1203, criterion #16):
//   "Every interactive sprite responds to pointerover/pointerout/pointerdown/
//    pointerup/pointertap with visible state feedback — the app feels alive,
//    not like a static image with click regions"
//
// Acceptance — §10.16 operationalises per interactive node as TWO contracts:
//
//   (C0) HANDLER REGISTRATION — for each of the five pointer events, the
//        node's PIXI Container MUST have ≥1 registered listener. Proof of
//        declared feedback. Uses the EventEmitter `.listenerCount(event)`
//        API that PIXI v8's Container inherits.
//
//   (C1–C5) VISIBLE FEEDBACK — firing each event in sequence from a known
//        prior state MUST produce a fingerprint delta in the container
//        subtree (any of: position, scale, alpha, tint on any descendant).
//        For pointertap, the feedback may alternatively be a new event-bus
//        emission carrying {source:nodeId} — pointertap often triggers
//        app-level navigation/toggles rather than sprite-local visual flash,
//        which still satisfies "the app feels alive".
//
// Interactive node set comes from home-hub.json: nodes with non-empty
// `intent.behaviorSpec.interactions` — 16 nodes at time of writing:
//   navbar-logo, navbar-link-{home,editor,docs,pricing}, navbar-signin-btn,
//   hero-card-cta, notifications-toggle, theme-selector-button,
//   footer-logo, footer-link-{privacy,terms,contact},
//   footer-social-{twitter,github,discord}.
//
// Strategy: boot a real dev server, wait for __prism.nodes to populate.
// For each interactive node, walk its Container via window.__prism.nodes
// and (a) count registered listeners per event, (b) fire each event via
// EventEmitter `.emit()` with GSAP allowed to tick, sampling fingerprint
// deltas. `.emit()` invokes the exact handlers registered by `.on()` — the
// same path PIXI's federated event dispatch would take when a real pointer
// enters the sprite. This bypasses hit-testing (orthogonal to §10.16 which
// only asks whether the sprite RESPONDS, not whether it's correctly laid
// out) and avoids having to scroll the viewport to bring footer nodes into
// screen space.
//
// Event sequencing between fires: pointerover → pointerdown → pointerup →
// pointertap → pointerout. Each transition has its own fingerprint
// snapshot pair, with a settle window after pointerover and pointerdown so
// GSAP tweens have played out enough to shift the fingerprint past
// IEEE-754 float precision. 80–200ms settle is sufficient for the 0.15–
// 0.2s GSAP durations the node modules use.
//
// Port 4785 — avoids 4777 (browser-smoke), 4778 (T01), 4779 (T02),
// 4780 (T04), 4781 (T05), 4782 (T06), 4783 (T07), 4784 (T08).
//
// Run: node tests/lib/prism/player/T09.test.mjs

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4785;
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

const INTERACTIVE_NODE_IDS = [
  'navbar-logo',
  'navbar-link-home',
  'navbar-link-editor',
  'navbar-link-docs',
  'navbar-link-pricing',
  'navbar-signin-btn',
  'hero-card-cta',
  'notifications-toggle',
  'theme-selector-button',
  'footer-logo',
  'footer-link-privacy',
  'footer-link-terms',
  'footer-link-contact',
  'footer-social-twitter',
  'footer-social-github',
  'footer-social-discord',
];

const POINTER_EVENTS = ['pointerover', 'pointerdown', 'pointerup', 'pointertap', 'pointerout'];

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
    check('§10.16 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T09 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'load' });
    check('§10.16 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200, `status=${response?.status()}`);

    // Wait for __prism.nodes to be populated with all 16 interactive nodes.
    const prismReady = await page.waitForFunction((ids) => {
      const p = (window).__prism;
      if (!p || !p.nodes) return false;
      return ids.every((id) => p.nodes.has(id));
    }, INTERACTIVE_NODE_IDS, { timeout: 30000 })
      .then(() => true)
      .catch((e) => { serverLog.push(String(e)); return false; });

    check('§10.16 — window.__prism.nodes exposes all 16 interactive nodes',
      prismReady,
      prismReady ? '' : `__prism.nodes never reached full interactive set — tail:\n${serverLog.join('').slice(-1000)}`);
    if (!prismReady) return;

    // Per-node drill — registration + visible-feedback deltas across the
    // five pointer events in sequence.
    for (const nodeId of INTERACTIVE_NODE_IDS) {
      const result = await page.evaluate(async ({ nodeId, events }) => {
        const p = (window).__prism;
        const inst = p.nodes.get(nodeId);
        if (!inst) return { error: `no node instance for ${nodeId}` };
        const c = inst.container;
        if (!c) return { error: `no container on node ${nodeId}` };

        // Fingerprint walks the entire container subtree and concatenates
        // (x, y, scaleX, scaleY, alpha, tint) per DisplayObject. Using 4
        // decimal places keeps IEEE-754 float noise from producing
        // false-positive deltas while still catching real GSAP mid-tween
        // progress (< 4 decimal drift does not happen during 0.15s+ tweens).
        function fingerprint(root) {
          const parts = [];
          const visit = (n) => {
            const x = (n.position && typeof n.position.x === 'number') ? n.position.x : 0;
            const y = (n.position && typeof n.position.y === 'number') ? n.position.y : 0;
            const sx = (n.scale && typeof n.scale.x === 'number') ? n.scale.x : 1;
            const sy = (n.scale && typeof n.scale.y === 'number') ? n.scale.y : 1;
            const a  = (typeof n.alpha === 'number') ? n.alpha : 1;
            const t  = (typeof n.tint === 'number') ? n.tint : 0xFFFFFF;
            parts.push([x, y, sx, sy, a, t].map((v) =>
              typeof v === 'number' ? v.toFixed(4) : String(v)
            ).join(','));
            const kids = n.children || [];
            for (const k of kids) visit(k);
          };
          visit(root);
          return parts.join('|');
        }

        const listenerCounts = {};
        for (const ev of events) {
          listenerCounts[ev] = (typeof c.listenerCount === 'function')
            ? c.listenerCount(ev) : -1;
        }

        // Fire events sequentially. Settle windows chosen per-event to sit
        // inside the GSAP tween's active window (durations 0.15–0.2s):
        //   pointerover: 150ms — mid-tween of 0.2s hover animations.
        //   pointerdown:  80ms — mid-tween of 0.08s press.
        //   pointerup:   100ms — mid-tween of 0.12s release.
        //   pointertap:  180ms — captures any tap flash AND event-bus side effects.
        //   pointerout:  150ms — mid-tween of 0.18s unwind.
        // Between transitions we add a settle of >= the longest active tween
        // duration so the next "from" state is genuinely stable.
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));

        const fpRest = fingerprint(c);

        // pointerover — expected to move from rest to hover state.
        c.emit('pointerover');
        await wait(150);
        const fpOver = fingerprint(c);
        await wait(200); // let hover tween settle (0.15–0.2s)

        // pointerdown — press state.
        const fpAfterOverSettled = fingerprint(c);
        c.emit('pointerdown');
        await wait(90);
        const fpDown = fingerprint(c);
        await wait(120); // let press tween settle (0.08s)

        // pointerup — release from press.
        const fpAfterDownSettled = fingerprint(c);
        c.emit('pointerup');
        await wait(100);
        const fpUp = fingerprint(c);
        await wait(180); // let release tween settle (0.12s back.out)

        // pointertap — may produce sprite delta (yoyo glow, layer swap) OR
        // emit event bus (navigate, open-modal, theme-changed, etc.). Both
        // satisfy "visible state feedback" per §10.16.
        const busRecentBefore = Array.isArray(p.events && p.events._recentEmissions)
          ? p.events._recentEmissions.length : -1;
        const fpAfterUpSettled = fingerprint(c);
        c.emit('pointertap');
        await wait(180);
        const fpTap = fingerprint(c);
        const busRecentAfter = Array.isArray(p.events && p.events._recentEmissions)
          ? p.events._recentEmissions.length : -1;
        // Check for a new emission from this node since the tap.
        let tapEmittedFromSource = false;
        if (p.events && Array.isArray(p.events._recentEmissions)) {
          const recent = p.events._recentEmissions;
          // New entries since before the tap — source-matched only.
          for (let i = Math.max(0, busRecentBefore); i < recent.length; i++) {
            const entry = recent[i];
            const payload = entry && entry.payload;
            if (payload && typeof payload === 'object' && payload.source === nodeId) {
              tapEmittedFromSource = true;
              break;
            }
          }
        }
        await wait(200); // settle any tap side effects

        // pointerout — unwind from whatever state we're in (hover or rest-
        // after-yoyo). Should tween back to rest.
        const fpAfterTapSettled = fingerprint(c);
        c.emit('pointerout');
        await wait(150);
        const fpOut = fingerprint(c);

        return {
          listenerCounts,
          fpRest,
          fpOver,
          fpAfterOverSettled,
          fpDown,
          fpAfterDownSettled,
          fpUp,
          fpAfterUpSettled,
          fpTap,
          fpAfterTapSettled,
          fpOut,
          tapEmittedFromSource,
          busRecentBefore,
          busRecentAfter,
        };
      }, { nodeId, events: POINTER_EVENTS });

      if (result.error) {
        check(`§10.16 — [${nodeId}] fetch`, false, result.error);
        continue;
      }

      // (C0) listener registration — combined assertion, with per-event gap
      // listed in the failure detail so the engineer can fix multiple gaps
      // in one pass.
      const gaps = POINTER_EVENTS.filter((ev) => (result.listenerCounts[ev] ?? 0) < 1);
      check(`§10.16 — [${nodeId}] C0 all five pointer events have ≥1 listener`,
        gaps.length === 0,
        gaps.length
          ? `missing: ${gaps.join(', ')} — counts=${JSON.stringify(result.listenerCounts)}`
          : `counts=${JSON.stringify(result.listenerCounts)}`);

      // (C1) pointerover — rest → hover produces a fingerprint delta.
      check(`§10.16 — [${nodeId}] C1 pointerover produces visible state change`,
        result.fpOver !== result.fpRest,
        `rest==hover fingerprints equal (no handler or no-op handler)`);

      // (C2) pointerdown — hover(settled) → press produces a delta.
      check(`§10.16 — [${nodeId}] C2 pointerdown produces visible state change`,
        result.fpDown !== result.fpAfterOverSettled,
        `hover==press fingerprints equal (no pointerdown handler or no-op)`);

      // (C3) pointerup — press(settled) → hover-after-press produces a delta.
      check(`§10.16 — [${nodeId}] C3 pointerup produces visible state change`,
        result.fpUp !== result.fpAfterDownSettled,
        `press==release fingerprints equal (no pointerup handler or no-op)`);

      // (C4) pointertap — sprite delta OR new event-bus emission from this node.
      const tapVisuallyChanged = result.fpTap !== result.fpAfterUpSettled;
      const tapProducesFeedback = tapVisuallyChanged || result.tapEmittedFromSource;
      check(`§10.16 — [${nodeId}] C4 pointertap produces visible feedback (sprite delta OR event emission)`,
        tapProducesFeedback,
        tapProducesFeedback
          ? (tapVisuallyChanged ? 'sprite delta' : 'event-bus emission')
          : `no sprite delta AND no bus emission from ${nodeId} — bus size ${result.busRecentBefore}→${result.busRecentAfter}`);

      // (C5) pointerout — tap-settled → rest produces a delta.
      check(`§10.16 — [${nodeId}] C5 pointerout produces visible state change`,
        result.fpOut !== result.fpAfterTapSettled,
        `tap-settled==rest-after-out fingerprints equal (no pointerout handler or no-op)`);
    }

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T09: all §10.16 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T09: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
