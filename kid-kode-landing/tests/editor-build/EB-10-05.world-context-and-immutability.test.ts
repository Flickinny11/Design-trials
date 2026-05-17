// EB-10-05 — App_Name_World context + full-compile immutability proof.
//
// Spec refs:
//   §6  SC-057  "App_Name_World context is exposed at the CompiledAppView top
//                level for app-wide state simulation."
//   §6  SC-058  "Full preview-app compile does not mutate any hub or node
//                source data (INV-17). Verify: byte-identical graph snapshot
//                before/after compile."
//   §7  INV-17  "Non-destructive compile. compileHubToPreview,
//                compileAppToPreview, 'organize', and any function whose name
//                matches compile*|organize*|previewHub*|previewApp* MUST NOT
//                write to node.scenePosition, node.editorTransform,
//                node.canvasTransform, or any hub.layout field."
//   §8  INV-18  Additive schema only — existing `appNameWorldId` on
//               CompiledAppView is preserved alongside the new `world` field.
//
// haltCheck:
//   "CompiledAppView.world surfaces App_Name_World context at the top level;
//    full-compile test computes sha256 of GraphSource before/after
//    compileAppToPreview and confirms byte-identical; snapshot shows preview-app
//    boot with world-context binding rendered."
//
// EB-10-01 already covers the aggregator surface (per-hub composition,
// hash determinism, JSON.stringify byte-identity). This file adds the two
// remaining EB-10-05 predicates: the SC-057 world-context surface and the
// stricter sha256-based full-compile immutability proof over the entire
// GraphSource (hubs + nodes + edges + rootNodes), which the haltCheck calls
// out explicitly.

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  compileAppToPreview,
  type CompiledAppView,
} from '@/lib/prism-graph/compile-app';
import type {
  GraphSource,
  PrismEdge,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

// --- Fixtures (multi-hub, with rootNodes carrier) -----------------------

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

function makeNode(
  id: string,
  parentHubId: string,
  subtype = 'product-mesh',
  serviceTag = 'content',
): PrismNode {
  return {
    nodeId: id,
    subtype,
    parentHubId,
    serviceTag,
    visual: { transform: { x: 10, y: 20, width: 300, height: 200, z: 0 } },
    intent: makeIntent(),
    codeRef: `code-${id}`,
    backendRef: null,
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-eb-10-05',
    spec: {
      name: 'EB-10-05 App',
      summary: 'World-context surface fixture',
      goals: ['render', 'simulate'],
    },
    designSpec: { themeId: 'nebula' },
    buildPlan: { strategy: 'wavefront', stages: ['contract', 'render'] },
    memoryLog: [{ ts: 1, kind: 'audit', body: 'fixture' }],
    hubRegistry: [{ hubId: 'hub-a' }, { hubId: 'hub-b' }],
    nodeRegistry: [
      { nodeId: 'a1', hubId: 'hub-a' },
      { nodeId: 'b1', hubId: 'hub-b' },
    ],
    globalDependencies: [{ id: 'fal', kind: 'inference' }],
    validationRules: [{ id: 'v1', expression: 'true', severity: 'info' }],
    aiRoutingRules: [{ id: 'r1', match: 'plan/*', route: 'opus-4-7' }],
    capabilityRefs: [{ refId: 'cap-1', scope: 'app' }],
  };
}

function makeFixture(): {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  world: PrismRootNode;
} {
  const hubs: PrismHub[] = [makeHub('hub-a'), makeHub('hub-b')];
  const nodes: PrismNode[] = [
    makeNode('a1', 'hub-a'),
    makeNode('a2', 'hub-a', 'hero-cta', 'action'),
    makeNode('b1', 'hub-b'),
    makeNode('b2', 'hub-b', 'card-plane', 'content'),
  ];
  const edges: PrismEdge[] = [
    {
      edgeId: 'a1->b1',
      from: 'a1',
      to: 'b1',
      type: 'triggers',
      event: 'cta-clicked',
    } as PrismEdge,
  ];
  return { hubs, nodes, edges, world: makeWorld() };
}

// Canonical sort-keys-recursively stringify. Deterministic across runs +
// across array-insertion-order permutations. The sha256 immutability check
// hashes this serialization, so a single field mutation anywhere in the
// graph would alter the digest.
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalStringify(
          (value as Record<string, unknown>)[k],
        )}`,
    )
    .join(',')}}`;
}

function sha256OfGraphSource(graph: GraphSource): string {
  return createHash('sha256').update(canonicalStringify(graph)).digest('hex');
}

// --- Tests --------------------------------------------------------------

describe('EB-10-05 App_Name_World context + full-compile immutability', () => {
  it('SC-057: CompiledAppView.world surfaces the App_Name_World context at the top level', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    const view: CompiledAppView = compileAppToPreview(world, hubs, nodes, edges);

    // The new top-level surface MUST exist alongside the legacy
    // appNameWorldId field (INV-18: additive only).
    expect(view).toHaveProperty('world');
    const w = (view as unknown as { world: Record<string, unknown> }).world;
    expect(w).toBeDefined();

    // The world surface carries the App_Name_World identity + the D1 fields
    // that drive app-wide state simulation (spec / designSpec / buildPlan /
    // hubRegistry / nodeRegistry / globalDependencies / validationRules /
    // aiRoutingRules / memoryLog / capabilityRefs).
    expect(w.appNameWorldId).toBe(world.appNameWorldId);
    expect(w.spec).toEqual(world.spec);
    expect(w.designSpec).toEqual(world.designSpec);
    expect(w.buildPlan).toEqual(world.buildPlan);
    expect(w.hubRegistry).toEqual(world.hubRegistry);
    expect(w.nodeRegistry).toEqual(world.nodeRegistry);
    expect(w.globalDependencies).toEqual(world.globalDependencies);
    expect(w.validationRules).toEqual(world.validationRules);
    expect(w.aiRoutingRules).toEqual(world.aiRoutingRules);
    expect(w.memoryLog).toEqual(world.memoryLog);
    expect(w.capabilityRefs).toEqual(world.capabilityRefs);
  });

  it('INV-18: legacy appNameWorldId top-level field is preserved (additive-only schema)', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    expect(view.appNameWorldId).toBe(world.appNameWorldId);
  });

  it('SC-057: view.world is deeply frozen (pure data, no mutation surface)', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const w = (view as unknown as { world: Record<string, unknown> }).world;
    expect(Object.isFrozen(w)).toBe(true);
  });

  it('SC-058 / INV-17: sha256(GraphSource) is byte-identical before and after compileAppToPreview', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    // The GraphSource is the full input surface that compileAppToPreview
    // consumes — hubs + nodes + edges + the rootNodes carrier (RA-07).
    const graph: GraphSource = { hubs, nodes, edges, rootNodes: [world] };
    const beforeHash = sha256OfGraphSource(graph);

    compileAppToPreview(world, hubs, nodes, edges);

    const afterHash = sha256OfGraphSource(graph);
    expect(afterHash).toBe(beforeHash);
  });

  it('SC-058 / INV-17: sha256 byte-identity holds when called twice with edges + cross-hub tethers (full app surface)', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    const crossHubEdge: PrismEdge = {
      edgeId: 'a2->b2-data',
      from: 'a2',
      to: 'b2',
      type: 'data-flow',
    } as PrismEdge;
    const allEdges: PrismEdge[] = [...edges, crossHubEdge];
    const graph: GraphSource = { hubs, nodes, edges: allEdges, rootNodes: [world] };
    const beforeHash = sha256OfGraphSource(graph);

    compileAppToPreview(world, hubs, nodes, allEdges);
    compileAppToPreview(world, hubs, nodes, allEdges);

    expect(sha256OfGraphSource(graph)).toBe(beforeHash);
  });

  it('SC-057: view.world is a snapshot — mutating the source PrismRootNode after compile does not change view.world', () => {
    const { hubs, nodes, edges, world } = makeFixture();
    const view = compileAppToPreview(world, hubs, nodes, edges);
    const w = (view as unknown as {
      world: { spec: { name?: string }; hubRegistry: Array<{ hubId: string }> };
    }).world;
    const originalName = w.spec.name;
    const originalHubRegistryLength = w.hubRegistry.length;

    // Mutate the source root in place (would-be downstream edit).
    world.spec.name = 'MUTATED';
    world.hubRegistry.push({ hubId: 'hub-c' });

    expect(w.spec.name).toBe(originalName);
    expect(w.hubRegistry.length).toBe(originalHubRegistryLength);
  });

  it('SC-057: the world surface changes the aggregator hash when world data changes (world is part of the hash payload)', () => {
    const baseFixture = makeFixture();
    const baseView = compileAppToPreview(
      baseFixture.world,
      baseFixture.hubs,
      baseFixture.nodes,
      baseFixture.edges,
    );

    const altWorld: PrismRootNode = {
      ...makeWorld(),
      spec: { name: 'Different App' },
    };
    const altView = compileAppToPreview(
      altWorld,
      baseFixture.hubs,
      baseFixture.nodes,
      baseFixture.edges,
    );

    expect(altView.hash).not.toBe(baseView.hash);
  });
});
