// EB-10-01 — CompiledAppView + compileAppToPreview aggregator.
//
// Spec refs:
//   §10 SC-053  "compileAppToPreview(world, hubs, nodes) → CompiledAppView
//                aggregates per-hub compiles via Phase 6's compileHubToPreview."
//   §8  INV-17  "Non-destructive compile. compileHubToPreview,
//                compileAppToPreview, 'organize', and any function whose name
//                matches compile*|organize*|previewHub*|previewApp* MUST NOT
//                write to node.scenePosition, node.editorTransform,
//                node.canvasTransform, or any hub.layout field."
//   §8  FP-04   "Destructive position writes inside compile/organize/preview
//                functions ..."
//
// haltCheck:
//   "compile-app.ts exports compileAppToPreview(world, hubs, nodes) returning
//    CompiledAppView; implementation aggregates per-hub compileHubToPreview
//    results; type CompiledAppView is deeply readonly pure data."
//
// Aggregator contract:
//   * Each per-hub entry in CompiledAppView.hubs MUST match a fresh
//     compileHubToPreview(hub, nodesForHub, world) called with the same
//     inputs (hash equality is the comparator — SC-029 already guarantees
//     pure deterministic per-hub compiles).
//   * Source graph (hubs + nodes + world) is byte-identical before/after.
//   * Result + every nested object is frozen (deeply readonly pure data).
//   * Two calls on the same inputs produce hash-identical CompiledAppView
//     (the aggregator's own hash, distinct from per-hub hashes).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  compileAppToPreview,
  type CompiledAppView,
} from '@/lib/prism-graph/compile-app';
import { compileHubToPreview } from '@/lib/prism-graph/compile-hub';
import type {
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
    visual: {
      transform: { x: 10, y: 20, width: 300, height: 200, z: 0 },
    },
    intent: makeIntent(),
    codeRef: `code-${id}`,
    backendRef: null,
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-multi',
    spec: { name: 'Multi-Hub App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'hub-a' }, { hubId: 'hub-b' }],
    nodeRegistry: [],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

function makeMultiHubFixture(): {
  hubs: PrismHub[];
  nodes: PrismNode[];
  world: PrismRootNode;
} {
  const hubs: PrismHub[] = [makeHub('hub-a'), makeHub('hub-b')];
  const nodes: PrismNode[] = [
    makeNode('a1', 'hub-a'),
    makeNode('a2', 'hub-a', 'hero-cta', 'action'),
    makeNode('b1', 'hub-b'),
    makeNode('b2', 'hub-b', 'card-plane', 'content'),
  ];
  return { hubs, nodes, world: makeWorld() };
}

// --- Tests ---------------------------------------------------------------

describe('EB-10-01 CompiledAppView + compileAppToPreview aggregator', () => {
  it('SC-053: compileAppToPreview(world, hubs, nodes) returns a CompiledAppView with one compiled hub per source hub', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const view = compileAppToPreview(world, hubs, nodes);
    expect(view.hubs).toBeDefined();
    expect(view.hubs.length).toBe(hubs.length);
    const compiledIds = view.hubs.map((h) => h.hubId).slice().sort();
    const sourceIds = hubs.map((h) => h.hubId).slice().sort();
    expect(compiledIds).toEqual(sourceIds);
  });

  it('SC-053: each compiled hub entry equals a fresh compileHubToPreview(hub, nodesForHub, world) (hash-comparable)', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const view = compileAppToPreview(world, hubs, nodes);
    for (const hub of hubs) {
      const nodesForHub = nodes.filter((n) => n.parentHubId === hub.hubId);
      const expected = compileHubToPreview(hub, nodesForHub, world);
      const got = view.hubs.find((h) => h.hubId === hub.hubId);
      expect(got).toBeDefined();
      expect(got!.hash).toBe(expected.hash);
    }
  });

  it('SC-053: appNameWorldId is exposed at the CompiledAppView top level', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const view = compileAppToPreview(world, hubs, nodes);
    expect(view.appNameWorldId).toBe(world.appNameWorldId);
  });

  it('SC-053: identical inputs produce hash-identical CompiledAppView (aggregator hash is deterministic)', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const a = compileAppToPreview(world, hubs, nodes);
    const b = compileAppToPreview(world, hubs, nodes);
    expect(b.hash).toBe(a.hash);
    expect(b).toEqual(a);
  });

  it('SC-053: changing one node in one hub changes the aggregator hash', () => {
    const base = makeMultiHubFixture();
    const a = compileAppToPreview(base.world, base.hubs, base.nodes);
    const mutatedNodes = base.nodes.map((n) =>
      n.nodeId === 'a1'
        ? {
            ...n,
            visual: {
              ...n.visual,
              transform: { ...n.visual!.transform!, x: 999 },
            },
          }
        : n,
    );
    const b = compileAppToPreview(base.world, base.hubs, mutatedNodes);
    expect(a.hash).not.toBe(b.hash);
  });

  it('INV-17 / SC-058: deep snapshot of (hubs, nodes, world) is byte-identical before and after compile', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const beforeHubs = JSON.stringify(hubs);
    const beforeNodes = JSON.stringify(nodes);
    const beforeWorld = JSON.stringify(world);

    compileAppToPreview(world, hubs, nodes);

    expect(JSON.stringify(hubs)).toBe(beforeHubs);
    expect(JSON.stringify(nodes)).toBe(beforeNodes);
    expect(JSON.stringify(world)).toBe(beforeWorld);
  });

  it('SC-053: CompiledAppView and every nested compiled hub entry is frozen (deeply readonly pure data)', () => {
    const { hubs, nodes, world } = makeMultiHubFixture();
    const view: CompiledAppView = compileAppToPreview(world, hubs, nodes);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.hubs)).toBe(true);
    for (const entry of view.hubs) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.nodes)).toBe(true);
      expect(Object.isFrozen(entry.cameraRail)).toBe(true);
    }
  });

  it('SC-053: empty hubs/nodes input produces an empty but well-formed CompiledAppView', () => {
    const world = makeWorld();
    const view = compileAppToPreview(world, [], []);
    expect(view.hubs.length).toBe(0);
    expect(view.appNameWorldId).toBe(world.appNameWorldId);
    expect(typeof view.hash).toBe('string');
    expect(view.hash.length).toBeGreaterThan(0);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.hubs)).toBe(true);
  });

  it('FP-04: compile-app.ts source contains no destructive position writes', () => {
    const file = resolve(
      __dirname,
      '..',
      '..',
      'src',
      'lib',
      'prism-graph',
      'compile-app.ts',
    );
    const source = readFileSync(file, 'utf8');
    const fp04 = /\.(scenePosition|editorTransform|canvasTransform|compiledTransform)(\.[xyz])?\s*=(?!=)/;
    expect(fp04.test(source)).toBe(false);
  });
});
