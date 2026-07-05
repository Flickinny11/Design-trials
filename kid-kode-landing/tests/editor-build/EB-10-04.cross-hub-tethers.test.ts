// EB-10-04 — Cross-hub tether rendering in preview-app.
//
// Spec refs:
//   §10 SC-056 (verbatim):
//     "Cross-hub tethers render in preview-app: edges that cross hub
//      boundaries are visible during transition and resolved on arrival."
//   §10 SC-053  CompiledAppView aggregator surface — the cross-hub tether
//                surface lives at the AppView top level (alongside hubs +
//                appNameWorldId) so the runtime can install it once and
//                consume it during inter-hub navigation without re-deriving.
//   §10 SC-058  Full preview-app compile does not mutate any hub or node
//                source data (INV-17). Verify: byte-identical (hubs, nodes,
//                world, edges) snapshot before/after compile.
//   §8  INV-17  Non-destructive compile.
//   §8  INV-18  Schema additivity — accepting an optional fourth `edges`
//                argument never breaks the existing 3-arg call sites
//                (EB-10-01 / EB-10-02 tests + src/app/page.tsx).
//   §8  FP-04   Destructive position writes in compile/preview functions are
//                forbidden — applies to the new cross-hub tether deriver.
//   §9  SC-049  Existing tether-fire surface is the path "the receiving
//                hub's animation library" runs through on arrival.
//
// haltCheck:
//   "Edges that cross hub boundaries render during the transit and resolve
//    on arrival; the receiving hub's animation library invokes correctly on
//    arrival."
//
// Test plan (pure data — render side asserted by verify-editor-runtimes
// snapshot via state.json key cross_hub_tethers_count):
//
//   1. Cross-hub edges (from.parentHubId !== to.parentHubId) appear in
//      `view.crossHubTethers`; intra-hub edges are excluded.
//   2. Each tether entry carries {from:{hubId,nodeId}, to:{hubId,nodeId},
//      type, event?} and is deep-frozen.
//   3. Defensive: edges referencing unknown node ids are excluded so a
//      stale graph never crashes preview-app boot.
//   4. Deterministic ordering: same inputs → identical entry order across
//      runs (sorted by from.hubId, from.nodeId, to.hubId, to.nodeId, type,
//      event).
//   5. Hash discipline: changing one cross-hub edge changes view.hash;
//      changing only intra-hub edges does NOT change view.hash (intra-hub
//      edges are not part of the AppView surface).
//   6. Arrival helper getCrossHubTethersArrivingAt(view, hubId) returns
//      only tethers whose to.hubId === hubId. This is the surface the
//      preview-app runtime invokes the animation library through (SC-049).
//   7. Departure helper getCrossHubTethersDepartingFrom(view, hubId) is
//      the symmetric surface for "visible during transition" rendering —
//      the tethers leaving the from-hub anchor are the ones the camera
//      sweeps along during the EB-10-03 damped transit.
//   8. INV-17 / SC-058: deep snapshot of (hubs, nodes, world, edges) is
//      byte-identical before and after compileAppToPreview(...edges).
//   9. INV-18: 3-arg compileAppToPreview(world, hubs, nodes) still works
//      and yields an empty crossHubTethers array.
//  10. FP-04: cross-hub-tethers.ts contains no destructive position writes.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileAppToPreview } from '@/lib/prism-graph/compile-app';
import {
  getCrossHubTethersArrivingAt,
  getCrossHubTethersDepartingFrom,
  type CompiledCrossHubTether,
} from '@/lib/prism-graph/cross-hub-tethers';
import type {
  PrismEdge,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

// --- Fixtures (mirror EB-10-01 shape; add edges) -----------------------

function makeIntent(overrides: Partial<PrismIntent> = {}): PrismIntent {
  return {
    caption: 'fixture',
    behaviorSpec: {
      interactions: [],
      apiCalls: [],
      dataBindings: [],
      emits: [],
      listens: [],
      triggersDownstream: [],
    },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
    ...overrides,
  };
}

function makeHub(hubId: string): PrismHub {
  return {
    hubId,
    title: `${hubId} title`,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 2400,
      backgroundColor: '#080808',
      mockupUrl: null,
    },
  };
}

function makeNode(id: string, parentHubId: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'product-mesh',
    parentHubId,
    serviceTag: 'content',
    visual: { transform: { x: 10, y: 20, width: 300, height: 200, z: 0 } },
    intent: makeIntent(),
    codeRef: `code-${id}`,
    backendRef: null,
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-tri',
    spec: { name: 'Tri-Hub App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'hub-a' }, { hubId: 'hub-b' }, { hubId: 'hub-c' }],
    nodeRegistry: [],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

function makeTriHubFixture(): {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  world: PrismRootNode;
} {
  const hubs: PrismHub[] = [makeHub('hub-a'), makeHub('hub-b'), makeHub('hub-c')];
  const nodes: PrismNode[] = [
    makeNode('a1', 'hub-a'),
    makeNode('a2', 'hub-a'),
    makeNode('b1', 'hub-b'),
    makeNode('b2', 'hub-b'),
    makeNode('c1', 'hub-c'),
  ];
  // 1 intra-hub (a1→a2), 3 cross-hub (a1→b1, a2→c1, b2→a1).
  const edges: PrismEdge[] = [
    { from: 'a1', to: 'a2', type: 'state-update' },
    { from: 'a1', to: 'b1', type: 'triggers', event: 'submit' },
    { from: 'a2', to: 'c1', type: 'data-flow' },
    { from: 'b2', to: 'a1', type: 'event-bubble' },
  ];
  return { hubs, nodes, edges, world: makeWorld() };
}

// --- Tests --------------------------------------------------------------

describe('EB-10-04 SC-056 cross-hub tether rendering in preview-app', () => {
  it('SC-056: cross-hub edges appear in view.crossHubTethers; intra-hub edges are excluded', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    expect(view.crossHubTethers).toBeDefined();
    expect(view.crossHubTethers.length).toBe(3);
    for (const t of view.crossHubTethers) {
      expect(t.from.hubId).not.toBe(t.to.hubId);
    }
    const pairs = view.crossHubTethers.map(
      (t) => `${t.from.nodeId}->${t.to.nodeId}`,
    );
    expect(pairs).toContain('a1->b1');
    expect(pairs).toContain('a2->c1');
    expect(pairs).toContain('b2->a1');
    expect(pairs).not.toContain('a1->a2');
  });

  it('SC-056: each tether carries {from:{hubId,nodeId}, to:{hubId,nodeId}, type} and is frozen', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const trigger = view.crossHubTethers.find(
      (t) => t.from.nodeId === 'a1' && t.to.nodeId === 'b1',
    );
    expect(trigger).toBeDefined();
    expect(trigger!.from.hubId).toBe('hub-a');
    expect(trigger!.to.hubId).toBe('hub-b');
    expect(trigger!.type).toBe('triggers');
    expect(trigger!.event).toBe('submit');
    expect(Object.isFrozen(trigger)).toBe(true);
    expect(Object.isFrozen(trigger!.from)).toBe(true);
    expect(Object.isFrozen(trigger!.to)).toBe(true);
    expect(Object.isFrozen(view.crossHubTethers)).toBe(true);
  });

  it('SC-056: edges referencing unknown node ids are excluded (defensive)', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const stale: PrismEdge[] = [
      ...edges,
      { from: 'phantom', to: 'b1', type: 'triggers' },
      { from: 'a1', to: 'phantom2', type: 'data-flow' },
    ];
    const view = compileAppToPreview(world, hubs, nodes, stale);
    expect(view.crossHubTethers.length).toBe(3);
    for (const t of view.crossHubTethers) {
      expect(t.from.nodeId).not.toBe('phantom');
      expect(t.to.nodeId).not.toBe('phantom2');
    }
  });

  it('SC-056: ordering is deterministic across input order permutations', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const a = compileAppToPreview(world, hubs, nodes, edges);
    const reordered = [...edges].reverse();
    const b = compileAppToPreview(world, hubs, nodes, reordered);
    expect(b.crossHubTethers.map((t) => `${t.from.nodeId}->${t.to.nodeId}:${t.type}`))
      .toEqual(
        a.crossHubTethers.map((t) => `${t.from.nodeId}->${t.to.nodeId}:${t.type}`),
      );
  });

  it('SC-053 + SC-056: changing one cross-hub edge changes view.hash', () => {
    const base = makeTriHubFixture();
    const a = compileAppToPreview(base.world, base.hubs, base.nodes, base.edges);
    const flipped: PrismEdge[] = base.edges.map((e) =>
      e.from === 'a1' && e.to === 'b1'
        ? { ...e, type: 'data-flow' as const }
        : e,
    );
    const b = compileAppToPreview(base.world, base.hubs, base.nodes, flipped);
    expect(a.hash).not.toBe(b.hash);
  });

  it('SC-053 + SC-056: changing only an intra-hub edge does NOT change view.hash (intra-hub edges are not part of the AppView surface)', () => {
    const base = makeTriHubFixture();
    const a = compileAppToPreview(base.world, base.hubs, base.nodes, base.edges);
    const intraSwapped: PrismEdge[] = base.edges.map((e) =>
      e.from === 'a1' && e.to === 'a2'
        ? { ...e, type: 'data-flow' as const }
        : e,
    );
    const b = compileAppToPreview(base.world, base.hubs, base.nodes, intraSwapped);
    expect(b.hash).toBe(a.hash);
  });

  it('SC-056: getCrossHubTethersArrivingAt returns only tethers whose to.hubId === hubId (the SC-049 animation-library invocation surface)', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const arrivingAtA = getCrossHubTethersArrivingAt(view, 'hub-a');
    expect(arrivingAtA.length).toBe(1);
    expect(arrivingAtA[0].from.nodeId).toBe('b2');
    expect(arrivingAtA[0].to.nodeId).toBe('a1');

    const arrivingAtC = getCrossHubTethersArrivingAt(view, 'hub-c');
    expect(arrivingAtC.length).toBe(1);
    expect(arrivingAtC[0].from.nodeId).toBe('a2');
  });

  it('SC-056: getCrossHubTethersDepartingFrom returns only tethers leaving the named hub (the EB-10-03 transit visibility surface)', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const departingA = getCrossHubTethersDepartingFrom(view, 'hub-a');
    const pairs = departingA.map((t) => `${t.from.nodeId}->${t.to.nodeId}`);
    expect(pairs.sort()).toEqual(['a1->b1', 'a2->c1']);

    const departingC = getCrossHubTethersDepartingFrom(view, 'hub-c');
    expect(departingC.length).toBe(0);
  });

  it('INV-17 / SC-058: byte-identical (hubs, nodes, world, edges) snapshot before and after compile', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const before = {
      hubs: JSON.stringify(hubs),
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      world: JSON.stringify(world),
    };
    compileAppToPreview(world, hubs, nodes, edges);
    expect(JSON.stringify(hubs)).toBe(before.hubs);
    expect(JSON.stringify(nodes)).toBe(before.nodes);
    expect(JSON.stringify(edges)).toBe(before.edges);
    expect(JSON.stringify(world)).toBe(before.world);
  });

  it('INV-18: 3-arg compileAppToPreview(world, hubs, nodes) still works and yields an empty crossHubTethers', () => {
    const { hubs, nodes, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes);
    expect(view.crossHubTethers).toBeDefined();
    expect(view.crossHubTethers.length).toBe(0);
    expect(Object.isFrozen(view.crossHubTethers)).toBe(true);
  });

  it('SC-056: empty edges with cross-hub schema (4-arg) yields empty crossHubTethers + identical hash to the 3-arg call', () => {
    const { hubs, nodes, world } = makeTriHubFixture();
    const a = compileAppToPreview(world, hubs, nodes);
    const b = compileAppToPreview(world, hubs, nodes, []);
    expect(b.crossHubTethers.length).toBe(0);
    expect(b.hash).toBe(a.hash);
  });

  it('FP-04: cross-hub-tethers.ts contains no destructive position writes', () => {
    const file = resolve(
      __dirname,
      '..',
      '..',
      'src',
      'lib',
      'prism-graph',
      'cross-hub-tethers.ts',
    );
    const source = readFileSync(file, 'utf8');
    const fp04 = /\.(scenePosition|editorTransform|canvasTransform|compiledTransform)(\.[xyz])?\s*=(?!=)/;
    expect(fp04.test(source)).toBe(false);
  });

  it('SC-056: CompiledCrossHubTether type is structurally what the runtime consumes', () => {
    const { hubs, nodes, edges, world } = makeTriHubFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const sample: CompiledCrossHubTether = view.crossHubTethers[0];
    // Compile-time type check: structural fields are accessible without cast.
    expect(typeof sample.from.hubId).toBe('string');
    expect(typeof sample.from.nodeId).toBe('string');
    expect(typeof sample.to.hubId).toBe('string');
    expect(typeof sample.to.nodeId).toBe('string');
    expect(typeof sample.type).toBe('string');
  });
});
