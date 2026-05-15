// EB-06-04 — Source-graph immutability proof through compile.
//
// Spec refs:
//   §6 SC-030  "compileHubToPreview never writes to hub.layout,
//               node.scenePosition, node.editorTransform, or
//               node.canvasTransform. Verify: snapshot of source graph
//               before/after compile is byte-identical."
//   §8 INV-17  "Non-destructive compile. compileHubToPreview ... MUST NOT
//               write to node.scenePosition, node.editorTransform,
//               node.canvasTransform, or any hub.layout field."
//
// haltCheck (EB-06-04):
//   "Test computes sha256 of JSON.stringify(GraphSource) before and after
//    compileHubToPreview; sha is byte-identical. No hub.layout or node
//    position field is touched by the compile."
//
// This test is the SC-030 verifier. It builds a fully populated GraphSource
// (hubs[], nodes[], edges[], rootNodes[]), takes a sha256 snapshot of the
// canonical JSON, runs compileHubToPreview, and asserts the post-compile
// sha256 is byte-identical to the pre-compile sha256. Beyond the hash, it
// also pins the specific fields named in SC-030 / INV-17 (hub.layout.*,
// node.scenePosition, node.editorTransform, node.canvasTransform) via
// targeted before/after comparisons so a future regression that touches a
// field but not the full graph can't slip past a coarse hash check.

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { compileHubToPreview } from '@/lib/prism-graph/compiled-view';
import type {
  GraphSource,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

// --- Fixtures ------------------------------------------------------------

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

function makeHub(): PrismHub {
  return {
    hubId: 'hub-immut',
    title: 'Immutability Hub',
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 2400,
      backgroundColor: '#101010',
      mockupUrl: 'https://example.invalid/mockup.avif',
    },
  };
}

function makeNode(
  id: string,
  subtype: string,
  serviceTag: string,
  intentOverrides: Partial<PrismIntent> = {},
  z = 0,
): PrismNode {
  // INV-17 / SC-030 target fields (scenePosition + canvasTransform) populated
  // with non-default values so that an accidental write to them by compile
  // would be visible in the byte-identical comparison. `editorTransform` is
  // declared as an additive editor-build field (see gap-analysis §3 schema
  // delta) but isn't yet on the PrismNode type; we attach it via an
  // intersection cast and assert against it through a `LegacyNode` cast in
  // the tests below.
  const node: PrismNode & { editorTransform?: { x: number; y: number; z: number } } = {
    nodeId: id,
    subtype,
    parentHubId: 'hub-immut',
    serviceTag,
    visual: {
      transform: { x: 11, y: 22, width: 333, height: 222, z },
    },
    intent: makeIntent(intentOverrides),
    codeRef: `code-${id}`,
    backendRef: null,
    scenePosition: {
      x: 1,
      y: 2,
      z: 3,
      rotationX: 0.1,
      rotationY: 0.2,
      rotationZ: 0.3,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    canvasTransform: {
      x: 7,
      y: 8,
      z: 9,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    },
    editorTransform: { x: 4, y: 5, z: 6 },
  };
  return node;
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-immut',
    spec: { name: 'Immut App', summary: 'fixture', goals: ['g1'] },
    designSpec: { themeId: 'default' },
    buildPlan: { strategy: 'standard' },
    memoryLog: [{ ts: 1, kind: 'init', body: 'fixture' }],
    hubRegistry: [{ hubId: 'hub-immut' }],
    nodeRegistry: [{ nodeId: 'n1', hubId: 'hub-immut' }],
    globalDependencies: [{ id: 'dep-1', kind: 'capability' }],
    validationRules: [
      { id: 'vr-1', expression: 'always', severity: 'info' },
    ],
    aiRoutingRules: [{ id: 'rr-1', match: '*', route: 'default' }],
    capabilityRefs: [],
  };
}

function makeGraphSource(): GraphSource {
  const hub = makeHub();
  const nodes: PrismNode[] = [
    makeNode('n-mesh', 'product-mesh', 'content'),
    makeNode('n-cta', 'hero-cta', 'action', {}, 5),
    makeNode('n-parallax', 'grid-parallax', 'decor', {}, 1),
    makeNode('n-hud', 'product-mesh', 'content', {
      visualSpec: { textContent: [], layers: [], cameraLocked: true },
    }),
  ];
  const edges = [
    { from: 'n-cta', to: 'n-mesh', type: 'triggers' as const },
    { from: 'n-mesh', to: 'n-parallax', type: 'state-update' as const },
  ];
  return {
    hubs: [hub],
    nodes,
    edges,
    rootNodes: [makeWorld()],
  };
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// --- Tests ---------------------------------------------------------------

describe('EB-06-04 source-graph immutability through compileHubToPreview', () => {
  it('SC-030: sha256(JSON.stringify(GraphSource)) is byte-identical before and after compile', () => {
    const graph = makeGraphSource();
    const before = sha256(JSON.stringify(graph));

    const hub = graph.hubs[0];
    const hubNodes = graph.nodes.filter((n) => n.parentHubId === hub.hubId);
    const world = graph.rootNodes![0];

    compileHubToPreview(hub, hubNodes, world);

    const after = sha256(JSON.stringify(graph));
    expect(after).toBe(before);
  });

  it('SC-030: sha256 is byte-identical across many repeated compiles on the same GraphSource', () => {
    // Defensive: even if a single compile is non-destructive by accident,
    // a stateful leak (e.g. cached map mutation) would appear after N
    // repeats. Hash after every iteration; all must equal the initial.
    const graph = makeGraphSource();
    const before = sha256(JSON.stringify(graph));

    const hub = graph.hubs[0];
    const hubNodes = graph.nodes.filter((n) => n.parentHubId === hub.hubId);
    const world = graph.rootNodes![0];

    for (let i = 0; i < 16; i += 1) {
      compileHubToPreview(hub, hubNodes, world);
      expect(sha256(JSON.stringify(graph))).toBe(before);
    }
  });

  it('INV-17: hub.layout fields are pinned (not written by compile)', () => {
    const graph = makeGraphSource();
    const hub = graph.hubs[0];
    const layoutBefore = JSON.stringify(hub.layout);

    const hubNodes = graph.nodes.filter((n) => n.parentHubId === hub.hubId);
    const world = graph.rootNodes![0];
    compileHubToPreview(hub, hubNodes, world);

    expect(JSON.stringify(hub.layout)).toBe(layoutBefore);
  });

  it('INV-17: node.scenePosition / editorTransform / canvasTransform are pinned (not written by compile)', () => {
    const graph = makeGraphSource();
    const hub = graph.hubs[0];
    const hubNodes = graph.nodes.filter((n) => n.parentHubId === hub.hubId);
    const world = graph.rootNodes![0];

    type LegacyNode = PrismNode & {
      scenePosition?: unknown;
      editorTransform?: unknown;
      canvasTransform?: unknown;
    };

    const before = hubNodes.map((n) => {
      const ln = n as LegacyNode;
      return {
        scenePosition: JSON.stringify(ln.scenePosition),
        editorTransform: JSON.stringify(ln.editorTransform),
        canvasTransform: JSON.stringify(ln.canvasTransform),
      };
    });

    compileHubToPreview(hub, hubNodes, world);

    hubNodes.forEach((n, i) => {
      const ln = n as LegacyNode;
      expect(JSON.stringify(ln.scenePosition)).toBe(before[i].scenePosition);
      expect(JSON.stringify(ln.editorTransform)).toBe(before[i].editorTransform);
      expect(JSON.stringify(ln.canvasTransform)).toBe(before[i].canvasTransform);
    });
  });

  it('SC-030: passing an empty hubNodes slice still leaves the full GraphSource byte-identical', () => {
    // Edge case: a hub with no matching nodes. The compile must still touch
    // nothing on the source graph (including the unrelated nodes that
    // weren't passed in).
    const graph = makeGraphSource();
    const before = sha256(JSON.stringify(graph));

    const hub = graph.hubs[0];
    const world = graph.rootNodes![0];
    compileHubToPreview(hub, [], world);

    expect(sha256(JSON.stringify(graph))).toBe(before);
  });
});
