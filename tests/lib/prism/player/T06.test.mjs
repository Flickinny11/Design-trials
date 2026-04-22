#!/usr/bin/env node
// T06 — Verify §10.11: "Hovering, clicking, and interacting with elements
// fires the declared events from their NodeIntent and applies the declared
// state effects using overlay layers (method 3) and/or GSAP transforms
// (method 2), never CSS."
//
// Spec (extract line 1193):
//   "Hovering, clicking, and interacting with elements fires the declared
//    events from their NodeIntent and applies the declared state effects
//    using overlay layers (method 3) and/or GSAP transforms (method 2),
//    never CSS"
//
// Acceptance (positive + negative evidence):
//   POSITIVE — hover over the hero CTA sprite triggers method-2 GSAP
//   transforms AND method-3 overlay-layer state effects:
//     (P1) base sprite scale tweens up from 1.0 → ~1.03 (Method 2)
//     (P2) glow overlay alpha tweens up from 0 → ~0.6 (Method 3)
//     (P3) shimmer overlay alpha tweens up from 0 → > 0  (Method 3)
//   NEGATIVE — pointer interaction does NOT trigger CSS-side state effects:
//     (N1) no descendant of [data-pane="preview"] gains a NEW inline
//          `style.background`, `style.border`, `style.boxShadow`, or
//          `style.backgroundImage` between pre-hover and post-hover snapshots
//   REVERSAL — pointerout returns the GSAP-driven alphas to their resting
//   state (proves the effect is tween-driven, not a one-shot CSS swap):
//     (R1) glow.alpha returns toward 0 (≤ 0.1) within ~400ms
//
// Strategy: spawn `npm run dev -- -p 4782`, drive Playwright at 1920×1080
// (page.tsx switches to a vertical stack < 900px so we'd lose the canvas
// geometry), wait for window.__prism + the hero-card-cta NodeInstance, then
// derive the canvas-pixel center of the CTA from the CTA container's PIXI
// position scaled by the canvas DOM rect ÷ hub.layout.viewport{Width,Height}.
// Layers (glow / base / shimmer) are addressed by .label so child-index
// drift in hero-card-cta.js can't make this test silently pass.
//
// Port 4782 — avoids 4777 (browser-smoke), 4778 (T01), 4779 (T02), 4780 (T04),
// 4781 (T05).
//
// Run: node tests/lib/prism/player/T06.test.mjs

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4782;
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
    check('§10.11 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T06 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'load' });
    check('§10.11 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200,
      `status=${response?.status()}`);

    // Wait for PrismHost to mount and window.__prism to expose the hero CTA.
    const prismReady = await page.waitForFunction(() => {
      const p = (window).__prism;
      return !!p && p.nodes && p.nodes.get && !!p.nodes.get('hero-card-cta');
    }, { timeout: 30000 }).then(() => true).catch((e) => { serverLog.push(String(e)); return false; });
    check('§10.11 — window.__prism exposes hero-card-cta NodeInstance',
      prismReady, prismReady ? '' : 'window.__prism.nodes.get("hero-card-cta") never resolved');
    if (!prismReady) return;

    // Read the layer alphas + derive the CTA's canvas-pixel center.
    function readState() {
      return page.evaluate(() => {
        const prism = (window).__prism;
        if (!prism) return { error: 'no __prism' };
        const node = prism.nodes.get('hero-card-cta');
        if (!node) return { error: 'no node' };
        const c = node.container;
        const findChild = (label) => c.children.find((ch) => ch.label === label);
        const glow = findChild('glow');
        const base = findChild('base');
        const shimmer = findChild('shimmer');
        // Walk parents to compute global PIXI coords.
        let gx = 0, gy = 0;
        for (let cur = c; cur; cur = cur.parent) {
          gx += cur.x ?? 0;
          gy += cur.y ?? 0;
        }
        const canvas = document.querySelector('[data-pane="preview"] canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : null;
        const hub = prism.graph.hubs[0];
        return {
          glowFound: !!glow,
          baseFound: !!base,
          shimmerFound: !!shimmer,
          glowAlpha: glow ? glow.alpha : null,
          shimmerAlpha: shimmer ? shimmer.alpha : null,
          baseScaleX: base ? base.scale.x : null,
          baseScaleY: base ? base.scale.y : null,
          pixiCenterX: gx + 240 / 2,
          pixiCenterY: gy + 64 / 2,
          domLeft: rect ? rect.left : null,
          domTop: rect ? rect.top : null,
          domWidth: rect ? rect.width : null,
          domHeight: rect ? rect.height : null,
          logicalW: hub.layout.viewportWidth,
          logicalH: hub.layout.viewportHeight,
        };
      });
    }

    function snapshotInlineStyles() {
      return page.evaluate(() => {
        const root = document.querySelector('[data-pane="preview"]');
        if (!root) return [];
        const out = [];
        const walk = (el) => {
          if (!(el instanceof HTMLElement)) return;
          const s = el.style;
          // Collect attribute strings that signal CSS-driven visual state effects.
          const pairs = [
            ['background', s.background],
            ['backgroundColor', s.backgroundColor],
            ['backgroundImage', s.backgroundImage],
            ['border', s.border],
            ['borderColor', s.borderColor],
            ['boxShadow', s.boxShadow],
          ].filter(([, v]) => v && v !== '' && v !== 'none' && v !== 'rgba(0, 0, 0, 0)');
          if (pairs.length) {
            out.push({ tag: el.tagName, id: el.id || null, cls: el.className || null, pairs });
          }
          for (const child of Array.from(el.children)) walk(child);
        };
        walk(root);
        return out;
      });
    }

    const initial = await readState();
    if (initial.error) { check('§10.11 — read initial PIXI state', false, initial.error); return; }

    check('§10.11 — hero-card-cta layers labelled (glow/base/shimmer)',
      initial.glowFound && initial.baseFound && initial.shimmerFound,
      `glow=${initial.glowFound} base=${initial.baseFound} shimmer=${initial.shimmerFound}`);

    check('§10.11 — initial glow.alpha === 0 (Method-3 overlay starts hidden)',
      initial.glowAlpha === 0, `glow.alpha=${initial.glowAlpha}`);
    check('§10.11 — initial shimmer.alpha === 0 (Method-3 overlay starts hidden)',
      initial.shimmerAlpha === 0, `shimmer.alpha=${initial.shimmerAlpha}`);
    // base.scale at rest is whatever PIXI derived from base.width / texture.width
    // (the spec node sets sprite.width=240 against a non-240 texture, so scale
    // is fractional — the spec's gsap.to(base.scale,{x:1.03}) target is
    // absolute, not relative). We just snapshot the rest scale and assert
    // monotonicity in P1 / R1.
    check('§10.11 — initial base.scale captured (Method-2 GSAP at rest)',
      initial.baseScaleX !== null && initial.baseScaleY !== null && initial.baseScaleX > 0,
      `rest base.scale=(${(initial.baseScaleX ?? 0).toFixed(3)},${(initial.baseScaleY ?? 0).toFixed(3)})`);

    const cssBefore = await snapshotInlineStyles();

    // Move the mouse to the CTA's center (canvas-pixel coords).
    const scaleX = initial.domWidth / initial.logicalW;
    const scaleY = initial.domHeight / initial.logicalH;
    const domX = initial.domLeft + initial.pixiCenterX * scaleX;
    const domY = initial.domTop  + initial.pixiCenterY * scaleY;
    // Move from a "neutral" corner to ensure pointermove crosses into the CTA's
    // hit-area rather than starting inside it (PIXI distinguishes pointerover
    // from pointermove based on enter/exit transitions).
    await page.mouse.move(0, 0);
    await page.mouse.move(domX, domY, { steps: 8 });

    // Allow GSAP tweens to advance: glow tween is 0.2s, shimmer fromTo is 0.6s.
    await page.waitForTimeout(450);

    const hovered = await readState();
    // Hover should monotonically increase base.scale from its rest value (the
    // spec's gsap.to target is 1.03; rest is whatever PIXI derived).
    check('§10.11 — POSITIVE (P1): hover scales base sprite up via GSAP (Method 2)',
      hovered.baseScaleX > initial.baseScaleX + 1e-3 && hovered.baseScaleY > initial.baseScaleY + 1e-3,
      `rest=(${initial.baseScaleX.toFixed(3)},${initial.baseScaleY.toFixed(3)}) → hover=(${(hovered.baseScaleX ?? 0).toFixed(3)},${(hovered.baseScaleY ?? 0).toFixed(3)})`);

    check('§10.11 — POSITIVE (P2): hover raises glow.alpha via GSAP overlay layer (Method 3)',
      hovered.glowAlpha > 0.3,
      `glow.alpha=${(hovered.glowAlpha ?? 0).toFixed(3)}`);

    check('§10.11 — POSITIVE (P3): hover raises shimmer.alpha via GSAP overlay layer (Method 3)',
      hovered.shimmerAlpha > 0,
      `shimmer.alpha=${(hovered.shimmerAlpha ?? 0).toFixed(3)}`);

    const cssAfter = await snapshotInlineStyles();
    // Convert each entry to a stable string for set diff.
    const stringify = (xs) =>
      xs.map((e) => `${e.tag}#${e.id || ''}.${e.cls || ''}|${e.pairs.map(([k, v]) => `${k}=${v}`).join(';')}`);
    const before = new Set(stringify(cssBefore));
    const newCssWrites = stringify(cssAfter).filter((s) => !before.has(s));
    check('§10.11 — NEGATIVE (N1): hover did not add inline CSS background/border/boxShadow/backgroundImage in [data-pane="preview"]',
      newCssWrites.length === 0,
      newCssWrites.length ? `new entries: ${newCssWrites.slice(0, 3).join(' | ')}` : 'no new inline-style writes');

    // REVERSAL — move the cursor with explicit steps to a position OUTSIDE
    // the preview canvas (past the split-pane drag handle, into the graph
    // pane) so PIXI definitively dispatches pointerout against the CTA
    // container. Wait long enough for the glow tween (0.2s) to finish.
    const outsideX = Math.max(initial.domLeft + initial.domWidth + 10, 1500);
    await page.mouse.move(outsideX, 60, { steps: 10 });
    await page.waitForTimeout(700);
    const released = await readState();
    check('§10.11 — REVERSAL (R1): pointerout unwinds glow.alpha back toward 0 via GSAP',
      released.glowAlpha !== null && released.glowAlpha <= 0.1,
      `glow.alpha=${(released.glowAlpha ?? 0).toFixed(3)}`);

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T06: all §10.11 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T06: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
