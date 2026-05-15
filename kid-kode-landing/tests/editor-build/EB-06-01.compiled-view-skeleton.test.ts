// EB-06-01 — CompiledHubView type + compileHubToPreview skeleton.
//
// Spec refs:
//   §6 SC-028  "CompiledHubView interface exists in
//               kid-kode-landing/src/lib/prism-graph/compiled-view.ts (or
//               equivalent): pure data, deeply readonly, references no
//               React/Three.js types."
//   §6 SC-029  "compileHubToPreview(hub, nodes, world) → CompiledHubView is
//               pure and deterministic — identical input produces identical
//               output (hash-comparable)."
//   §6 SC-030  "compileHubToPreview never writes to hub.layout,
//               node.scenePosition, node.editorTransform, or
//               node.canvasTransform. Verify: snapshot of source graph
//               before/after compile is byte-identical."
//   §8 INV-17  "Non-destructive compile. compileHubToPreview, ... MUST NOT
//               write to node.scenePosition, node.editorTransform,
//               node.canvasTransform, or any hub.layout field."
//
// haltCheck:
//   "CompiledHubView interface is deeply readonly + pure data (no React/Three.js
//    types); compileHubToPreview signature accepts (hub, nodes, world) and
//    returns CompiledHubView; tsc clean."
//
// This test only exercises the Phase 6 skeleton: type shape, function
// signature, deterministic output, byte-identical source graph. Anchor-rule
// content (SC-031), full cameraRail damping (SC-032), and background-layer
// pinning (SC-033) are deferred to follow-up tasks in Phase 6/7.

import { describe, expect, it } from 'vitest';

import {
  type CompiledHubView,
  compileHubToPreview,
} from '@/lib/prism-graph/compiled-view';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

// --- Type-level assertions (compile-time enforcement of SC-028). ---------
//
// `IsReadonlyKey` flags any *writable* property at any nesting level. The
// `MutableLeaf` union accumulates the offending key paths; if anything is
// writable it surfaces as a non-`never` type and `_DeeplyReadonly` fails
// to compile. Using "writable detection" instead of a structural
// equality check sidesteps the tuple-vs-array shape divergence that
// trips a naïve `DeepReadonly<T>` recursion.

type Writable<T> = {
  -readonly [K in keyof T]: T[K];
};

type WritableKeys<T> = {
  [K in keyof T]: IfEquals<{ [P in K]: T[K] }, { -readonly [P in K]: T[K] }, K, never>;
}[keyof T];

type IfEquals<X, Y, A, B> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

type MutableLeaves<T> = T extends readonly (infer U)[]
  ? MutableLeaves<U>
  : T extends object
    ? WritableKeys<T> | { [K in keyof T]: MutableLeaves<T[K]> }[keyof T]
    : never;

type AssertNever<T extends never> = T;

// If a future change introduces ANY writable property anywhere in
// CompiledHubView, MutableLeaves<CompiledHubView> stops being `never` and
// this assertion fails to compile (and the test cannot run).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _DeeplyReadonly = AssertNever<MutableLeaves<CompiledHubView>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _UnusedWritable = Writable<{ x: 1 }>; // silences unused-type linter

// --- Fixtures ------------------------------------------------------------

function makeHub(): PrismHub {
  return {
    hubId: 'hub-alpha',
    title: 'Alpha Hub',
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 1800,
      backgroundColor: '#101010',
      mockupUrl: null,
    },
  };
}

function makeNodes(): PrismNode[] {
  return [
    {
      nodeId: 'node-1',
      subtype: 'card',
      parentHubId: 'hub-alpha',
      serviceTag: 'content',
      visual: {
        transform: { x: 100, y: 200, width: 300, height: 400, z: 1 },
      },
      intent: {
        caption: 'first',
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
      },
      codeRef: 'ref-1',
      backendRef: null,
    },
    {
      nodeId: 'node-2',
      subtype: 'button',
      parentHubId: 'hub-alpha',
      serviceTag: 'action',
      visual: {
        transform: { x: 500, y: 600, width: 200, height: 80, z: 2 },
      },
      intent: {
        caption: 'second',
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
      },
      codeRef: 'ref-2',
      backendRef: null,
    },
  ];
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world',
    spec: { name: 'Alpha App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'hub-alpha' }],
    nodeRegistry: [
      { nodeId: 'node-1', hubId: 'hub-alpha', subtype: 'card' },
      { nodeId: 'node-2', hubId: 'hub-alpha', subtype: 'button' },
    ],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

// --- Tests ---------------------------------------------------------------

describe('EB-06-01 compileHubToPreview (skeleton)', () => {
  it('SC-028: returns a CompiledHubView whose top-level shape is hub-id + world ref + background + cameraRail + nodes + hash', () => {
    const hub = makeHub();
    const nodes = makeNodes();
    const world = makeWorld();

    const view = compileHubToPreview(hub, nodes, world);

    expect(typeof view).toBe('object');
    expect(view.hubId).toBe('hub-alpha');
    expect(view.world.appNameWorldId).toBe('app-name-world');
    expect(Array.isArray(view.background)).toBe(true);
    expect(Array.isArray(view.nodes)).toBe(true);
    expect(view.nodes).toHaveLength(2);
    expect(view.cameraRail).toBeDefined();
    expect(typeof view.hash).toBe('string');
    expect(view.hash.length).toBeGreaterThan(0);
  });

  it('SC-029: identical input produces deep-equal output and identical hash', () => {
    const a = compileHubToPreview(makeHub(), makeNodes(), makeWorld());
    const b = compileHubToPreview(makeHub(), makeNodes(), makeWorld());

    expect(b).toEqual(a);
    expect(b.hash).toBe(a.hash);
  });

  it('SC-029: a different hub id changes the hash', () => {
    const hubA = makeHub();
    const hubB = { ...makeHub(), hubId: 'hub-beta' };
    const a = compileHubToPreview(hubA, makeNodes(), makeWorld());
    const b = compileHubToPreview(hubB, makeNodes(), makeWorld());

    expect(b.hash).not.toBe(a.hash);
  });

  it('SC-030 / INV-17: source graph is byte-identical before and after compile (non-destructive)', () => {
    const hub = makeHub();
    const nodes = makeNodes();
    const world = makeWorld();
    const beforeHub = JSON.stringify(hub);
    const beforeNodes = JSON.stringify(nodes);
    const beforeWorld = JSON.stringify(world);

    compileHubToPreview(hub, nodes, world);

    expect(JSON.stringify(hub)).toBe(beforeHub);
    expect(JSON.stringify(nodes)).toBe(beforeNodes);
    expect(JSON.stringify(world)).toBe(beforeWorld);
  });

  it('SC-029: every compiled node references a source nodeId and carries an anchor + depth', () => {
    const view = compileHubToPreview(makeHub(), makeNodes(), makeWorld());
    const sourceIds = makeNodes().map((n) => n.nodeId);

    for (const entry of view.nodes) {
      expect(sourceIds).toContain(entry.nodeId);
      expect(entry.anchor).toBeDefined();
      expect(typeof entry.z).toBe('number');
      expect(typeof entry.anchor.kind).toBe('string');
    }
  });
});
