#!/usr/bin/env node
// T12 — Verify §10.25: "Showing the running app to someone unfamiliar with
// the project, they should say it looks like a real product. Scrolling feels
// smooth. Hovering and clicking feel alive. Nothing looks like a wireframe
// or a design mockup."
//
// Spec ref: §10.25 (extract L1221, criterion #25)
//
// §10.25 is a subjective criterion, but its failure mode "looks like a
// wireframe" has an objective signature: unstyled rectangles and missing
// gradients manifest as large patches of pure gray/black/white — pixels with
// near-identical R/G/B values. A real product surface carries chroma
// (gradients, hue, color variation). T12 captures a screenshot of the PixiJS
// preview pane and asserts that no more than 15% of pixels are achromatic.
//
// "Wireframe-looking" here means: the pixel is visible (alpha >= 32) AND its
// channels are near-identical (|R-G|,|G-B|,|R-B| all <= 4) AND it is in the
// mid-tone range (max channel between 40 and 220). The mid-tone gate matters:
// pure-black dark backdrops (max < 40) are a legitimate dark-UI choice, not
// wireframe; near-white accents (max > 220) are highlights/cards, not
// wireframe. The true wireframe palette is mid-grey flat fills — that is
// what this metric isolates.
//
// The 15% ceiling comes from task.notes on T12 in ralph-state.json: it is a
// heuristic chosen as a proxy for "not wireframey" — low enough to catch
// large unstyled rectangles or a product that has regressed to a mockup,
// high enough that a polished product surface with small neutral accents
// (hairline rules, shadows, thin strokes) still passes.
//
// Acceptance contract on the running dev app at viewport 1440x900:
//
//   (A) INFRASTRUCTURE
//       A1 dev server boots, `/` -> HTTP 200
//       A2 page.goto(`/`) -> HTTP 200
//       A3 window.__prism exposed with hero-section-bg + hero-card-cta mounted
//       A4 [data-pane="preview"] resolves with non-zero bounds
//
//   (B) STABILIZE (same pattern as T11 — deterministic pixel capture)
//       B1 setInterval IDs cleared (pauses hero-section-bg i2v frame cycle)
//       B2 hero-section-bg children collapsed to frame 0 only
//       B3 post-pause render grace elapsed (PIXI ticker settles)
//
//   (C) CAPTURE
//       C1 [data-pane="preview"] screenshot captured as PNG buffer
//       C2 screenshot is a valid PNG (header magic bytes)
//       C3 screenshot is non-empty (>10 KB)
//
//   (D) WIREFRAME HEURISTIC — the §10.25 contract
//       D1 screenshot decodes to known dimensions (W*H > 100_000)
//       D2 visible-pixel fraction >= 15% (sanity floor — excludes empty frames)
//       D3 mid-tone achromatic fraction <= 15% of total pixels
//          (pixel is visible, chroma <= 4, max channel in [40, 220])
//       D4 debug PNGs written when D3 fails (T12-actual.png + T12-mask.png)
//
// Port 4788 — avoids 4777..4787 used by T01..T11.
//
// Run: node tests/lib/prism/player/T12.test.mjs

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');
const fixturesDir = join(repoRoot, 'tests', 'fixtures');
const actualPath = join(fixturesDir, 'T12-actual.png');
const maskPath = join(fixturesDir, 'T12-mask.png');

const PORT = 4788;
const URL = `http://localhost:${PORT}/`;

// Thresholds — see header comment for rationale.
const CHROMA_TOLERANCE = 4;    // max(|R-G|,|G-B|,|R-B|) <= 4 => achromatic
const ALPHA_MIN = 32;          // below this is effectively transparent
const MID_TONE_MIN = 40;       // max channel below this is "dark backdrop" — excluded
const MID_TONE_MAX = 220;      // max channel above this is "near-white highlight" — excluded
const VISIBLE_FRACTION_MIN = 0.15;  // sanity floor (D2)
const WIREFRAME_FRACTION_MAX = 0.15;  // §10.25 contract (D3)

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

// Walk the screenshot raw-buffer once, classifying each pixel as visible /
// transparent / achromatic. Returns fractions + a boolean mask (1 byte per
// pixel: 0xff = wireframe, 0x00 = not wireframe) for debug rendering.
async function wireframeScan(pngBuf) {
  const requireCjs = createRequire(join(appRoot, 'package.json'));
  const sharp = requireCjs('sharp');
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pixels = W * H;
  const mask = Buffer.alloc(pixels);
  let visible = 0;
  let wireframe = 0;
  for (let i = 0; i < pixels; i++) {
    const off = i * 4;
    const r = data[off], g = data[off + 1], b = data[off + 2], a = data[off + 3];
    if (a < ALPHA_MIN) continue;
    visible++;
    const maxCh = Math.max(r, g, b);
    if (maxCh < MID_TONE_MIN || maxCh > MID_TONE_MAX) continue; // dark/light, not wireframe
    const drg = Math.abs(r - g);
    const dgb = Math.abs(g - b);
    const drb = Math.abs(r - b);
    if (drg <= CHROMA_TOLERANCE && dgb <= CHROMA_TOLERANCE && drb <= CHROMA_TOLERANCE) {
      wireframe++;
      mask[i] = 0xff;
    }
  }
  // Build a debug-visualization PNG: wireframe pixels highlighted red,
  // non-wireframe visible pixels faded, transparent pixels black.
  const vis = Buffer.alloc(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    const off = i * 4;
    if (mask[i] === 0xff) {
      vis[off] = 0xff;
      vis[off + 1] = 0x00;
      vis[off + 2] = 0x00;
      vis[off + 3] = 0xff;
    } else {
      vis[off] = (data[off] * 0.3) | 0;
      vis[off + 1] = (data[off + 1] * 0.3) | 0;
      vis[off + 2] = (data[off + 2] * 0.3) | 0;
      vis[off + 3] = 0xff;
    }
  }
  const visBuffer = await sharp(vis, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return {
    W, H, pixels,
    visible,
    wireframe,
    visibleFrac: visible / pixels,
    wireframeFrac: wireframe / pixels,
    maskPng: visBuffer,
  };
}

async function main() {
  // Run the dev server in its own process group so a single kill(-pgid) takes
  // down npm, `next dev`, and the grandchild `next-server` in one go. Same
  // pattern as T11 — without this, orphaned next-server keeps pipes alive and
  // stalls test exit.
  const server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
    detached: true,
  });
  const serverLog = [];
  server.stdout.on('data', (b) => serverLog.push(b.toString()));
  server.stderr.on('data', (b) => { serverLog.push(b.toString()); });

  let browser;
  try {
    const ok = await waitForServer(URL);
    check('§10.25 A1 — `/` responds with HTTP 200',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    // Pause the hero-section-bg i2v frame cycle so successive runs produce
    // the same screenshot (same stabilization pattern as T11).
    await context.addInitScript(() => {
      const ids = new Set();
      const origSet = window.setInterval;
      const origClear = window.clearInterval;
      window.setInterval = function (fn, ms, ...args) {
        const id = origSet.call(window, fn, ms, ...args);
        ids.add(id);
        return id;
      };
      window.clearInterval = function (id) {
        ids.delete(id);
        return origClear.call(window, id);
      };
      window.__clearAllIntervals = () => {
        const n = ids.size;
        for (const id of ids) origClear.call(window, id);
        ids.clear();
        return n;
      };
    });

    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('[T12 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'load' });
    check('§10.25 A2 — page.goto(`/`) resolves with HTTP 200',
      !!response && response.status() === 200, `status=${response?.status()}`);

    const ready = await page.waitForFunction(() => {
      const p = /** @type {any} */ (window).__prism;
      return !!(p && p.nodes && p.nodes.has('hero-section-bg') && p.nodes.has('hero-card-cta'));
    }, null, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    check('§10.25 A3 — __prism exposed + hero-section-bg + hero-card-cta mounted',
      ready,
      ready ? '' : `__prism never exposed expected nodes — tail:\n${serverLog.join('').slice(-1000)}`);
    if (!ready) return;

    const previewBounds = await page.evaluate(() => {
      const el = document.querySelector('[data-pane="preview"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    check('§10.25 A4 — [data-pane="preview"] locator resolves with non-zero bounds',
      !!previewBounds && previewBounds.w > 100 && previewBounds.h > 100,
      `bounds=${JSON.stringify(previewBounds)}`);
    if (!previewBounds) return;

    // (B) Stabilize.
    const clearedCount = await page.evaluate(() => /** @type {any} */ (window).__clearAllIntervals());
    check('§10.25 B1 — setInterval IDs cleared (pauses hero-section-bg frame cycle)',
      clearedCount >= 1, `cleared=${clearedCount}`);

    const collapsed = await page.evaluate(() => {
      const p = /** @type {any} */ (window).__prism;
      const inst = p.nodes.get('hero-section-bg');
      if (!inst || !inst.container || !inst.container.children) return { ok: false, kids: 0 };
      const kids = inst.container.children;
      let visible0 = 0, hiddenOthers = 0;
      kids.forEach((s, i) => {
        s.visible = i === 0;
        if (i === 0 && s.visible) visible0++;
        if (i !== 0 && !s.visible) hiddenOthers++;
      });
      return { ok: true, total: kids.length, visible0, hiddenOthers };
    });
    check('§10.25 B2 — hero-section-bg collapsed to frame 0',
      collapsed.ok && collapsed.visible0 === 1 && collapsed.hiddenOthers === (collapsed.total - 1),
      `state=${JSON.stringify(collapsed)}`);

    await page.waitForTimeout(250);
    check('§10.25 B3 — post-pause render grace elapsed', true, 'waited 250ms');

    // (C) Capture.
    const previewLocator = page.locator('[data-pane="preview"]');
    const shot = await previewLocator.screenshot({ type: 'png' });
    check('§10.25 C1 — [data-pane="preview"] screenshot captured',
      Buffer.isBuffer(shot) && shot.length > 0,
      `bytes=${shot?.length}`);

    const isPng = shot.length >= 8 &&
      shot[0] === 0x89 && shot[1] === 0x50 && shot[2] === 0x4e && shot[3] === 0x47 &&
      shot[4] === 0x0d && shot[5] === 0x0a && shot[6] === 0x1a && shot[7] === 0x0a;
    check('§10.25 C2 — screenshot is a valid PNG (magic bytes)',
      isPng, `header=${[...shot.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);

    check('§10.25 C3 — screenshot is non-empty (>10 KB)',
      shot.length > 10_000, `bytes=${shot.length}`);

    if (!existsSync(fixturesDir)) mkdirSync(fixturesDir, { recursive: true });

    // (D) Wireframe heuristic.
    const scan = await wireframeScan(shot);
    check('§10.25 D1 — screenshot decodes to known dimensions (W*H > 100_000 px)',
      scan.pixels > 100_000, `${scan.W}x${scan.H} = ${scan.pixels} px`);

    const visPct = (scan.visibleFrac * 100).toFixed(2);
    check(`§10.25 D2 — visible-pixel fraction >= ${(VISIBLE_FRACTION_MIN * 100).toFixed(0)}% (sanity floor)`,
      scan.visibleFrac >= VISIBLE_FRACTION_MIN,
      `visible=${visPct}% (${scan.visible}/${scan.pixels} px, alpha>=${ALPHA_MIN})`);

    const wfPct = (scan.wireframeFrac * 100).toFixed(3);
    const wfDetail = `wireframe=${wfPct}% (${scan.wireframe}/${scan.pixels} px, |chroma|<=${CHROMA_TOLERANCE}, maxCh in [${MID_TONE_MIN},${MID_TONE_MAX}], alpha>=${ALPHA_MIN})`;
    check(`§10.25 D3 — mid-tone achromatic fraction <= ${(WIREFRAME_FRACTION_MAX * 100).toFixed(0)}% (§10.25 wireframe heuristic)`,
      scan.wireframeFrac <= WIREFRAME_FRACTION_MAX,
      wfDetail);

    if (scan.wireframeFrac > WIREFRAME_FRACTION_MAX) {
      writeFileSync(actualPath, shot);
      writeFileSync(maskPath, scan.maskPng);
      check('§10.25 D4 — actual + wireframe mask written for debugging',
        existsSync(actualPath) && existsSync(maskPath),
        `actual=${actualPath} mask=${maskPath}`);
    } else {
      check('§10.25 D4 — actual + wireframe mask not needed (D3 passed)',
        true, 'skipped — surface within wireframe budget');
    }
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    // Cap cleanup at 10s: the browser handle and dev-server process group can
    // occasionally refuse to close cleanly in headless Chromium; the
    // assertion output above has already been flushed, we just need to exit.
    const forceExit = setTimeout(() => {
      console.log(`${RED}T12: force-exit after cleanup stalled${RESET}`);
      process.exit(failures.length === 0 ? 0 : 1);
    }, 10000);
    forceExit.unref?.();

    try {
      if (browser) {
        await Promise.race([
          browser.close(),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      }
    } catch { /* ignore */ }
    try {
      if (server.pid) process.kill(-server.pid, 'SIGKILL');
    } catch {
      try { server.kill('SIGKILL'); } catch { /* ignore */ }
    }
    try { server.stdout?.removeAllListeners(); server.stdout?.destroy(); } catch { /* ignore */ }
    try { server.stderr?.removeAllListeners(); server.stderr?.destroy(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T12: all §10.25 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T12: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
