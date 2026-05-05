// T09 — Mock App Reconstruction quality spec.
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §14 L487-L500 (Mock App Reconstruction):
//       1. Five hubs: Landing, Features, Gallery, Pricing, Contact
//       2. >=3 `mesh` nodes (Landing/Features/Contact)
//       3. >=1 `parallax-plane` per hub for the primary hero
//       4. All other nodes as `plane` or `sprite`
//       5. >=1 example of each cinematic primitive across the app
//       6. All text rendered via MSDF
//       7. Inter-hub navigation uses fly-through primitive at least once
//       8. Build time <= 35 seconds
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L531 ("zero PixiJS imports")
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L540 (DoD: mock builds <=35s)
//   - ralph-state.json T09 halt-check ("WebGPU + WebGL2 fallback both work")
//
// The build script `scripts/build-mock-app.mjs` runs T05's assembleBundle()
// over the renderer-era mock graph and emits the file map plus a
// `build-manifest.json` with timing under `public/prism-mock-app-renderer/`.
// These tests read the emitted artifacts and assert §14 + halt-check.

import { expect, test } from 'playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright runs specs as CJS by default (no `"type": "module"` in
// package.json). `process.cwd()` is the kid-kode-landing dir per the T09
// verificationCommands (`cd kid-kode-landing && npx playwright test ...`).
const REPO_ROOT = process.cwd();
const OUT_DIR = resolve(REPO_ROOT, 'public', 'prism-mock-app-renderer');

interface BuildManifest {
  buildDurationMs: number;
  fileCount: number;
  fileNames: string[];
  hubCount: number;
  nodeCount: number;
  builtAt: string;
}

interface MockGraph {
  version: string;
  hubs: Array<{ hubId: string; title: string }>;
  nodes: Array<{
    nodeId: string;
    parentHubId: string;
    renderMode: string;
    cinematicPrimitives: Array<{ name: string; params: Record<string, unknown>; trigger: string }>;
    intent?: { visualSpec?: { textContent?: Array<{ renderMethod?: string }> } };
  }>;
  edges: Array<{ from: string; to: string; type: string; event?: string; transitionPrimitive?: string }>;
}

function readManifest(): BuildManifest {
  const path = resolve(OUT_DIR, 'build-manifest.json');
  if (!existsSync(path)) throw new Error(`build-manifest.json missing — run scripts/build-mock-app.mjs first (looked at ${path})`);
  return JSON.parse(readFileSync(path, 'utf8')) as BuildManifest;
}

function readGraph(): MockGraph {
  const path = resolve(OUT_DIR, 'graph.json');
  if (!existsSync(path)) throw new Error(`graph.json missing — run scripts/build-mock-app.mjs first (looked at ${path})`);
  return JSON.parse(readFileSync(path, 'utf8')) as MockGraph;
}

test.describe('T09 — Mock App Reconstruction quality', () => {
  test('§14.1 — five hubs (Landing/Features/Gallery/Pricing/Contact)', () => {
    const graph = readGraph();
    expect(graph.hubs).toHaveLength(5);
    const ids = graph.hubs.map((h) => h.hubId).sort();
    expect(ids).toEqual(['contact', 'features', 'gallery', 'landing', 'pricing']);
  });

  test('§14.2 — at least 3 mesh nodes', () => {
    const graph = readGraph();
    const meshNodes = graph.nodes.filter((n) => n.renderMode === 'mesh');
    expect(meshNodes.length).toBeGreaterThanOrEqual(3);
  });

  test('§14.3 — at least one parallax-plane per hub', () => {
    const graph = readGraph();
    for (const hub of graph.hubs) {
      const parallaxInHub = graph.nodes.filter(
        (n) => n.parentHubId === hub.hubId && n.renderMode === 'parallax-plane',
      );
      expect(parallaxInHub.length, `hub ${hub.hubId} parallax-plane count`).toBeGreaterThanOrEqual(1);
    }
  });

  test('§14.4 — all other nodes are plane or sprite', () => {
    const graph = readGraph();
    const allowed = new Set(['sprite', 'plane', 'parallax-plane', 'mesh']);
    for (const n of graph.nodes) {
      expect(allowed.has(n.renderMode), `node ${n.nodeId} renderMode ${n.renderMode}`).toBe(true);
    }
  });

  test('§14.5 — every cinematic primitive (9) is represented', () => {
    const graph = readGraph();
    const expected = [
      'orbit',
      'depth-rotate',
      'dissolve-morph',
      'displacement-transition',
      'parallax-scroll',
      'magnetic-cursor',
      'particle-emerge',
      'fly-through',
      'kinetic-text',
    ];
    const seen = new Set<string>();
    for (const n of graph.nodes) {
      for (const p of n.cinematicPrimitives ?? []) seen.add(p.name);
    }
    // Edges may also carry a fly-through transition; include those too.
    for (const e of graph.edges) {
      if (e.transitionPrimitive) seen.add(e.transitionPrimitive);
    }
    for (const name of expected) {
      expect(seen.has(name), `primitive ${name} not represented`).toBe(true);
    }
  });

  test('§14.6 — all text uses renderMethod=msdf', () => {
    const graph = readGraph();
    let textChecked = 0;
    for (const n of graph.nodes) {
      const tc = n.intent?.visualSpec?.textContent;
      if (!tc) continue;
      for (const t of tc) {
        textChecked += 1;
        expect(t.renderMethod, `node ${n.nodeId} text renderMethod`).toBe('msdf');
      }
    }
    expect(textChecked, 'at least one text content present').toBeGreaterThan(0);
  });

  test('§14.7 — inter-hub navigation uses fly-through at least once', () => {
    const graph = readGraph();
    const hubIds = new Set(graph.hubs.map((h) => h.hubId));
    const interHubFlyThrough = graph.edges.filter(
      (e) =>
        e.transitionPrimitive === 'fly-through' &&
        hubIds.has(e.from) &&
        hubIds.has(e.to) &&
        e.from !== e.to,
    );
    expect(interHubFlyThrough.length).toBeGreaterThanOrEqual(1);
  });

  test('§14.8 / §17 DoD#10 — build duration <= 35 seconds', () => {
    const m = readManifest();
    expect(m.buildDurationMs).toBeLessThanOrEqual(35_000);
  });

  test('halt-check — bundle file map is complete (app.js + graph.json + 6 shared + 9 primitives + 6 shaders + per-node)', () => {
    const m = readManifest();
    expect(m.fileNames).toContain('app.js');
    expect(m.fileNames).toContain('graph.json');
    // 6 shared infra files
    for (const f of ['shared/scene-root.js', 'shared/loaders.js', 'shared/text.js', 'shared/manager.js', 'shared/adapter.js', 'shared/state.js']) {
      expect(m.fileNames, `expected ${f}`).toContain(f);
    }
    // 9 primitives
    for (const p of ['orbit', 'depth-rotate', 'dissolve-morph', 'displacement-transition', 'parallax-scroll', 'magnetic-cursor', 'particle-emerge', 'fly-through', 'kinetic-text']) {
      expect(m.fileNames, `expected primitive ${p}`).toContain(`shared/primitives/${p}.js`);
    }
    // 6 TSL shaders
    for (const s of ['displacement', 'dissolve', 'voronoi-particle', 'twisted-wave', 'radial-blur', 'rgb-shift']) {
      expect(m.fileNames, `expected shader ${s}`).toContain(`shared/shaders/${s}.tsl.js`);
    }
    // per-node stubs (one per node)
    expect(m.fileNames.filter((f) => f.startsWith('nodes/')).length).toBe(m.nodeCount);
  });

  test('§17 DoD#1 — zero PixiJS imports in any emitted bundle file', () => {
    const m = readManifest();
    for (const f of m.fileNames) {
      const path = resolve(OUT_DIR, f);
      if (!existsSync(path)) continue;
      const content = readFileSync(path, 'utf8');
      expect(content, `${f} contains pixi import`).not.toMatch(/from\s+["']pixi(\.js|-filters|\/[\w-]+)?["']/);
      expect(content, `${f} contains @pixi import`).not.toMatch(/from\s+["']@pixi\//);
    }
  });

  test('halt-check — bundle app.js parses in browser (WebGPU + WebGL2 fallback path)', async ({ page }) => {
    // Load the app.js as a module via the harness `/mock-app/` mount. The
    // harness serves `public/prism-mock-app-renderer/` at that prefix. We
    // import only — no boot — to verify the module graph parses without
    // unresolved specifiers and without runtime errors. Actual rendering
    // requires WebGPU init which we cover in the editor Visual tab spec
    // (T07) and the §17 DoD cross-browser spec (T10).
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    await page.goto('/mock-app-load.html');
    await page.waitForFunction(() => (window as unknown as { __mockAppLoaded?: boolean }).__mockAppLoaded === true, null, { timeout: 10_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
