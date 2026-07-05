// EB-03-04 — Galaxy mode: reason-colored animated tether lines between hubs.
//
// Spec refs:
//   §3 SC-015 — Tether lines render between hubs with reason-colored edges
//               (colors per `EDGE_COLORS`). Translucent. Animated.
//   §3 RA-15  — The existing `EDGE_COLORS` table in `GraphScene.tsx` is the
//               deterministic source of tether colors. Phase 3 extends it only
//               by adding category-specific entries for galaxy-mode hub-to-hub
//               reasons; existing entries are not changed.
//
// haltCheck (from ralph-state.json):
//   "Inter-hub tether lines render in galaxy mode with EDGE_COLORS-derived
//    colors, translucent material, and a subtle animation (pulse / flow);
//    existing EDGE_COLORS entries unchanged."
//
// Contract:
//   - `computeGalaxyHubTethers(nodes, edges)` is a pure function exported from
//     `src/lib/galaxy-tethers.ts`. It returns one tether per unique
//     (hubA, hubB, type) tuple where `hubA < hubB` (canonical ordering — an
//     edge between two hubs is undirected for visual tether purposes) and the
//     edge's source and target nodes live in different hubs.
//   - Same input → same output (no RNG, no clock).
//   - Intra-hub edges (source and target share at least one hub) are excluded.
//   - Edges whose endpoints can't be resolved are dropped.
//   - The renderer (`GraphScene.tsx`) only mounts tethers when
//     `viewMode === 'galaxy'`, uses `EDGE_COLORS[type]` for color, applies a
//     translucent material, and animates the lines via `useFrame`.
//   - Existing `EDGE_COLORS` entries are byte-for-byte unchanged.
//
// Source-shape strategy mirrors EB-03-01..EB-03-03: pure function tested
// directly under vitest's node env; renderer wiring verified via regex
// assertions on `GraphScene.tsx`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { computeGalaxyHubTethers } from '../../src/lib/galaxy-tethers';

const repoRoot = join(__dirname, '..', '..');
const galaxyTethersSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'galaxy-tethers.ts'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

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

describe('EB-03-04 — computeGalaxyHubTethers (SC-015)', () => {
  it('exports computeGalaxyHubTethers as a pure function', () => {
    expect(typeof computeGalaxyHubTethers).toBe('function');
  });

  it('produces identical output on two consecutive calls (determinism)', () => {
    const nodes = [
      mkNode('a1', 'a'),
      mkNode('b1', 'b'),
    ];
    const edges = [mkEdge('e1', 'a1', 'b1', 'data-flow')];
    const out1 = computeGalaxyHubTethers(nodes, edges);
    const out2 = computeGalaxyHubTethers(nodes, edges);
    expect(out1).toEqual(out2);
  });

  it('emits one tether for an edge that crosses hub boundaries', () => {
    const nodes = [
      mkNode('a1', 'a'),
      mkNode('b1', 'b'),
    ];
    const edges = [mkEdge('e1', 'a1', 'b1', 'data-flow')];
    const out = computeGalaxyHubTethers(nodes, edges);
    expect(out).toHaveLength(1);
    const t = out[0];
    expect(t.type).toBe('data-flow');
    // Canonical ordering: hubA < hubB lexicographically so a single
    // (hubA, hubB, type) tuple represents the undirected tether.
    expect(t.hubA).toBe('a');
    expect(t.hubB).toBe('b');
  });

  it('emits zero tethers for intra-hub edges', () => {
    const nodes = [
      mkNode('a1', 'a'),
      mkNode('a2', 'a'),
    ];
    const edges = [mkEdge('e1', 'a1', 'a2', 'data-flow')];
    expect(computeGalaxyHubTethers(nodes, edges)).toEqual([]);
  });

  it('deduplicates: multiple cross-hub edges of the same type between the same hubs collapse to one tether', () => {
    const nodes = [
      mkNode('a1', 'a'),
      mkNode('a2', 'a'),
      mkNode('b1', 'b'),
      mkNode('b2', 'b'),
    ];
    const edges = [
      mkEdge('e1', 'a1', 'b1', 'data-flow'),
      mkEdge('e2', 'a2', 'b2', 'data-flow'),
      mkEdge('e3', 'b1', 'a1', 'data-flow'),
    ];
    const out = computeGalaxyHubTethers(nodes, edges);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ hubA: 'a', hubB: 'b', type: 'data-flow' });
  });

  it('preserves distinct types between the same hub pair', () => {
    const nodes = [mkNode('a1', 'a'), mkNode('b1', 'b')];
    const edges = [
      mkEdge('e1', 'a1', 'b1', 'data-flow'),
      mkEdge('e2', 'a1', 'b1', 'navigates-to'),
    ];
    const out = computeGalaxyHubTethers(nodes, edges);
    expect(out).toHaveLength(2);
    const types = out.map((t) => t.type).sort();
    expect(types).toEqual(['data-flow', 'navigates-to']);
  });

  it('handles multiple distinct hub pairs', () => {
    const nodes = [
      mkNode('a1', 'a'),
      mkNode('b1', 'b'),
      mkNode('c1', 'c'),
    ];
    const edges = [
      mkEdge('e1', 'a1', 'b1', 'data-flow'),
      mkEdge('e2', 'a1', 'c1', 'data-flow'),
      mkEdge('e3', 'b1', 'c1', 'shares-state'),
    ];
    const out = computeGalaxyHubTethers(nodes, edges);
    expect(out).toHaveLength(3);
    const keys = out.map((t) => `${t.hubA}|${t.hubB}|${t.type}`).sort();
    expect(keys).toEqual([
      'a|b|data-flow',
      'a|c|data-flow',
      'b|c|shares-state',
    ]);
  });

  it('drops edges whose endpoints cannot be resolved', () => {
    const nodes = [mkNode('a1', 'a'), mkNode('b1', 'b')];
    const edges = [
      mkEdge('e1', 'a1', 'ghost', 'data-flow'),
      mkEdge('e2', 'b1', 'a1', 'data-flow'),
    ];
    const out = computeGalaxyHubTethers(nodes, edges);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ hubA: 'a', hubB: 'b', type: 'data-flow' });
  });

  it('treats nodes that share at least one hub as intra-hub (multi-hub membership)', () => {
    // A node can belong to multiple hubs. If source and target share any hub,
    // the edge is intra-hub by membership and contributes no tether.
    const a1 = mkNode('a1', 'a');
    a1.hubIds = ['a', 'b'];
    const b1 = mkNode('b1', 'b');
    b1.hubIds = ['b'];
    const out = computeGalaxyHubTethers([a1, b1], [mkEdge('e1', 'a1', 'b1', 'data-flow')]);
    expect(out).toEqual([]);
  });

  it('uses no RNG and no clock', () => {
    expect(galaxyTethersSrc).not.toMatch(/Math\.random\s*\(/);
    expect(galaxyTethersSrc).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(galaxyTethersSrc).not.toMatch(/performance\.now\s*\(/);
  });

  it('every tether carries a stable id derivable from (hubA, hubB, type)', () => {
    const nodes = [mkNode('a1', 'a'), mkNode('b1', 'b')];
    const out = computeGalaxyHubTethers(nodes, [mkEdge('e1', 'a1', 'b1', 'data-flow')]);
    expect(out[0].id).toBe('a__b__data-flow');
  });
});

describe('EB-03-04 — GraphScene wires galaxy hub tethers', () => {
  it('imports computeGalaxyHubTethers from galaxy-tethers', () => {
    expect(graphSceneSrc).toMatch(/computeGalaxyHubTethers/);
    expect(graphSceneSrc).toMatch(/from\s+['"]@\/lib\/galaxy-tethers['"]/);
  });

  it('mounts the galaxy hub tether overlay only when viewMode === "galaxy"', () => {
    // The renderer must gate the tether overlay on galaxy mode so hub-world
    // and canvas don't grow visual cruft.
    expect(graphSceneSrc).toMatch(
      /viewMode\s*===\s*['"]galaxy['"][\s\S]{0,400}?GalaxyHubTethers/,
    );
  });

  it('defines a GalaxyHubTethers component', () => {
    expect(graphSceneSrc).toMatch(/function\s+GalaxyHubTethers\s*\(/);
  });

  it('reads tether color from EDGE_COLORS keyed by edge type', () => {
    // Inside the tether renderer, color must come from EDGE_COLORS[type], not
    // a new ad-hoc palette. RA-15 makes EDGE_COLORS the deterministic source.
    expect(graphSceneSrc).toMatch(
      /function\s+GalaxyHubTethers[\s\S]{0,2000}?EDGE_COLORS\s*\[[^\]]+\]/,
    );
  });

  it('renders a translucent tether material (transparent + opacity)', () => {
    // SC-015: "Translucent." The tether's line material must be transparent
    // and use a sub-1 opacity so the underlying hubs and starfield show through.
    const block = graphSceneSrc.match(
      /function\s+GalaxyHubTethers[\s\S]{0,4000}?\n\}\n/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/transparent/);
    expect(block![0]).toMatch(/opacity\s*=/);
  });

  it('animates the tethers via useFrame (subtle pulse/flow)', () => {
    // SC-015: "Animated." useFrame is the R3F per-frame hook used elsewhere
    // (WorldSun emissive pulse, Edge sim updates). Require it inside the
    // tether component.
    const block = graphSceneSrc.match(
      /function\s+GalaxyHubTethers[\s\S]{0,4000}?\n\}\n/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/useFrame/);
  });

  it('does NOT mutate existing EDGE_COLORS entries (RA-15: additive only)', () => {
    // Existing entries (contains, navigates-to, triggers, data-flow,
    // shares-state, depends-on) must remain byte-for-byte. New galaxy-mode
    // reason entries MAY be added but the originals are frozen.
    //
    // 2026-06-09 UI design overhaul: the frozen values were deliberately
    // re-pinned from the legacy literals (blue rgba / cyan #5ee0ff / purple
    // #a978ff / gray-blue #6b7694) to the Observatory Brass design-system
    // tokens (Logan-ordered chrome retint — purple is banned). RA-15's
    // intent — tether wiring must never have color SIDE-EFFECTS — is
    // preserved: the table stays frozen, at the new sanctioned values.
    expect(graphSceneSrc).toMatch(/contains:\s*dsAlpha\(DS\.brass400, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'navigates-to':\s*DS\.ice300/);
    expect(graphSceneSrc).toMatch(/triggers:\s*dsAlpha\(DS\.ok, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'data-flow':\s*dsAlpha\(DS\.ok, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'shares-state':\s*DS\.brass300/);
    expect(graphSceneSrc).toMatch(/'depends-on':\s*DS\.neutral/);
  });

  it('EB-03-04 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-03-04');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
