#!/usr/bin/env node
// T01 — Wire hub-router nav scroll + active-section indicator.
//
// Per mock spec §10.14:
//   "Nav link clicks (e.g., 'Features') scroll-animate to the corresponding
//   section using GSAP, with the active section indicated in the navbar via
//   overlay state."
//
// This test boots a production Next.js server, drives the page with Playwright,
// and exercises the hub-router through `window.__prism` debug hooks that the
// Prism boot orchestrator is expected to install:
//
//   window.__prism = {
//     router:   HubRouter   // { routes: Map, activeSectionId, activeNavLinkId, navigate(source) }
//     viewport: { getScrollY(): number, ... }
//     events:   EventBus    // with _recentEmissions ring
//     graph:    CompiledGraph
//     nodes:    Map<nodeId, NodeInstance>
//   }
//
// Acceptance checks (§10.14):
//   1. `window.__prism` exists and carries router + viewport + events + nodes.
//   2. Router has a route for every navbar-link-* source (home/editor/docs/pricing).
//   3. Emitting `navigate` with source=navbar-link-editor tweens scrollY from 0
//      toward the hero-section-bg y (~160) — assert 140 ≤ scrollY ≤ 200.
//   4. `router.activeSectionId` becomes `'hero'` after that navigation.
//   5. `events._recentEmissions` ring contains `active-section-changed`.
//   6. The navbar-link-editor node's container exposes a debug lock handle
//      (`container.__debug.getLocked()`) which reads `true` after navigation.
//   7. Re-navigating to `navbar-link-home` returns scrollY to ~0 AND transfers
//      the locked flag from editor → home.
//
// Fails closed: any missing hook, wrong scroll offset, or missing event flunks
// the test. Port 4778 is chosen to avoid collision with `browser-smoke.mjs`
// (which uses 4777).
//
// Run: node tests/lib/prism/player/T01.test.mjs

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');

const PORT = 4778;
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

async function main() {
  if (!existsSync(join(appRoot, 'public', 'prism-assets', 'mock-app.prism'))) {
    console.error('[T01] mock-app.prism missing — run `npm run build:prism` first');
    process.exit(1);
  }
  if (!existsSync(join(appRoot, '.next', 'BUILD_ID'))) {
    console.error('[T01] .next/ not built — run `npm run build` first');
    process.exit(1);
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
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    page.on('pageerror', (e) => console.error('[T01 pageerror]', e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500); // Let the Prism runtime mount.

    // ── 1. window.__prism installed with the expected surface ─────────────────
    const surface = await page.evaluate(() => {
      const p = globalThis.__prism;
      if (!p) return { ok: false, reason: '__prism missing' };
      const missing = [];
      if (!p.router) missing.push('router');
      if (!p.viewport) missing.push('viewport');
      if (!p.events) missing.push('events');
      if (!p.nodes) missing.push('nodes');
      if (missing.length) return { ok: false, reason: `missing: ${missing.join(', ')}` };
      if (typeof p.viewport.getScrollY !== 'function') return { ok: false, reason: 'viewport.getScrollY() missing' };
      if (!(p.router.routes instanceof Map)) return { ok: false, reason: 'router.routes not a Map' };
      return { ok: true };
    });
    check('§10.14 — window.__prism exposes { router, viewport, events, nodes, viewport.getScrollY() }',
      surface.ok, surface.reason ?? '');

    // ── 2. router has routes for navbar-link-{home,editor,docs,pricing} ───────
    const routesInfo = await page.evaluate(() => {
      const r = globalThis.__prism?.router;
      if (!r) return { ok: false, keys: [] };
      return { ok: true, keys: [...r.routes.keys()] };
    });
    const required = ['navbar-link-home', 'navbar-link-editor', 'navbar-link-docs', 'navbar-link-pricing'];
    const missing = required.filter((id) => !routesInfo.keys.includes(id));
    check('§10.14 — router has routes for every navbar-link (home/editor/docs/pricing)',
      missing.length === 0, missing.length ? `missing=${missing.join(',')}` : `keys=${routesInfo.keys.join(',')}`);

    // ── 3. navigate(navbar-link-editor) tweens scrollY to the hero section ────
    const before = await page.evaluate(() => globalThis.__prism?.viewport?.getScrollY?.() ?? null);
    await page.evaluate(() => globalThis.__prism?.events?.emit?.('navigate', { source: 'navbar-link-editor' }));
    await page.waitForTimeout(1400); // Let the GSAP tween settle (duration ~0.8s).
    const after = await page.evaluate(() => globalThis.__prism?.viewport?.getScrollY?.() ?? null);
    check('§10.14 — navigate(navbar-link-editor) scrolls toward hero y (140 ≤ y ≤ 200)',
      typeof after === 'number' && after >= 140 && after <= 200,
      `before=${before} after=${after}`);

    // ── 4. activeSectionId transitions to 'hero' ──────────────────────────────
    const activeSection = await page.evaluate(() => globalThis.__prism?.router?.activeSectionId ?? null);
    check('§10.14 — router.activeSectionId becomes "hero" after navbar-link-editor',
      activeSection === 'hero', `activeSectionId=${activeSection}`);

    // ── 5. event bus recorded active-section-changed ──────────────────────────
    const ring = await page.evaluate(() => globalThis.__prism?.events?._recentEmissions?.map?.((e) => e.event) ?? []);
    check('§10.14 — events._recentEmissions contains "active-section-changed"',
      ring.includes('active-section-changed'), `ring_tail=${ring.slice(-8).join(',')}`);

    // ── 6. navbar-link-editor locks its 'active' overlay ──────────────────────
    const editorLocked = await page.evaluate(() => {
      const inst = globalThis.__prism?.nodes?.get?.('navbar-link-editor');
      return inst?.container?.__debug?.getLocked?.() ?? null;
    });
    check('§10.14 — navbar-link-editor.container.__debug.getLocked() === true',
      editorLocked === true, `locked=${editorLocked}`);

    // ── 7. re-navigate to home transfers the lock and returns scrollY ≈ 0 ─────
    await page.evaluate(() => globalThis.__prism?.events?.emit?.('navigate', { source: 'navbar-link-home' }));
    await page.waitForTimeout(1400);
    const scrollHome = await page.evaluate(() => globalThis.__prism?.viewport?.getScrollY?.() ?? null);
    const editorAfter = await page.evaluate(() =>
      globalThis.__prism?.nodes?.get?.('navbar-link-editor')?.container?.__debug?.getLocked?.() ?? null);
    const homeAfter = await page.evaluate(() =>
      globalThis.__prism?.nodes?.get?.('navbar-link-home')?.container?.__debug?.getLocked?.() ?? null);
    check('§10.14 — navigate(navbar-link-home) returns scrollY ≈ 0 (< 10)',
      typeof scrollHome === 'number' && scrollHome < 10, `scrollY=${scrollHome}`);
    check('§10.14 — lock transfers editor → home (editorLocked=false, homeLocked=true)',
      editorAfter === false && homeAfter === true, `editorLocked=${editorAfter} homeLocked=${homeAfter}`);

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    server.kill('SIGTERM');
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T01: all §10.14 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T01: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
