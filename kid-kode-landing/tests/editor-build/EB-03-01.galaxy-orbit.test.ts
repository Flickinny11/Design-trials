// EB-03-01 — Galaxy mode: deterministic hub orbit around App_Name_World.
//
// Spec refs:
//   §6 SC-012 — In viewMode === 'galaxy', hubs render in orbit around the
//               App_Name_World node at deterministic positions (fn of hubId
//               hash + ring index).
//   §4         — `universe` coordinate space; hubs orbit App_Name_World here.
//   §8 INV-18  — additive schema growth only (no rename/delete; no new
//               required fields).
//   §8 INV-20  — selection state survives every transition through any subset
//               of the five canonical view modes.
//   §9 RA-07   — App_Name_World as PrismRootNode (option B). The sun lives at
//               universe origin (GraphScene's WorldSun at position=[0,0,0],
//               shipped by EB-02-03), so the hub orbit's center IS the origin.
//
// haltCheck (from ralph-state.json):
//   "In viewMode='galaxy', hubs render in deterministic orbital positions (fn
//    of hubId hash + ring index); two consecutive renders produce identical
//    positions; snapshot outer.png shows ringed layout."
//
// Determinism contract (SC-012 verbatim "fn of hubId hash + ring index"):
//   - Same `hubId` MUST map to the same (x,y,z) every time, regardless of the
//     hub's position in the input `hubs[]` array. The legacy
//     `computeHubCenters` is index-based (`i / hubs.length`) and so violates
//     this contract — that's why galaxy mode needs its own layout fn.
//   - No `Math.random()`, no `Date.now()`, no clock or RNG inside the layout
//     fn. The test below asserts this by re-ordering the input and by
//     comparing two independent call results.
//
// Source-shape strategy: the orbit positions are computed by a pure function
// `computeGalaxyHubCenters` exported from `src/lib/useForceGraph.ts`. We can
// exercise that function directly under vitest's node env without standing up
// the R3F Canvas. The renderer-side wiring (galaxy-mode → orbit layout) is
// verified by source-shape assertions against `useForceGraph.ts`. The runtime
// outer.png is captured by `scripts/verify-editor-runtimes.mjs` and lives
// under `notes/ralph-snapshots/EB-03-01/` (post-implementation gate below).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeGalaxyHubCenters,
  computeHubCenters,
} from '../../src/lib/useForceGraph';

const repoRoot = join(__dirname, '..', '..');
const useForceGraphSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'useForceGraph.ts'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

// Minimal EditorHubView-compatible test fixture. We only need the fields
// `computeGalaxyHubCenters` actually reads — `id` (the hash input). The cast
// satisfies the function signature; downstream visual fields are irrelevant
// to the orbit-layout contract.
function mkHub(id: string) {
  return {
    id,
    name: id,
    route: `/${id}`,
    glyph: '*',
    color: '#fff',
    accentColor: '#fff',
    mockupUrl: null,
  };
}

describe('EB-03-01 — galaxy-mode deterministic hub orbit (SC-012)', () => {
  it('exports computeGalaxyHubCenters as a pure function', () => {
    expect(typeof computeGalaxyHubCenters).toBe('function');
  });

  it('produces identical positions on two consecutive calls (determinism)', () => {
    const hubs = ['home', 'auth', 'profile', 'settings', 'inbox'].map(mkHub);
    const a = computeGalaxyHubCenters(hubs);
    const b = computeGalaxyHubCenters(hubs);
    for (const h of hubs) {
      expect(a[h.id]).toEqual(b[h.id]);
    }
  });

  it('is a function of hubId hash (not array position) — reordering preserves per-hub position', () => {
    // The legacy computeHubCenters fails this exact test because its layout
    // is `i / hubs.length` — reorder swaps angles. The galaxy layout must
    // keep each hub anchored to a position derived only from its `id`.
    const order1 = ['home', 'auth', 'profile', 'settings', 'inbox'].map(mkHub);
    const order2 = ['settings', 'home', 'inbox', 'auth', 'profile'].map(mkHub);
    const a = computeGalaxyHubCenters(order1);
    const b = computeGalaxyHubCenters(order2);
    for (const id of ['home', 'auth', 'profile', 'settings', 'inbox']) {
      expect(a[id]).toEqual(b[id]);
    }
  });

  it('uses no RNG and no clock inside the layout function (no Math.random/Date.now in source)', () => {
    // Static guard against the most common "deterministic, but really not"
    // mistakes. We scope to the function body so unrelated module-level
    // utilities can't trip the check.
    const fnMatch = useForceGraphSrc.match(
      /export function computeGalaxyHubCenters[\s\S]*?\n\}\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0];
    expect(body).not.toMatch(/Math\.random\s*\(/);
    expect(body).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(body).not.toMatch(/performance\.now\s*\(/);
  });

  it('different hubIds yield different positions (so single-ring fallbacks that collapse hubs are detectable)', () => {
    const hubs = ['home', 'auth', 'profile', 'settings', 'inbox', 'admin'].map(mkHub);
    const out = computeGalaxyHubCenters(hubs);
    const keys = Object.keys(out);
    const seen = new Set<string>();
    for (const k of keys) {
      const p = out[k];
      const tag = `${p.x.toFixed(4)}|${p.y.toFixed(4)}|${p.z.toFixed(4)}`;
      expect(seen.has(tag)).toBe(false);
      seen.add(tag);
    }
  });

  it('hubs orbit App_Name_World (origin) — every hub sits at non-trivial distance from [0,0,0]', () => {
    // WorldSun is mounted at position=[0,0,0] in GraphScene (EB-02-03). Hubs
    // orbit around it; "near-origin" hubs would visually collide with the sun.
    const hubs = ['home', 'auth', 'profile', 'settings', 'inbox'].map(mkHub);
    const out = computeGalaxyHubCenters(hubs);
    for (const id of Object.keys(out)) {
      const { x, y, z } = out[id];
      const r = Math.sqrt(x * x + y * y + z * z);
      // Sun core radius in WorldSun is 14; orbit radius must clear it with
      // visible breathing room. 30+ universe units is comfortable.
      expect(r).toBeGreaterThan(30);
    }
  });

  it('single-hub graph still orbits in galaxy mode (does NOT collapse to origin)', () => {
    // computeHubCenters has a single-hub fast path that returns {x:0,y:0,z:0}
    // so the default camera frames the lone hub. In galaxy mode, the sun
    // owns the origin, so the single hub must orbit instead of collapsing
    // onto the sun.
    const hubs = [mkHub('only-hub')];
    const out = computeGalaxyHubCenters(hubs);
    expect(out['only-hub']).toBeDefined();
    const { x, y, z } = out['only-hub'];
    const r = Math.sqrt(x * x + y * y + z * z);
    expect(r).toBeGreaterThan(30);
  });

  it('exposes a ring index for each hub (fn of hubId hash + ring index — SC-012 verbatim)', () => {
    // SC-012's contract decomposes the position into (hash-derived angle) ×
    // (ring radius). Multi-ring layouts only matter once there are enough
    // hubs to fill ≥2 rings; we sample a representative set and require that
    // at least two distinct orbit radii appear so the "ring index" half of
    // the contract is observable. (A single-ring degenerate layout would
    // technically be deterministic, but it would lose the "ring index" half.)
    const hubs = [
      'home', 'auth', 'profile', 'settings', 'inbox',
      'admin', 'dashboard', 'reports', 'billing', 'team',
    ].map(mkHub);
    const out = computeGalaxyHubCenters(hubs);
    const radii = new Set<string>();
    for (const id of Object.keys(out)) {
      const { x, y, z } = out[id];
      // Round to the nearest universe unit so floating-point variance within
      // a single ring doesn't inflate the set.
      const r = Math.round(Math.sqrt(x * x + y * y + z * z));
      radii.add(String(r));
    }
    expect(radii.size).toBeGreaterThanOrEqual(2);
  });

  it('coexists with computeHubCenters (non-galaxy modes keep their existing layout — INV-18 additive)', () => {
    // computeHubCenters MUST still exist and behave as before — non-galaxy
    // modes (hub-world, canvas, preview-*) rely on its index-based petal
    // layout. EB-03-01 adds a new function, it does NOT rewrite the old one.
    expect(typeof computeHubCenters).toBe('function');
    const hubs = ['a', 'b', 'c'].map(mkHub);
    const out = computeHubCenters(hubs);
    expect(Object.keys(out)).toEqual(['a', 'b', 'c']);
  });

  it('useForceGraph routes through computeGalaxyHubCenters when viewMode === "galaxy"', () => {
    // Source-shape assertion: useForceGraph must read viewMode (either as an
    // argument or via useGraphEditorStore) and select the galaxy layout when
    // it equals "galaxy". The renderer's runtime correctness is captured by
    // the two-runtime snapshot below.
    expect(useForceGraphSrc).toMatch(/computeGalaxyHubCenters/);
    expect(useForceGraphSrc).toMatch(
      /viewMode\s*===\s*['"]galaxy['"][\s\S]{0,200}?computeGalaxyHubCenters/,
    );
  });

  it('GraphScene threads viewMode into useForceGraph so the layout switches per mode', () => {
    // The galaxy switch only matters end-to-end if GraphScene passes
    // viewMode through to useForceGraph. Either as a positional arg or via
    // a named option — we just require the source-shape link.
    expect(graphSceneSrc).toMatch(
      /useForceGraph\([\s\S]{0,500}?viewMode/,
    );
  });

  it('EB-03-01 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-03-01');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
