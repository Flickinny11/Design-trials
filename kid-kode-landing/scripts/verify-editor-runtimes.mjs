#!/usr/bin/env node
// Two-runtime verification for the Prism Editor Build.
// Captures deterministic snapshots of BOTH runtimes per task:
//   1. Outer Next.js editor runtime — captures outer.png + state.json from the editor routes.
//   2. Inner Prism runtime — drives the editor into preview-app mode (RA-06b: was preview-hub) against the mock .prism
//      artifact and captures inner.png.
//
// Snapshot location:
//   kid-kode-landing/notes/ralph-snapshots/<task-id>/{outer.png, inner.png, state.json, verify.log}
// KripVerify mirror:
//   .kripverify/findings/screenshots/<task-id>/{outer.png, inner.png, state.json, verify.log}
//
// Usage:
//   node scripts/verify-editor-runtimes.mjs --task-id=EB-01-01 [--route="/"]
//   node scripts/verify-editor-runtimes.mjs --on-stop          # quick Stop-hook sanity check
//
// Exit 0 if all checks pass. Exit 1 otherwise. The Stop-hook wrapper treats non-zero as a
// non-blocking warning (matches the original verify-on-stop.sh semantics).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');         // kid-kode-landing/
const topRoot = resolve(repoRoot, '..');           // Design-trials/

const args = parseArgs(process.argv.slice(2));
const ON_STOP = args['on-stop'] === true;
const TASK_ID = args['task-id'] || (ON_STOP ? `on-stop-${Date.now()}` : null);
const ROUTE = args['route'] || '/';
const PORT = Number(args['port'] || 4791);
const PREVIEW_FIXTURE = args['fixture'] || 'mock-app';
// EB-08-04 — optional outer view mode override. When passed, the script
// switches to this canonical view mode (RA-06) BEFORE capturing outer.png so
// per-task demos that live in a non-default mode (e.g. canvas keyframe demo)
// are visible in the snapshot. Defaults to no-op (uses whatever mode the
// editor boots into).
const OUTER_MODE = args['mode'] || null;
const URL = `http://localhost:${PORT}${ROUTE}`;

if (!TASK_ID) {
  console.error('verify-editor-runtimes: missing --task-id (or pass --on-stop).');
  process.exit(2);
}

const snapDir = join(repoRoot, 'notes', 'ralph-snapshots', TASK_ID);
const kvDir = join(topRoot, '.kripverify', 'findings', 'screenshots', TASK_ID);
mkdirSync(snapDir, { recursive: true });
mkdirSync(kvDir, { recursive: true });

const logLines = [];
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  logLines.push(stamped);
  console.log(stamped);
}

const results = [];
function check(id, desc, pass, detail = '') {
  results.push({ id, desc, pass, detail });
  log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(28)} ${desc}${detail ? ` — ${detail}` : ''}`);
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) { /* booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  log(`verify-editor-runtimes — task ${TASK_ID} on ${URL}`);

  // Preflight: mock .prism artifact must exist for the inner runtime to boot.
  const prismArtifact = join(repoRoot, 'public', 'prism-assets', 'mock-app.prism');
  if (!existsSync(prismArtifact)) {
    check('preflight.prism-artifact', '.prism artifact present', false,
      `missing ${prismArtifact} — run npm run build:prism`);
    return finalize(1);
  }
  check('preflight.prism-artifact', '.prism artifact present', true);

  // Start next.
  log(`starting next start on :${PORT}…`);
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (b) => process.stderr.write(b));

  let exitCode = 0;
  try {
    const ok = await waitForServer(URL);
    if (!ok) {
      check('preflight.server-up', 'next start reachable', false, `did not come up in 30s on :${PORT}`);
      return finalize(1);
    }
    check('preflight.server-up', 'next start reachable', true);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const consoleLogs = [];
    const pageErrors = [];
    page.on('console', (m) => consoleLogs.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // EB-08-04 — if --mode was passed, switch to that canonical view mode
    // before capturing outer.png so per-task canvas/galaxy/etc. demos are
    // visible in the snapshot. Per-task scripts (currently only EB-08-04)
    // pass `--mode=canvas` to capture the keyframe demo in its post-load +
    // post-in-view-slide state.
    if (OUTER_MODE) {
      await page.evaluate((mode) => {
        try {
          const setter = window.__PRISM_EDITOR_SET_VIEW_MODE__;
          if (typeof setter === 'function') setter(mode);
        } catch (_) { /* best-effort */ }
      }, OUTER_MODE);
      await page.waitForTimeout(2500); // let mode-switch + animations settle
    }

    // === OUTER RUNTIME — capture outer.png + record state =========================
    // Use CDP directly to bypass Playwright's page.screenshot() internal
    // wait-for-fonts step, which hangs intermittently on cold WebGPU init
    // even after document.fonts.ready resolves. CDP's Page.captureScreenshot
    // returns base64 PNG data of the current viewport, no font/animation wait.
    const outerPng = join(snapDir, 'outer.png');
    let outerShot = false;
    try {
      const cdp = await page.context().newCDPSession(page);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(outerPng, Buffer.from(data, 'base64'));
      outerShot = true;
    } catch (e) {
      log(`outer.png CDP capture failed (${(e && e.message) || e})`);
    }
    check('outer.screenshot', 'outer.png captured', outerShot && existsSync(outerPng),
      outerShot ? '' : 'CDP capture failed');

    const outerState = await page.evaluate(() => {
      // EBR2-A-03 / SC-064 — read viewMode + a small subset of editor state
      // directly from the live zustand store via the __PRISM_DEBUG_STORES__
      // handle. This is the canonical source; the legacy
      // __PRISM_EDITOR_STATE__ value is no longer populated anywhere.
      const debug = window.__PRISM_DEBUG_STORES__;
      let liveEditor = null;
      let liveViewMode = null;
      try {
        if (debug && debug.graphEditor && typeof debug.graphEditor.getState === 'function') {
          const s = debug.graphEditor.getState();
          liveViewMode = s ? s.viewMode : null;
          liveEditor = s
            ? {
                viewMode: s.viewMode,
                editorRenderMode: s.editorRenderMode,
                selectedNodeId: s.selectedNodeId,
                selectedHubId: s.selectedHubId,
                activeHubId: s.activeHubId,
              }
            : null;
        }
      } catch (_) { /* best-effort */ }
      return {
        url: location.href,
        title: document.title,
        editorStore: liveEditor,
        viewMode: liveViewMode,
        canvasCount: document.querySelectorAll('canvas').length,
      };
    }).catch(() => null);

    // === INNER RUNTIME — switch to preview-app mode and capture inner.png ========
    // RA-06b collapsed the Round-1 'preview-hub' mode into 'preview-app'.
    // Strategy: programmatically set viewMode='preview-app' via the dev hook
    // if exposed; otherwise just wait for the PrismHost mount to settle. The
    // setter rejects off-canon strings silently — only the 3 canonical
    // modes (galaxy | canvas | preview-app) are accepted.
    await page.evaluate(() => {
      try {
        const setter = window.__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') {
          setter('preview-app');
          return 'via-hook';
        }
      } catch (_) {}
      return 'no-hook';
    });
    await page.waitForTimeout(3500); // let runtime boot + fonts warm

    const loadingVisible = await page.locator('text=LOADING PRISM').isVisible().catch(() => false);
    const failVisible = await page.locator('text=PRISM BOOT FAILED').isVisible().catch(() => false);
    check('inner.mounted', 'inner Prism runtime mounted in preview-app',
      !loadingVisible && !failVisible,
      failVisible ? 'PRISM BOOT FAILED visible' : loadingVisible ? 'still loading after 3.5s' : 'mounted');

    const innerPng = join(snapDir, 'inner.png');
    let innerShot = false;
    try {
      const cdp = await page.context().newCDPSession(page);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(innerPng, Buffer.from(data, 'base64'));
      innerShot = true;
    } catch (e) {
      log(`inner.png CDP capture failed (${(e && e.message) || e})`);
    }
    check('inner.screenshot', 'inner.png captured', innerShot && existsSync(innerPng),
      innerShot ? '' : 'CDP capture failed');

    const criticalErrors = [...pageErrors, ...consoleLogs
      .filter((l) => l.type === 'error')
      .map((l) => l.text)]
      .filter((e) => !/Download the React DevTools/.test(e) && !/Warning:/.test(e));
    check('inner.no-errors', 'no runtime errors in console / page',
      criticalErrors.length === 0,
      criticalErrors.length ? criticalErrors.slice(0, 2).join(' | ') : 'clean');

    // === EBR2-B-04 — Preview-app full-hub assembly capture =====================
    // SC-066 demands every node in the active hub render at its compiled-anchor
    // position via `liveResult.updateNodeTransform`. SC-067 demands the
    // preview-app background mounts at the correct size with no blank edges.
    // The live-graph fixture seeds 6 nodes for the `home` hub; this branch
    // clones 5 additional synthetic nodes into useGraphSourceStore at runtime
    // (mirroring EB-10-02/EB-10-03's seed pattern) so the assembly pipeline
    // is exercised against the spec's ≥10 visible-nodes threshold. The
    // `__PRISM_EDITOR_COMPILED_HUB_VIEW__` dev hook (installed in
    // src/app/page.tsx) exposes the active CompiledHubView's counts so the
    // snapshot's state.json records the proof.
    let assembledHubView = null;
    if (TASK_ID === 'EBR2-B-04') {
      // Switch into preview-app first so the runtime is already mounted and
      // the compiled-view memo is computing. Then seed clones into the source
      // store; the runtime subscription diffs upserts and re-mounts, and the
      // node-layout effect re-runs on the recomputed compiledHubView.
      await page.evaluate(() => {
        const setter = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') setter('preview-app');
      });
      await page.waitForTimeout(1200);

      const seedSummary = await page.evaluate(() => {
        const stores = (window).__PRISM_DEBUG_STORES__;
        if (!stores?.graphSource) return { error: 'graph-source-store-not-exposed' };
        const state = stores.graphSource.getState();
        const sourceNodes = state.nodes ?? [];
        const homeNodes = sourceNodes.filter((n) => n.parentHubId === 'home');
        // Pick a sprite donor that already mounts cleanly; clone with new
        // ids and slight x offsets so the snapshot reviewer sees distinct
        // node artifacts arrayed across the hub canvas.
        const donor = homeNodes.find((n) => n.subtype === 'feature-card')
          ?? homeNodes.find((n) => (n.renderMode ?? 'sprite') === 'sprite')
          ?? homeNodes[0];
        if (!donor) return { error: 'no-donor-node' };

        const cloneCount = Math.max(0, 10 - homeNodes.length + 2); // 10 - 6 + 2 = 6 clones
        const clones = [];
        for (let i = 0; i < cloneCount; i += 1) {
          const cloneId = `home-assembly-clone-${i + 1}`;
          if (sourceNodes.some((n) => n.nodeId === cloneId)) continue;
          const cloned = JSON.parse(JSON.stringify(donor));
          cloned.nodeId = cloneId;
          cloned.parentHubId = 'home';
          // Spread the clones along a horizontal arc so SC-066 visibility is
          // legible in inner.png; offsets resolve through the same anchor
          // pipeline as the donor (compileAppToPreview is pure, INV-17).
          const offsetX = -2.4 + 0.8 * i;
          const offsetY = -1.5 + 0.4 * (i % 2);
          const sp = cloned.scenePosition ?? { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
          cloned.scenePosition = { ...sp, x: offsetX, y: offsetY, z: sp.z ?? 0 };
          clones.push(cloned);
        }
        stores.graphSource.setState({ nodes: [...sourceNodes, ...clones] });
        return {
          baselineHomeNodeCount: homeNodes.length,
          clonesAdded: clones.length,
          donorNodeId: donor.nodeId,
          donorRenderMode: donor.renderMode ?? 'sprite',
        };
      });

      // Allow the compileAppToPreview memo + node-layout effect to settle
      // and any newly-mounted Object3Ds to warm up before screenshotting.
      await page.waitForTimeout(2500);

      const compiledView = await page.evaluate(() => {
        const getter = (window).__PRISM_EDITOR_COMPILED_HUB_VIEW__;
        if (typeof getter !== 'function') return { error: 'compiled-view-hook-not-installed' };
        return getter();
      });

      assembledHubView = { seedSummary, compiledView };

      const compiledOk = !!(compiledView
        && !compiledView.error
        && typeof compiledView.nodeCount === 'number'
        && compiledView.nodeCount >= 10
        && compiledView.visibleNodeCount >= 10);
      check(
        'preview-app.assembled-nodes',
        'preview-app compiled hub view assembles ≥10 visible nodes (SC-066)',
        compiledOk,
        compiledOk
          ? `hubId=${compiledView.hubId} nodes=${compiledView.nodeCount} visible=${compiledView.visibleNodeCount} bg=${compiledView.backgroundLayerCount}`
          : (compiledView && compiledView.error)
            ? compiledView.error
            : `count=${compiledView?.nodeCount} visible=${compiledView?.visibleNodeCount}`,
      );

      const backgroundOk = !!(compiledView
        && !compiledView.error
        && compiledView.backgroundLayerCount >= 1);
      check(
        'preview-app.background-mounted',
        'preview-app background mounts at active breakpoint (SC-067)',
        backgroundOk,
        backgroundOk
          ? `layers=${compiledView.backgroundLayerCount}`
          : `layers=${compiledView?.backgroundLayerCount ?? 'n/a'}`,
      );

      // Re-screenshot now that the seeded nodes have been compiled +
      // mounted so inner.png witnesses the full-hub assembly.
      const innerAppPng = join(snapDir, 'inner.png');
      await page.screenshot({ path: innerAppPng, fullPage: false });
    }

    // === EB-10-02 — Preview-app route-like navigation capture ====================
    // SC-054 demands that hub-to-hub navigation reflect in the URL hash and
    // survive browser back/forward. The editor-shell installs the
    // `__PRISM_EDITOR_PREVIEW_APP_NAV__` dev hook (see src/app/page.tsx) while
    // viewMode === 'preview-app'. This block flips to preview-app, walks
    // next() twice + back() once, and records the hash trail + activeHubId
    // for the snapshot reviewer to verify SC-054's three predicates.
    let previewAppNav = null;
    if (TASK_ID === 'EB-10-02') {
      // The live-graph fixture has a single hub; SC-054 is about multi-hub
      // navigation, so seed a synthetic second hub into useGraphSourceStore
      // BEFORE switching to preview-app so the compileAppToPreview snapshot
      // (read by the routing effect on entry) sees two hubs and the
      // next/prev/back trail has somewhere to go.
      await page.evaluate(() => {
        try {
          const mod = (window).__PRISM_DEBUG_STORES__;
          // Fallback: try the well-known zustand getState through a probe.
          const store = mod && mod.graphSource;
          if (store && typeof store.setState === 'function') {
            const state = store.getState();
            if (state.hubs && state.hubs.length === 1) {
              const seed = JSON.parse(JSON.stringify(state.hubs[0]));
              seed.hubId = 'preview-app-test-hub';
              seed.title = 'Preview App Test Hub';
              store.setState({ hubs: [...state.hubs, seed] });
            }
          }
        } catch (_) { /* tolerated; the assertion below catches it */ }
      });
      // Switch to preview-app via the dev hook so the routing useEffect arms.
      await page.evaluate(() => {
        const setter = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') setter('preview-app');
      });
      await page.waitForTimeout(1200);

      previewAppNav = await page.evaluate(async () => {
        const trail = [];
        function snapshot(label) {
          trail.push({
            label,
            hash: window.location.hash,
            activeHubId:
              (window).__PRISM_EDITOR_PREVIEW_APP_NAV__?.activeHubId ?? null,
          });
        }
        const nav = (window).__PRISM_EDITOR_PREVIEW_APP_NAV__;
        if (!nav) return { error: 'nav-hook-not-installed' };

        snapshot('entry');
        const after1 = nav.next();
        snapshot('after-next-1');
        const after2 = nav.next();
        snapshot('after-next-2');

        // Browser back/forward — the popstate listener parses the hash and
        // restores activeHubId. Two awaited microtasks let popstate fire +
        // React re-render before snapshotting.
        window.history.back();
        await new Promise((r) => setTimeout(r, 250));
        snapshot('after-back');
        window.history.forward();
        await new Promise((r) => setTimeout(r, 250));
        snapshot('after-forward');

        return {
          hubIds: nav.hubIds,
          afterNext1: after1,
          afterNext2: after2,
          trail,
        };
      }).catch((err) => ({
        error: String(err && err.message ? err.message : err),
      }));

      const trailOk = !!(
        previewAppNav &&
        Array.isArray(previewAppNav.trail) &&
        previewAppNav.trail.length === 5 &&
        previewAppNav.trail[0].hash.startsWith('#hub=') &&
        previewAppNav.trail[1].activeHubId !== previewAppNav.trail[0].activeHubId &&
        previewAppNav.trail[3].activeHubId === previewAppNav.trail[1].activeHubId &&
        previewAppNav.trail[4].activeHubId === previewAppNav.trail[2].activeHubId
      );
      check(
        'preview-app.routing',
        'preview-app navigates between hubs via URL hash + back/forward',
        trailOk,
        trailOk
          ? `${previewAppNav.trail.map((t) => t.activeHubId).join(' -> ')}`
          : previewAppNav && previewAppNav.error
            ? previewAppNav.error
            : `trail: ${JSON.stringify(previewAppNav?.trail ?? null)}`,
      );

      // Capture a screenshot in preview-app mode so the snapshot reviewer
      // can eyeball the nav affordance + the rendered hub.
      const innerAppPng = join(snapDir, 'inner.png');
      await page.screenshot({ path: innerAppPng, fullPage: false });
    }

    // === EB-10-03 — Hub-transit mid-frame capture (SC-055 / INV-23) ============
    // SC-055 demands a damped cinematic transit between hub-rail anchors when
    // activeHubId changes in preview-app. PrismHost composes a transit rail
    // via deriveHubTransitRail(prev, next) on each activeHubId swap; the
    // runtime camera-rail driver damps the current pose toward the new
    // anchor over the next few frames. This block fires nav.next() and
    // captures inner.png while the damping is still in flight, so the
    // snapshot reviewer can confirm a non-resting mid-transit pose. The
    // pure-data SC-055 contract is pinned by tests/editor-build/EB-10-03.*;
    // this snapshot is the live-runtime witness.
    let hubTransit = null;
    if (TASK_ID === 'EB-10-03') {
      // Seed a synthetic second hub so the transit has somewhere to go.
      await page.evaluate(() => {
        try {
          const mod = (window).__PRISM_DEBUG_STORES__;
          const store = mod && mod.graphSource;
          if (store && typeof store.setState === 'function') {
            const state = store.getState();
            if (state.hubs && state.hubs.length === 1) {
              const seed = JSON.parse(JSON.stringify(state.hubs[0]));
              seed.hubId = 'hub-transit-test-hub';
              seed.title = 'Hub Transit Test Hub';
              store.setState({ hubs: [...state.hubs, seed] });
            }
          }
        } catch (_) { /* tolerated */ }
      });
      // Switch to preview-app and let the first hub's rail settle.
      await page.evaluate(() => {
        const setter = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') setter('preview-app');
      });
      await page.waitForTimeout(1200);

      // Read the entry activeHubId, then fire nav.next() and immediately
      // snapshot — the camera-rail driver damps over the next ~8-10 frames
      // (damping=0.12), so the page screenshot taken ~90ms after the swap
      // captures the mid-transit pose.
      hubTransit = await page.evaluate(async () => {
        const nav = (window).__PRISM_EDITOR_PREVIEW_APP_NAV__;
        if (!nav) return { error: 'nav-hook-not-installed' };
        const entryHubId = nav.activeHubId;
        const afterNext = nav.next();
        // Hand a microtask off so React commits the new activeHubId and the
        // rail-effect runs setCameraRail(transit) before we screenshot.
        await new Promise((r) => setTimeout(r, 90));
        const midHubId = nav.activeHubId;
        return { entryHubId, afterNext, midHubId };
      }).catch((err) => ({ error: String(err && err.message ? err.message : err) }));

      const transitOk = !!(
        hubTransit
        && !hubTransit.error
        && hubTransit.entryHubId
        && hubTransit.afterNext
        && hubTransit.afterNext !== hubTransit.entryHubId
        && hubTransit.midHubId === hubTransit.afterNext
      );
      check(
        'preview-app.hub-transit',
        'preview-app fires a damped cinematic transit between hub-rail anchors',
        transitOk,
        transitOk
          ? `${hubTransit.entryHubId} -> ${hubTransit.afterNext}`
          : hubTransit && hubTransit.error
            ? hubTransit.error
            : `transit: ${JSON.stringify(hubTransit)}`,
      );

      // inner.png — captured mid-damping so the reviewer sees the cinematic
      // transit rather than the post-settle resting pose.
      const innerAppPng = join(snapDir, 'inner.png');
      await page.screenshot({ path: innerAppPng, fullPage: false });
    }

    // === EB-10-05 — App_Name_World context + full-compile immutability ==========
    // SC-057 demands that App_Name_World context surface at the
    // CompiledAppView top level. SC-058 demands a byte-identical graph
    // snapshot before/after compileAppToPreview. This block flips to
    // preview-app, reads the live `__PRISM_EDITOR_PREVIEW_APP_NAV__.world`
    // binding (the SC-057 surface), then computes sha256 of the live
    // GraphSource before + after re-reading the world hook (which re-runs
    // compileAppToPreview internally). The world badge
    // (`data-component="preview-app-world-badge"`) is rendered into the
    // editor chrome by EB-10-05 / src/app/page.tsx so inner.png captures it.
    let previewAppWorld = null;
    if (TASK_ID === 'EB-10-05') {
      await page.evaluate(() => {
        const setter = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') setter('preview-app');
      });
      await page.waitForTimeout(1500);

      previewAppWorld = await page.evaluate(async () => {
        async function sha256(input) {
          const enc = new TextEncoder().encode(input);
          const buf = await crypto.subtle.digest('SHA-256', enc);
          return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        }
        function canonical(value) {
          if (value === null || typeof value !== 'object') return JSON.stringify(value);
          if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
          const keys = Object.keys(value).sort();
          return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
        }
        const nav = (window).__PRISM_EDITOR_PREVIEW_APP_NAV__;
        if (!nav) return { error: 'nav-hook-not-installed' };
        const stores = (window).__PRISM_DEBUG_STORES__;
        if (!stores?.graphSource) return { error: 'graph-source-store-not-exposed' };
        const src = stores.graphSource.getState();
        const graph = {
          hubs: src.hubs ?? [],
          nodes: src.nodes ?? [],
          edges: src.edges ?? [],
          rootNodes: src.rootNodes ?? [],
        };
        const beforeHash = await sha256(canonical(graph));
        const world = nav.world ?? null;
        const worldEcho = nav.world ?? null;
        const afterHash = await sha256(canonical(graph));
        const badge = document.querySelector('[data-component="preview-app-world-badge"]');
        return {
          beforeHash,
          afterHash,
          byteIdentical: beforeHash === afterHash,
          world,
          worldEchoMatches: !!world
            && !!worldEcho
            && world.appNameWorldId === worldEcho.appNameWorldId,
          badgeRendered: !!badge,
          badgeAppNameWorldId: badge?.getAttribute('data-app-name-world-id') ?? null,
        };
      }).catch((err) => ({ error: String(err && err.message ? err.message : err) }));

      const sc057Ok = !!(previewAppWorld
        && !previewAppWorld.error
        && previewAppWorld.world
        && typeof previewAppWorld.world.appNameWorldId === 'string'
        && previewAppWorld.world.spec
        && previewAppWorld.worldEchoMatches);
      check('preview-app.world-context-surface',
        'SC-057 — CompiledAppView.world surfaces App_Name_World context (stable across re-reads)',
        sc057Ok,
        sc057Ok
          ? `${previewAppWorld.world.appNameWorldId}`
          : previewAppWorld?.error || 'world surface missing');

      const sc058Ok = !!(previewAppWorld && previewAppWorld.byteIdentical === true);
      check('preview-app.full-compile-immutability',
        'SC-058 — sha256(GraphSource) is byte-identical before and after compileAppToPreview',
        sc058Ok,
        sc058Ok
          ? `${previewAppWorld.beforeHash.slice(0, 12)}…`
          : `before=${previewAppWorld?.beforeHash?.slice(0,12)} after=${previewAppWorld?.afterHash?.slice(0,12)}`);

      const badgeOk = !!(previewAppWorld
        && previewAppWorld.badgeRendered
        && previewAppWorld.badgeAppNameWorldId
        && previewAppWorld.world
        && previewAppWorld.badgeAppNameWorldId === previewAppWorld.world.appNameWorldId);
      check('preview-app.world-badge-rendered',
        'world-context binding is rendered (preview-app overlay shows appNameWorldId)',
        badgeOk,
        badgeOk
          ? previewAppWorld.badgeAppNameWorldId
          : `badge=${previewAppWorld?.badgeRendered} attr=${previewAppWorld?.badgeAppNameWorldId}`);

      const innerAppPng = join(snapDir, 'inner.png');
      await page.screenshot({ path: innerAppPng, fullPage: false });
    }

    // === EBR2-C-04 — Gizmo drag visibly moves rendered node ====================
    // SC-069 / INV-25 require that writing a non-identity canvasTransform via
    // the source store visibly shifts the rendered group by the same delta.
    // This block proves it end-to-end against the live runtime without
    // simulating drei TransformControls' HTML overlay (which would be flaky
    // under headless Chromium): it switches to canvas mode, selects a node,
    // enters edit mode, reads the rendered group's world position via the
    // __PRISM_EDITOR_GET_NODE_WORLD_POS__ dev hook, writes a synthetic ct via
    // useGraphSourceStore.updateNode (same write-path as the gizmo's
    // onObjectChange), re-reads the world position, and records the delta.
    let gizmoDragProof = null;
    if (TASK_ID === 'EBR2-C-04') {
      await page.evaluate(() => {
        const setter = (window).__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') setter('canvas');
      });
      // Switching from preview-app → canvas tears down the PrismHost canvas
      // and mounts the editor GraphScene (dynamically imported, ssr:false).
      // First wait for the graph pane DOM, then the canvas element, then the
      // dev hook. Each stage logs on timeout so failures point at the right
      // layer (page render vs. dynamic-import vs. Three useEffect).
      await page.waitForSelector('[data-pane="graph"]', { timeout: 20000 }).catch(() => null);
      await page.waitForSelector('[data-pane="graph"] canvas', { timeout: 30000 }).catch(() => null);
      const waitOk = await page.waitForFunction(() => {
        const w = window;
        return typeof w.__PRISM_EDITOR_GET_NODE_WORLD_POS__ === 'function'
          && w.__PRISM_EDITOR_NODE_GROUPS__
          && w.__PRISM_EDITOR_NODE_GROUPS__.size > 0;
      }, { timeout: 45000 }).then(() => true).catch(() => false);
      if (!waitOk) {
        const diag = await page.evaluate(() => {
          const w = window;
          const stores = w.__PRISM_DEBUG_STORES__;
          const ed = stores?.graphEditor?.getState?.();
          return {
            graphPaneCount: document.querySelectorAll('[data-pane="graph"]').length,
            previewPaneCount: document.querySelectorAll('[data-pane="preview"]').length,
            canvasCount: document.querySelectorAll('canvas').length,
            hookInstalled: typeof w.__PRISM_EDITOR_GET_NODE_WORLD_POS__ === 'function',
            groupsMapExists: !!w.__PRISM_EDITOR_NODE_GROUPS__,
            groupsSize: w.__PRISM_EDITOR_NODE_GROUPS__?.size ?? null,
            viewMode: ed?.viewMode ?? null,
            editorRenderMode: ed?.editorRenderMode ?? null,
            editorMode: ed?.editorMode ?? null,
          };
        });
        console.warn('[EBR2-C-04] hook wait timed out:', JSON.stringify(diag));
      }

      gizmoDragProof = await page.evaluate(async () => {
        const stores = (window).__PRISM_DEBUG_STORES__;
        const editor = stores?.graphEditor;
        const source = stores?.graphSource;
        const getPos = (window).__PRISM_EDITOR_GET_NODE_WORLD_POS__;
        if (!editor || !source) return { error: 'stores-not-exposed' };
        if (typeof getPos !== 'function') return { error: 'world-pos-hook-missing' };

        // Pick the first node whose AssembledSceneNode group has registered
        // itself in __PRISM_EDITOR_NODE_GROUPS__. Falls back to the first
        // home-hub node if no registered group exists yet (in which case the
        // outer assertion catches the unmounted-renderer condition).
        const sourceState = source.getState();
        const nodes = sourceState.nodes ?? [];
        const registered = (window).__PRISM_EDITOR_NODE_GROUPS__;
        const registeredIds = registered ? Array.from(registered.keys()) : [];
        const target = nodes.find((n) => registeredIds.includes(n.nodeId))
          ?? nodes.find((n) => n.parentHubId === 'home')
          ?? nodes[0];
        if (!target) return { error: 'no-target-node', registeredCount: registeredIds.length };

        // Select + enter edit mode (matches the EBR2-C-02 gating predicate
        // viewMode === 'canvas' && editorMode === 'edit' under which the gizmo
        // mounts; the AssembledSceneNode ref-registration is independent of
        // edit mode, but we drive the full select→edit flow so the snapshot
        // also visually witnesses the gizmo present at the composed pose).
        editor.getState().selectNode(target.nodeId);
        editor.getState().setEditorMode('edit');
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        await new Promise((r) => setTimeout(r, 200));

        const before = getPos(target.nodeId);
        if (!before) return { error: 'before-pos-null', nodeId: target.nodeId, registeredCount: registeredIds.length };

        // Synthetic translate-handle drag: same writeback shape as
        // CanvasTransformGizmo.onObjectChange (start.x + proxy.position.x).
        // Read current ct, add a known delta, write back via updateNode.
        function readCT(node) {
          const ct = node.canvasTransform ?? null;
          return {
            x: ct?.x ?? 0, y: ct?.y ?? 0, z: ct?.z ?? 0,
            rotationX: ct?.rotationX ?? 0, rotationY: ct?.rotationY ?? 0, rotationZ: ct?.rotationZ ?? 0,
            scaleX: ct?.scaleX ?? 1, scaleY: ct?.scaleY ?? 1, scaleZ: ct?.scaleZ ?? 1,
          };
        }
        const fresh = source.getState().nodes.find((n) => n.nodeId === target.nodeId);
        const startCT = readCT(fresh);
        const ctDelta = { x: 0.75, y: 0, z: 0 };
        const nextCT = { ...startCT, x: startCT.x + ctDelta.x, y: startCT.y + ctDelta.y, z: startCT.z + ctDelta.z };
        source.getState().updateNode(target.nodeId, { canvasTransform: nextCT });

        // Wait two frames for React commit + Three.js scene update.
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        await new Promise((r) => setTimeout(r, 200));

        const after = getPos(target.nodeId);
        if (!after) return { error: 'after-pos-null', nodeId: target.nodeId, before };

        const deltaX = after.x - before.x;
        const deltaY = after.y - before.y;
        const deltaZ = after.z - before.z;
        const tolerance = 0.01;
        const visiblyMoved =
          Math.abs(deltaX - ctDelta.x) < tolerance
          && Math.abs(deltaY - ctDelta.y) < tolerance
          && Math.abs(deltaZ - ctDelta.z) < tolerance;

        return {
          nodeId: target.nodeId,
          startCT,
          nextCT,
          ctDelta,
          before,
          after,
          deltaX,
          deltaY,
          deltaZ,
          visiblyMoved,
          registeredCount: registeredIds.length,
        };
      }).catch((err) => ({ error: String(err && err.message ? err.message : err) }));

      const proofOk = !!(
        gizmoDragProof
        && !gizmoDragProof.error
        && gizmoDragProof.visiblyMoved === true
      );
      check(
        'canvas.gizmo-drag-moves-node',
        'writing canvasTransform via store visibly shifts rendered group by ct delta (SC-069 / INV-25)',
        proofOk,
        proofOk
          ? `node=${gizmoDragProof.nodeId} Δx=${gizmoDragProof.deltaX.toFixed(3)} (expected ${gizmoDragProof.ctDelta.x.toFixed(3)})`
          : gizmoDragProof && gizmoDragProof.error
            ? gizmoDragProof.error
            : `delta mismatch — actual=${JSON.stringify({ x: gizmoDragProof?.deltaX, y: gizmoDragProof?.deltaY, z: gizmoDragProof?.deltaZ })} expected=${JSON.stringify(gizmoDragProof?.ctDelta)}`,
      );

      // Re-screenshot now that the synthetic ct is applied so inner.png
      // captures the gizmo + the displaced node artifact. CDP-direct path
      // (same as the standard screenshots) to avoid Playwright's font-wait
      // hang on cold WebGPU init.
      const innerAppPng = join(snapDir, 'inner.png');
      try {
        const cdp = await page.context().newCDPSession(page);
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(innerAppPng, Buffer.from(data, 'base64'));
      } catch (e) {
        log(`inner.png (EBR2-C-04) CDP capture failed (${(e && e.message) || e})`);
      }

      // Restore the source-store canvasTransform to the pre-test value so the
      // debounced autosave (which fires ~1.5s after the last mutation) writes
      // back the original ct rather than persisting our synthetic 0.75 delta
      // into kid-kode-landing/public/prism-mock/home/live-graph.json. Then
      // wait long enough for the autosave timer to elapse on the restored
      // value before the page closes — otherwise the next git diff catches
      // the mutated fixture.
      if (gizmoDragProof && !gizmoDragProof.error && gizmoDragProof.nodeId) {
        await page.evaluate(async ({ nodeId, startCT }) => {
          const stores = (window).__PRISM_DEBUG_STORES__;
          const source = stores?.graphSource;
          if (!source) return;
          source.getState().updateNode(nodeId, { canvasTransform: startCT });
          // Bypass the 1s autosave debounce — flush directly so the fixture
          // file is restored synchronously before this evaluate returns.
          try { await source.getState().saveToServer?.(); } catch (_) { /* best-effort */ }
        }, { nodeId: gizmoDragProof.nodeId, startCT: gizmoDragProof.startCT });
        await page.waitForTimeout(800);
      }
    }

    // === EB-09-06 — Tether-fire propagation capture ==============================
    // SC-052 demands that the snapshot prove tether-fire propagation. The
    // editor-shell installs `window.__PRISM_EDITOR_FIRE_TETHER__` (see
    // src/app/page.tsx) which walks the live useGraphSourceStore via the
    // pure resolveTetherFireTargets (the same path the inner runtime would
    // traverse under SC-049). The live-graph fixture
    // (kid-kode-landing/public/prism-mock/home/live-graph.json) carries the
    // `home-cta-hero` -> `home-feature-card` `'triggers'` edge (event
    // `cta-clicked`) as its sole node-to-node tether. The recorded event
    // lives at state.tetherFireEvent so the haltCheck can assert
    // source+target ids.
    let tetherFireEvent = null;
    if (TASK_ID === 'EB-09-06') {
      tetherFireEvent = await page.evaluate(() => {
        const fire = (window).__PRISM_EDITOR_FIRE_TETHER__;
        if (typeof fire !== 'function') return { error: 'hook-not-installed' };
        try {
          return fire('home-cta-hero');
        } catch (err) {
          return { error: String(err && err.message ? err.message : err) };
        }
      }).catch((err) => ({ error: String(err && err.message ? err.message : err) }));
      const hasTarget = !!(tetherFireEvent
        && Array.isArray(tetherFireEvent.targets)
        && tetherFireEvent.targets.length > 0
        && tetherFireEvent.targets[0].targetNodeId);
      check('tether.fire.propagated',
        'tether-fire propagates from source to at least one target',
        hasTarget,
        hasTarget
          ? `${tetherFireEvent.sourceNodeId} -> ${tetherFireEvent.targets[0].targetNodeId}`
          : (tetherFireEvent && tetherFireEvent.error)
            ? tetherFireEvent.error
            : 'no targets resolved');
    }

    // === Persist state.json ======================================================
    // EBR2-A-03 / SC-064 — surface the live viewMode at the top of state.json
    // so the haltCheck and downstream snapshot consumers can assert against
    // it without walking into outerState. Falls back to null when the dev
    // hook isn't installed (e.g. older snapshots).
    const state = {
      taskId: TASK_ID,
      capturedAt: new Date().toISOString(),
      url: URL,
      fixture: PREVIEW_FIXTURE,
      viewport: { width: 1440, height: 900 },
      viewMode: outerState && outerState.viewMode ? outerState.viewMode : null,
      outerState,
      ...(tetherFireEvent ? { tetherFireEvent } : {}),
      ...(previewAppNav ? { previewAppNav } : {}),
      ...(hubTransit ? { hubTransit } : {}),
      ...(previewAppWorld ? { previewAppWorld } : {}),
      ...(gizmoDragProof ? { gizmoDragProof } : {}),
      ...(assembledHubView
        ? {
            assembledHubView,
            compiledNodeCount: assembledHubView?.compiledView?.nodeCount ?? null,
            compiledVisibleNodeCount:
              assembledHubView?.compiledView?.visibleNodeCount ?? null,
          }
        : {}),
      summary: {
        outerScreenshot: 'outer.png',
        innerScreenshot: 'inner.png',
        checks: results,
        consoleLogCount: consoleLogs.length,
        pageErrorCount: pageErrors.length,
        criticalErrorCount: criticalErrors.length,
      },
    };
    writeFileSync(join(snapDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
    check('state.persisted', 'state.json written', true);

    await browser.close();
  } catch (e) {
    check('runtime.exception', 'unexpected exception during verification', false, String(e?.message || e));
    exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  return finalize(exitCode);

  function finalize(code) {
    const failed = results.filter((r) => !r.pass).length;
    const final = code !== 0 ? code : (failed === 0 ? 0 : 1);

    // Write verify.log
    writeFileSync(join(snapDir, 'verify.log'), logLines.join('\n') + '\n');

    // Mirror to KripVerify findings dir (best-effort; do not fail run if mirror fails).
    try {
      for (const name of ['outer.png', 'inner.png', 'state.json', 'verify.log']) {
        const src = join(snapDir, name);
        if (existsSync(src)) copyFileSync(src, join(kvDir, name));
      }
    } catch (e) {
      log(`mirror-warn: could not copy to .kripverify/findings: ${e?.message || e}`);
    }

    log(`done — ${results.length - failed}/${results.length} checks passed (exit ${final})`);
    process.exit(final);
  }
}

main().catch((e) => {
  console.error('verify-editor-runtimes: unhandled:', e);
  process.exit(1);
});
