// EB-03-02 — Galaxy mode: hub diameter = f(nodeCount, depth).
//
// Spec refs:
//   §3 SC-013 — Hub diameter scales with content complexity
//               (`f(node count, depth)`); deterministic.
//
// haltCheck (from ralph-state.json):
//   "Hub diameter = f(nodeCount, depth) with documented formula; unit test
//    verifies monotonic growth; snapshot diff against EB-03-01 shows size
//    variation between hubs."
//
// Determinism + monotonicity contract:
//   - `computeGalaxyHubDiameter(nodeCount, depth)` is pure: no RNG, no clock,
//     no external state. Same args → same output every call, across runs.
//   - Monotonic non-decreasing in `nodeCount` (holding depth fixed) and in
//     `depth` (holding nodeCount fixed). The "scales with complexity" half of
//     SC-013 only holds if both inputs are observably reflected in the output.
//   - `computeGalaxyHubDiameters(hubs, nodes, edges)` is the per-hub
//     orchestrator that walks the editor graph (counting nodes per hub and
//     computing depth from `contains` edges within the hub) and returns
//     `Record<hubId, number>` keyed by `hub.id`.
//
// Source-shape strategy (mirrors EB-03-01): exercise the pure formula and
// orchestrator under vitest's node env. Source-shape regex assertions on
// GraphScene.tsx confirm the renderer wires the galaxy diameters into
// HubHulls so galaxy hub size differs from topology mode's `maxDist + 10`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeGalaxyHubDiameter,
  computeGalaxyHubDiameters,
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

// Minimal EditorNode-compatible fixture — only the fields the orchestrator
// actually reads (`id`, `hubIds`).
function mkNode(id: string, hubId: string) {
  return {
    id,
    name: id,
    elementType: 'sprite',
    hubIds: [hubId],
    caption: '',
    status: 'verified' as const,
    verificationScore: 1,
    hasBackend: false,
    hasAnimation: false,
    animationFrames: 0,
    stateCount: 0,
    code: '',
    visualSpec: {
      primaryColor: '#fff',
      secondaryColor: '#fff',
      font: 'Inter',
      radius: 1,
      shadow: 'none' as const,
    },
    textContent: [],
    interactions: [],
  };
}

function mkEdge(id: string, source: string, target: string, type: string) {
  return { id, source, target, type };
}

describe('EB-03-02 — galaxy hub size-by-complexity (SC-013)', () => {
  it('exports computeGalaxyHubDiameter as a pure function', () => {
    expect(typeof computeGalaxyHubDiameter).toBe('function');
  });

  it('produces identical output on two consecutive calls (determinism)', () => {
    expect(computeGalaxyHubDiameter(8, 2)).toBe(computeGalaxyHubDiameter(8, 2));
    expect(computeGalaxyHubDiameter(40, 5)).toBe(computeGalaxyHubDiameter(40, 5));
  });

  it('is monotonic non-decreasing in nodeCount (depth fixed)', () => {
    const depth = 2;
    let prev = -Infinity;
    for (const n of [0, 1, 2, 5, 10, 20, 40, 80, 200]) {
      const d = computeGalaxyHubDiameter(n, depth);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it('is strictly increasing as nodeCount grows by a meaningful amount (depth fixed)', () => {
    // A formula that returns a constant would pass the non-decreasing test
    // above but would not "scale with complexity". Require that the diameter
    // observably grows between a small hub and a large hub.
    const small = computeGalaxyHubDiameter(1, 1);
    const large = computeGalaxyHubDiameter(40, 1);
    expect(large).toBeGreaterThan(small);
  });

  it('is monotonic non-decreasing in depth (nodeCount fixed)', () => {
    const nodeCount = 10;
    let prev = -Infinity;
    for (const d of [1, 2, 3, 5, 8]) {
      const out = computeGalaxyHubDiameter(nodeCount, d);
      expect(out).toBeGreaterThanOrEqual(prev);
      prev = out;
    }
  });

  it('is strictly increasing as depth grows by a meaningful amount (nodeCount fixed)', () => {
    const shallow = computeGalaxyHubDiameter(10, 1);
    const deep = computeGalaxyHubDiameter(10, 6);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('returns a positive finite diameter even for empty hubs (nodeCount=0, depth=0)', () => {
    const d = computeGalaxyHubDiameter(0, 0);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });

  it('uses no RNG and no clock inside the formula (no Math.random/Date.now in source)', () => {
    const fnMatch = useForceGraphSrc.match(
      /export function computeGalaxyHubDiameter[\s\S]*?\n\}\n/,
    );
    expect(fnMatch).not.toBeNull();
    const body = fnMatch![0];
    expect(body).not.toMatch(/Math\.random\s*\(/);
    expect(body).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(body).not.toMatch(/performance\.now\s*\(/);
  });

  it('documents the formula in source (a comment block annotates the SC-013 formula)', () => {
    // The haltCheck requires "documented formula". Require some comment text
    // adjacent to the function that names SC-013 and references both inputs.
    expect(useForceGraphSrc).toMatch(/SC-013/);
    const fnContext = useForceGraphSrc.match(
      /\/\/[^\n]*(nodeCount|node count)[\s\S]{0,400}?export function computeGalaxyHubDiameter/,
    );
    expect(fnContext).not.toBeNull();
  });
});

describe('EB-03-02 — computeGalaxyHubDiameters orchestrator', () => {
  it('returns a diameter for every hub keyed by hub.id', () => {
    const hubs = ['home', 'auth', 'settings'].map(mkHub);
    const nodes = [
      mkNode('n1', 'home'),
      mkNode('n2', 'home'),
      mkNode('n3', 'auth'),
    ];
    const out = computeGalaxyHubDiameters(hubs, nodes, []);
    expect(Object.keys(out).sort()).toEqual(['auth', 'home', 'settings']);
    for (const id of Object.keys(out)) {
      expect(Number.isFinite(out[id])).toBe(true);
      expect(out[id]).toBeGreaterThan(0);
    }
  });

  it('produces different diameters for hubs of different node counts (size variation, haltCheck)', () => {
    const hubs = ['big', 'small'].map(mkHub);
    const nodes = [
      ...Array.from({ length: 20 }, (_, i) => mkNode(`b${i}`, 'big')),
      mkNode('s1', 'small'),
    ];
    const out = computeGalaxyHubDiameters(hubs, nodes, []);
    expect(out['big']).toBeGreaterThan(out['small']);
  });

  it('produces different diameters for hubs of different depths (contains-edge chain)', () => {
    const hubs = ['flat', 'deep'].map(mkHub);
    // Both hubs have the same node count (4) so any size difference is
    // attributable to depth alone.
    const nodes = [
      mkNode('f1', 'flat'), mkNode('f2', 'flat'),
      mkNode('f3', 'flat'), mkNode('f4', 'flat'),
      mkNode('d1', 'deep'), mkNode('d2', 'deep'),
      mkNode('d3', 'deep'), mkNode('d4', 'deep'),
    ];
    // `deep` hub: chain d1→d2→d3→d4 via `contains` edges (depth = 4).
    // `flat` hub: no contains edges (depth = 1).
    const edges = [
      mkEdge('e1', 'd1', 'd2', 'contains'),
      mkEdge('e2', 'd2', 'd3', 'contains'),
      mkEdge('e3', 'd3', 'd4', 'contains'),
    ];
    const out = computeGalaxyHubDiameters(hubs, nodes, edges);
    expect(out['deep']).toBeGreaterThan(out['flat']);
  });

  it('non-`contains` edges do not inflate depth', () => {
    // Only `contains` edges define the containment depth. `triggers`,
    // `navigates-to`, `data-flow`, `shares-state`, `depends-on` are
    // peer relationships and must not be counted toward depth.
    const hubs = [mkHub('h')];
    const nodes = [
      mkNode('a', 'h'), mkNode('b', 'h'),
      mkNode('c', 'h'), mkNode('d', 'h'),
    ];
    const triggersEdges = [
      mkEdge('e1', 'a', 'b', 'triggers'),
      mkEdge('e2', 'b', 'c', 'triggers'),
      mkEdge('e3', 'c', 'd', 'triggers'),
    ];
    const containsEdges = [
      mkEdge('e1', 'a', 'b', 'contains'),
      mkEdge('e2', 'b', 'c', 'contains'),
      mkEdge('e3', 'c', 'd', 'contains'),
    ];
    const withTriggers = computeGalaxyHubDiameters(hubs, nodes, triggersEdges);
    const withContains = computeGalaxyHubDiameters(hubs, nodes, containsEdges);
    // Same node count, but the contains-chain hub should be larger.
    expect(withContains['h']).toBeGreaterThan(withTriggers['h']);
  });

  it('ignores edges that cross hub boundaries when computing per-hub depth', () => {
    const hubs = ['a', 'b'].map(mkHub);
    const nodes = [
      mkNode('a1', 'a'), mkNode('a2', 'a'),
      mkNode('b1', 'b'), mkNode('b2', 'b'),
    ];
    // Cross-hub contains edge — must not contribute to either hub's depth.
    const edges = [mkEdge('x', 'a1', 'b1', 'contains')];
    const out = computeGalaxyHubDiameters(hubs, nodes, edges);
    // With no in-hub contains edges, both hubs have depth 1; diameters
    // should be equal because they have the same node count too.
    expect(out['a']).toBe(out['b']);
  });

  it('survives a cyclic contains graph without infinite loops', () => {
    const hubs = [mkHub('h')];
    const nodes = [
      mkNode('a', 'h'), mkNode('b', 'h'), mkNode('c', 'h'),
    ];
    // Cycle: a → b → c → a (pathological but possible in user-authored
    // graphs). Orchestrator must terminate and return a finite diameter.
    const edges = [
      mkEdge('e1', 'a', 'b', 'contains'),
      mkEdge('e2', 'b', 'c', 'contains'),
      mkEdge('e3', 'c', 'a', 'contains'),
    ];
    const start = Date.now();
    const out = computeGalaxyHubDiameters(hubs, nodes, edges);
    expect(Date.now() - start).toBeLessThan(500);
    expect(Number.isFinite(out['h'])).toBe(true);
    expect(out['h']).toBeGreaterThan(0);
  });

  it('handles single-node hubs (nodeCount=1, depth=1) without crashing', () => {
    const hubs = [mkHub('only')];
    const nodes = [mkNode('n', 'only')];
    const out = computeGalaxyHubDiameters(hubs, nodes, []);
    expect(out['only']).toBe(computeGalaxyHubDiameter(1, 1));
  });

  it('handles empty hubs (nodeCount=0) — returns a base diameter from the formula', () => {
    const hubs = [mkHub('empty')];
    const out = computeGalaxyHubDiameters(hubs, [], []);
    expect(out['empty']).toBe(computeGalaxyHubDiameter(0, 0));
  });
});

describe('EB-03-02 — GraphScene wires galaxy diameters into HubHulls', () => {
  it('imports computeGalaxyHubDiameters into GraphScene', () => {
    // Source-shape link: the renderer must read the deterministic
    // per-hub diameters in galaxy mode rather than the legacy
    // `maxDist + 10` topology heuristic.
    expect(graphSceneSrc).toMatch(/computeGalaxyHubDiameters/);
  });

  it('routes radius through computeGalaxyHubDiameters when viewMode === "galaxy"', () => {
    // The galaxy-mode branch in HubHulls (or its callers) must consult the
    // per-hub diameter rather than fall through to the topology heuristic.
    expect(graphSceneSrc).toMatch(
      /viewMode\s*===\s*['"]galaxy['"][\s\S]{0,800}?(?:Diameter|computeGalaxyHubDiameters)/,
    );
  });

  it('EB-03-02 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-03-02');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
