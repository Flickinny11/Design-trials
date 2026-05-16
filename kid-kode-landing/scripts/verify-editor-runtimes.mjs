#!/usr/bin/env node
// Two-runtime verification for the Prism Editor Build.
// Captures deterministic snapshots of BOTH runtimes per task:
//   1. Outer Next.js editor runtime — captures outer.png + state.json from the editor routes.
//   2. Inner Prism runtime — drives the editor into preview-hub mode against the mock .prism
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
    const outerPng = join(snapDir, 'outer.png');
    await page.screenshot({ path: outerPng, fullPage: false });
    check('outer.screenshot', 'outer.png captured', existsSync(outerPng));

    const outerState = await page.evaluate(() => {
      // Best-effort read of useGraphEditorStore state if exposed; otherwise null.
      const store = window.__PRISM_EDITOR_STATE__ || null;
      return {
        url: location.href,
        title: document.title,
        editorStore: store,
        canvasCount: document.querySelectorAll('canvas').length,
      };
    }).catch(() => null);

    // === INNER RUNTIME — switch to preview-hub mode and capture inner.png ========
    // Strategy: programmatically set viewMode='preview-hub' via the dev hook if exposed;
    // otherwise click the preview-hub toggle in the UI; otherwise just wait for the
    // PrismHost mount to settle.
    await page.evaluate(() => {
      try {
        const setter = window.__PRISM_EDITOR_SET_VIEW_MODE__;
        if (typeof setter === 'function') {
          setter('preview-hub');
          return 'via-hook';
        }
      } catch (_) {}
      return 'no-hook';
    });
    await page.waitForTimeout(3500); // let runtime boot + fonts warm

    const loadingVisible = await page.locator('text=LOADING PRISM').isVisible().catch(() => false);
    const failVisible = await page.locator('text=PRISM BOOT FAILED').isVisible().catch(() => false);
    check('inner.mounted', 'inner Prism runtime mounted in preview-hub',
      !loadingVisible && !failVisible,
      failVisible ? 'PRISM BOOT FAILED visible' : loadingVisible ? 'still loading after 3.5s' : 'mounted');

    const innerPng = join(snapDir, 'inner.png');
    await page.screenshot({ path: innerPng, fullPage: false });
    check('inner.screenshot', 'inner.png captured', existsSync(innerPng));

    const criticalErrors = [...pageErrors, ...consoleLogs
      .filter((l) => l.type === 'error')
      .map((l) => l.text)]
      .filter((e) => !/Download the React DevTools/.test(e) && !/Warning:/.test(e));
    check('inner.no-errors', 'no runtime errors in console / page',
      criticalErrors.length === 0,
      criticalErrors.length ? criticalErrors.slice(0, 2).join(' | ') : 'clean');

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
    const state = {
      taskId: TASK_ID,
      capturedAt: new Date().toISOString(),
      url: URL,
      fixture: PREVIEW_FIXTURE,
      viewport: { width: 1440, height: 900 },
      outerState,
      ...(tetherFireEvent ? { tetherFireEvent } : {}),
      ...(previewAppNav ? { previewAppNav } : {}),
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
