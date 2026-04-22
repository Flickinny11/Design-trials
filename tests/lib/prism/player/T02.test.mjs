#!/usr/bin/env node
// T02 — Add responsive breakpoints to home-hub and boot.
//
// Per mock spec §10.15 (and engine schema §14 / extract lines 615-620):
//   "The layout is responsive: viewing at desktop wide (>1440px), desktop
//   (1024-1440), tablet (768-1024), and mobile (<768) each shows an
//   appropriately laid-out version. Node `transformByBreakpoint` entries are
//   respected; nodes with `visibleAtBreakpoints` restrictions hide/show
//   correctly."
//
// Acceptance contract for this task:
//
//   A. Pure helper  —  kid-kode-landing/src/lib/prism/player/breakpoints.mjs
//      exports classifyBreakpoint(width), resolveTransform(visual, active),
//      and isVisibleAtBreakpoint(visual, active) with exact breakpoint
//      semantics: >1440 → 'desktop-wide', 1024-1440 → 'desktop', 768-1023 →
//      'tablet', <768 → 'mobile'. resolveTransform prefers the active key,
//      falls back through desktop-wide→desktop→base, returns the base
//      `transform` when no override applies. isVisibleAtBreakpoint returns
//      true when visibleAtBreakpoints is absent OR the active breakpoint is
//      a member.
//
//   B. Data  —  home-hub.json has transformByBreakpoint declarations on at
//      least one representative node for every visible type required by the
//      task (navbar, hero, feature-card, settings, stats, footer), AND at
//      least one node uses visibleAtBreakpoints to exclude mobile (e.g.
//      secondary nav links).
//
//   C. Build  —  the compiled graph.json inside mock-app.prism retains those
//      declarations (the build pipeline propagates them unchanged).
//
//   D. Boot  —  kid-kode-landing/src/lib/prism/player/boot.ts imports the
//      breakpoints helper and wires it into node materialization + rebuild.
//
//   E. Runtime  —  mounting at a mobile viewport (720×900) installs
//      `window.__prism.currentBreakpoint === 'mobile'` AND excludes the
//      mobile-hidden nodes from __prism.nodes; mounting at a wide viewport
//      (1920×1080) resolves to 'desktop-wide' AND includes them.
//
// Run: node tests/lib/prism/player/T02.test.mjs

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4779; // distinct from 4777 (smoke) and 4778 (T01)
const URL = `http://localhost:${PORT}/`;

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

async function waitForServer(url, timeoutMs = 30000) {
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

// ══════════════════════════════════════════════════════════════════════════
// Phase A — pure helper unit tests
// ══════════════════════════════════════════════════════════════════════════

async function phaseA() {
  const helperPath = join(appRoot, 'src', 'lib', 'prism', 'player', 'breakpoints.mjs');
  if (!existsSync(helperPath)) {
    check('A0 — breakpoints.mjs helper exists', false, `expected ${helperPath}`);
    return; // downstream unit tests cannot run
  }
  check('A0 — breakpoints.mjs helper exists', true, helperPath);

  let mod;
  try {
    mod = await import(pathToFileURL(helperPath).href);
  } catch (e) {
    check('A0b — breakpoints.mjs imports cleanly', false, e.message);
    return;
  }
  check('A0b — breakpoints.mjs imports cleanly', true);

  check('A1 — exports classifyBreakpoint()',    typeof mod.classifyBreakpoint === 'function');
  check('A1 — exports resolveTransform()',       typeof mod.resolveTransform === 'function');
  check('A1 — exports isVisibleAtBreakpoint()',  typeof mod.isVisibleAtBreakpoint === 'function');

  if (typeof mod.classifyBreakpoint === 'function') {
    const cb = mod.classifyBreakpoint;
    const cases = [
      [1920, 'desktop-wide'],  // > 1440
      [1441, 'desktop-wide'],
      [1440, 'desktop'],       // 1024-1440 inclusive per §10.15
      [1200, 'desktop'],
      [1024, 'desktop'],
      [1023, 'tablet'],        // 768-1023 inclusive
      [ 900, 'tablet'],
      [ 768, 'tablet'],
      [ 767, 'mobile'],        // < 768
      [ 500, 'mobile'],
      [ 320, 'mobile'],
    ];
    for (const [w, want] of cases) {
      const got = cb(w);
      check(`A2 — classifyBreakpoint(${w}) === '${want}'`, got === want, `got '${got}'`);
    }
  }

  if (typeof mod.resolveTransform === 'function') {
    const rt = mod.resolveTransform;
    const base = { x: 0, y: 0, width: 1920, height: 80, z: 100 };
    const mobileXF = { x: 0, y: 0, width: 720, height: 56, z: 100 };
    const desktopXF = { x: 0, y: 0, width: 1280, height: 72, z: 100 };

    const r1 = rt({ transform: base, transformByBreakpoint: { mobile: mobileXF } }, 'mobile');
    check('A3 — resolveTransform picks active-breakpoint override', r1 === mobileXF || (r1 && r1.width === 720));

    const r2 = rt({ transform: base }, 'mobile');
    check('A3 — resolveTransform falls back to base when no override', r2 === base || (r2 && r2.width === 1920));

    const r3 = rt({ transform: base, transformByBreakpoint: { desktop: desktopXF } }, 'desktop-wide');
    check('A3 — resolveTransform falls back desktop-wide → desktop', r3 === desktopXF || (r3 && r3.width === 1280));

    const r4 = rt({ transform: base, transformByBreakpoint: { mobile: mobileXF, desktop: desktopXF } }, 'tablet');
    // tablet not declared; fallback chain should pick base (neither desktop nor mobile is a tablet-fallback)
    check('A3 — resolveTransform falls back tablet → base when only mobile/desktop declared',
          r4 === base || (r4 && r4.width === 1920),
          `got width=${r4 && r4.width}`);
  }

  if (typeof mod.isVisibleAtBreakpoint === 'function') {
    const vb = mod.isVisibleAtBreakpoint;
    check('A4 — isVisibleAtBreakpoint({}, mobile) === true',
          vb({}, 'mobile') === true);
    check('A4 — isVisibleAtBreakpoint(hide-mobile, mobile) === false',
          vb({ visibleAtBreakpoints: ['desktop-wide', 'desktop', 'tablet'] }, 'mobile') === false);
    check('A4 — isVisibleAtBreakpoint(hide-mobile, tablet) === true',
          vb({ visibleAtBreakpoints: ['desktop-wide', 'desktop', 'tablet'] }, 'tablet') === true);
    check('A4 — isVisibleAtBreakpoint(mobile-only, desktop-wide) === false',
          vb({ visibleAtBreakpoints: ['mobile'] }, 'desktop-wide') === false);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Phase B — home-hub.json declarations
// ══════════════════════════════════════════════════════════════════════════

function phaseB() {
  const hubPath = join(appRoot, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');
  const source = JSON.parse(readFileSync(hubPath, 'utf-8'));
  const byId = new Map(source.nodes.map((n) => [n.nodeId, n]));

  // Task note: "at least every visible node type (navbar, hero, feature-card,
  // settings, stats, footer)". For each type pick a representative that MUST
  // carry transformByBreakpoint.
  const required = {
    navbar:       'navbar-bg',
    hero:         'hero-card-bg',
    'feature-card': 'feature-card-1-bg',
    settings:     'settings-section-bg',
    stats:        'stats-card-bg',
    footer:       'footer-bg',
  };
  for (const [type, nodeId] of Object.entries(required)) {
    const n = byId.get(nodeId);
    const has = !!(n && n.visual && n.visual.transformByBreakpoint);
    check(`B1 — home-hub ${type} type (${nodeId}) declares transformByBreakpoint`, has);
  }

  // At least one node excludes mobile via visibleAtBreakpoints (proves the
  // hide-on-mobile pattern is wired).
  const hidesMobile = source.nodes.some(
    (n) =>
      Array.isArray(n.visual?.visibleAtBreakpoints) &&
      !n.visual.visibleAtBreakpoints.includes('mobile') &&
      n.visual.visibleAtBreakpoints.length > 0,
  );
  check('B2 — at least one node uses visibleAtBreakpoints to exclude mobile', hidesMobile);
}

// ══════════════════════════════════════════════════════════════════════════
// Phase C — compiled .prism artifact retains declarations
// ══════════════════════════════════════════════════════════════════════════

async function phaseC() {
  const prismPath = join(appRoot, 'public', 'prism-assets', 'mock-app.prism');
  if (!existsSync(prismPath)) {
    check('C0 — mock-app.prism present', false, `expected ${prismPath}`);
    return;
  }
  // `unzip -p` writes the entry to stdout — avoids pulling jszip in as a test dep.
  const r = spawnSync('unzip', ['-p', prismPath, 'graph.json'], { encoding: 'utf-8' });
  if (r.status !== 0 || !r.stdout) {
    check('C0 — extracted graph.json from artifact', false, r.stderr?.toString() ?? `status=${r.status}`);
    return;
  }
  let graph;
  try { graph = JSON.parse(r.stdout); } catch (e) {
    check('C0 — graph.json is valid JSON', false, e.message);
    return;
  }
  check('C0 — graph.json in artifact', true, `${graph.nodes.length} nodes`);

  const hasXFBP  = graph.nodes.some((n) => n.visual?.transformByBreakpoint);
  const hasVABP  = graph.nodes.some((n) => Array.isArray(n.visual?.visibleAtBreakpoints));
  check('C1 — compiled graph retains transformByBreakpoint on ≥1 node', hasXFBP);
  check('C1 — compiled graph retains visibleAtBreakpoints on ≥1 node', hasVABP);
}

// ══════════════════════════════════════════════════════════════════════════
// Phase D — boot.ts wiring (static source inspection)
// ══════════════════════════════════════════════════════════════════════════

function phaseD() {
  const bootPath = join(appRoot, 'src', 'lib', 'prism', 'player', 'boot.ts');
  const src = readFileSync(bootPath, 'utf-8');
  const importsBreakpoints = /from\s+['"](\.\/breakpoints(?:\.mjs)?)['"]/.test(src);
  const usesClassify = /classifyBreakpoint\s*\(/.test(src);
  const usesResolve = /resolveTransform\s*\(/.test(src);
  const usesVisible = /isVisibleAtBreakpoint\s*\(/.test(src);
  check('D1 — boot.ts imports from ./breakpoints(.mjs)', importsBreakpoints);
  check('D2 — boot.ts calls classifyBreakpoint()', usesClassify);
  check('D3 — boot.ts calls resolveTransform()', usesResolve);
  check('D4 — boot.ts calls isVisibleAtBreakpoint()', usesVisible);
}

// ══════════════════════════════════════════════════════════════════════════
// Phase E — runtime, two viewports
// ══════════════════════════════════════════════════════════════════════════

async function phaseE() {
  if (!existsSync(join(appRoot, 'public', 'prism-assets', 'mock-app.prism'))) {
    check('E0 — artifact present', false);
    return;
  }
  if (!existsSync(join(appRoot, '.next', 'BUILD_ID'))) {
    check('E0 — .next built', false);
    return;
  }
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (b) => process.stderr.write(b));

  try {
    const ok = await waitForServer(URL);
    if (!ok) throw new Error('server did not come up in 30s');

    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();

    // — wide desktop path —
    {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.error('[T02 pageerror wide]', e.message));
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3500);

      const info = await page.evaluate(() => {
        const p = globalThis.__prism;
        if (!p) return { ok: false, reason: '__prism missing' };
        const nodeIds = [...(p.nodes?.keys?.() ?? [])];
        return {
          ok: true,
          currentBreakpoint: p.currentBreakpoint ?? null,
          hasEditor: nodeIds.includes('navbar-link-editor'),
          hasSignin: nodeIds.includes('navbar-signin-btn'),
          count: nodeIds.length,
        };
      });
      check('E1 — wide viewport exposes __prism.currentBreakpoint === "desktop-wide"',
            info.ok && info.currentBreakpoint === 'desktop-wide',
            `info=${JSON.stringify(info)}`);
      check('E1 — wide viewport includes navbar-link-editor', info.ok && info.hasEditor === true);
      check('E1 — wide viewport includes navbar-signin-btn', info.ok && info.hasSignin === true);

      await context.close();
    }

    // — mobile path —
    {
      const context = await browser.newContext({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.error('[T02 pageerror mobile]', e.message));
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3500);

      const info = await page.evaluate(() => {
        const p = globalThis.__prism;
        if (!p) return { ok: false, reason: '__prism missing' };
        const nodeIds = [...(p.nodes?.keys?.() ?? [])];
        return {
          ok: true,
          currentBreakpoint: p.currentBreakpoint ?? null,
          hasEditor: nodeIds.includes('navbar-link-editor'),
          hasSignin: nodeIds.includes('navbar-signin-btn'),
          hasHome: nodeIds.includes('navbar-link-home'),
          count: nodeIds.length,
        };
      });
      check('E2 — mobile viewport exposes __prism.currentBreakpoint === "mobile"',
            info.ok && info.currentBreakpoint === 'mobile',
            `info=${JSON.stringify(info)}`);
      check('E2 — mobile viewport excludes navbar-link-editor',
            info.ok && info.hasEditor === false,
            `hasEditor=${info.hasEditor}`);
      check('E2 — mobile viewport excludes navbar-signin-btn',
            info.ok && info.hasSignin === false,
            `hasSignin=${info.hasSignin}`);
      check('E2 — mobile viewport still includes navbar-link-home',
            info.ok && info.hasHome === true);

      await context.close();
    }

    await browser.close();
  } catch (e) {
    check('fatal-E', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  await phaseA();
  phaseB();
  await phaseC();
  phaseD();
  await phaseE();

  if (failures.length === 0) {
    console.log(`\n${GREEN}T02: all §10.15 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T02: ${failures.length} check(s) failed${RESET}`);
    for (const f of failures) console.log(`  - ${f.label}${f.detail ? `  (${f.detail})` : ''}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
