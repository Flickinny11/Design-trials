// EB-06-03 — compileHubToPreview pure deterministic implementation.
//
// Spec refs:
//   §6 SC-029  "compileHubToPreview(hub, nodes, world) → CompiledHubView is
//               pure and deterministic — identical input produces identical
//               output (hash-comparable)."
//   §8 INV-17  "Non-destructive compile. compileHubToPreview ... MUST NOT
//               write to node.scenePosition, node.editorTransform,
//               node.canvasTransform, or any hub.layout field."
//   §8 FP-04   "Destructive position writes inside compile/organize/preview
//               functions ... a function whose name matches
//               compile\\w*|organize\\w*|previewHub\\w*|previewApp\\w* containing
//               on a subsequent line
//               \\.(scenePosition|editorTransform|canvasTransform|compiledTransform)
//               (\\.[xyz])?\\s*=."
//
// haltCheck:
//   "compileHubToPreview run twice on the same input produces hash-identical
//    CompiledHubView output; no mutation of source graph (positions
//    byte-identical before/after); FP-04 hook passes against this file's
//    content."
//
// EB-06-03 is the substantive implementation step: the EB-06-01 skeleton
// computed anchors from `node.visual.transform` directly (kind
// 'viewport-relative' for every node). EB-06-02 shipped the deterministic
// rule table (pickUiAnchor). EB-06-03 wires the two together so the
// compiled view's anchor.kind reflects the source's (subtype, intent,
// serviceTag) classification — without sacrificing determinism or
// touching the source graph.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  compileHubToPreview,
  type CompiledHubView,
  type CompiledAnchorKind,
} from '@/lib/prism-graph/compiled-view';
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

function makeHub(): PrismHub {
  return {
    hubId: 'hub-gamma',
    title: 'Gamma Hub',
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
  subtype: string,
  serviceTag: string,
  intentOverrides: Partial<PrismIntent> = {},
  z = 0,
): PrismNode {
  return {
    nodeId: id,
    subtype,
    parentHubId: 'hub-gamma',
    serviceTag,
    visual: {
      transform: { x: 10, y: 20, width: 300, height: 200, z },
    },
    intent: makeIntent(intentOverrides),
    codeRef: `code-${id}`,
    backendRef: null,
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-gamma',
    spec: { name: 'Gamma App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'hub-gamma' }],
    nodeRegistry: [],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

// --- Tests ---------------------------------------------------------------

describe('EB-06-03 compileHubToPreview (pure deterministic implementation)', () => {
  it('SC-029/SC-031: a mesh subtype compiles to anchor.kind = "world"', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('node-mesh', 'product-mesh', 'content'),
    ];
    const view = compileHubToPreview(hub, nodes, makeWorld());
    const entry = view.nodes.find((n) => n.nodeId === 'node-mesh');
    expect(entry).toBeDefined();
    expect(entry!.anchor.kind).toBe<CompiledAnchorKind>('world');
  });

  it('SC-029/SC-031: a CTA subtype compiles to viewport-relative (sticky → viewport-relative)', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('node-cta', 'hero-cta', 'action'),
    ];
    const view = compileHubToPreview(hub, nodes, makeWorld());
    const entry = view.nodes.find((n) => n.nodeId === 'node-cta');
    expect(entry).toBeDefined();
    expect(entry!.anchor.kind).toBe<CompiledAnchorKind>('viewport-relative');
  });

  it('SC-029/SC-031: cameraLocked intent flag overrides subtype rules → anchor.kind = "camera"', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('node-hud', 'product-mesh', 'content', {
        visualSpec: { textContent: [], layers: [], cameraLocked: true },
      }),
    ];
    const view = compileHubToPreview(hub, nodes, makeWorld());
    const entry = view.nodes.find((n) => n.nodeId === 'node-hud');
    expect(entry).toBeDefined();
    expect(entry!.anchor.kind).toBe<CompiledAnchorKind>('camera');
  });

  it('SC-029/SC-031: parallax subtypes resolve to a non-viewport-relative anchor kind', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('node-parallax', 'grid-parallax', 'decor'),
    ];
    const view = compileHubToPreview(hub, nodes, makeWorld());
    const entry = view.nodes.find((n) => n.nodeId === 'node-parallax');
    expect(entry).toBeDefined();
    // Parallax must NOT collapse to plain viewport-relative — the compiled
    // adapter dispatches differently on parallax vs sticky/viewport, so the
    // anchor kind has to carry that distinction. Anything other than
    // 'viewport-relative' satisfies the contract (we accept either
    // 'world' or 'hub-scene' here per the placeholder mapping).
    expect(entry!.anchor.kind).not.toBe<CompiledAnchorKind>('viewport-relative');
  });

  it('SC-029: identical inputs produce hash-identical output across many distinct subtype mixes', () => {
    // Beyond EB-06-01's single-fixture determinism check, exercise a wider
    // mix to catch any non-deterministic ordering in the rule wiring (e.g.
    // a Map insertion-order leak, or a Date.now() crept in).
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('n1', 'product-mesh', 'content'),
      makeNode('n2', 'hero-cta', 'action', {}, 5),
      makeNode('n3', 'card-plane', 'content', {}, 2),
      makeNode('n4', 'grid-parallax', 'decor', {}, 1),
      makeNode('n5', 'social-sprite', 'hud'),
      makeNode('n6', 'unknown-subtype-zzz', 'misc'),
      makeNode('n7', 'product-mesh', 'content', {
        visualSpec: { textContent: [], layers: [], cameraLocked: true },
      }),
    ];
    const a = compileHubToPreview(hub, nodes, makeWorld());
    const b = compileHubToPreview(hub, nodes, makeWorld());
    expect(b.hash).toBe(a.hash);
    expect(b).toEqual(a);
  });

  it('SC-030 / INV-17: deep snapshot of source graph is byte-identical before and after compile', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [
      makeNode('n1', 'product-mesh', 'content'),
      makeNode('n2', 'hero-cta', 'action', {}, 5),
      makeNode('n3', 'card-plane', 'content', {}, 2),
    ];
    const world = makeWorld();
    const beforeHub = JSON.stringify(hub);
    const beforeNodes = JSON.stringify(nodes);
    const beforeWorld = JSON.stringify(world);

    compileHubToPreview(hub, nodes, world);

    expect(JSON.stringify(hub)).toBe(beforeHub);
    expect(JSON.stringify(nodes)).toBe(beforeNodes);
    expect(JSON.stringify(world)).toBe(beforeWorld);
  });

  it('SC-029: a different intent (cameraLocked) on one node changes the hash but not the source', () => {
    const hub = makeHub();
    const lockedNodes: PrismNode[] = [
      makeNode('n1', 'product-mesh', 'content', {
        visualSpec: { textContent: [], layers: [], cameraLocked: true },
      }),
    ];
    const unlockedNodes: PrismNode[] = [makeNode('n1', 'product-mesh', 'content')];

    const a = compileHubToPreview(hub, lockedNodes, makeWorld());
    const b = compileHubToPreview(hub, unlockedNodes, makeWorld());

    expect(a.hash).not.toBe(b.hash);
  });

  it('SC-029: the returned view (and every nested anchor + node entry) is frozen', () => {
    const hub = makeHub();
    const nodes: PrismNode[] = [makeNode('n1', 'product-mesh', 'content')];
    const view: CompiledHubView = compileHubToPreview(hub, nodes, makeWorld());
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.nodes)).toBe(true);
    for (const entry of view.nodes) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.anchor)).toBe(true);
    }
  });

  it('FP-04: compiled-view.ts source contains no destructive position writes', () => {
    // Static check that mirrors the FP-04 hook regex against the compile
    // module's own source. If a future edit introduces a write like
    // `node.scenePosition.x = ...` inside compile*/organize*/previewHub*/
    // previewApp* in this file, this assertion fires before the runtime
    // verification even gets a chance.
    const file = resolve(
      __dirname,
      '..',
      '..',
      'src',
      'lib',
      'prism-graph',
      'compiled-view.ts',
    );
    const source = readFileSync(file, 'utf8');
    // FP-04 regex (multiline-aware): any `.scenePosition|.editorTransform|
    // .canvasTransform|.compiledTransform[.xyz]? =`
    const fp04 = /\.(scenePosition|editorTransform|canvasTransform|compiledTransform)(\.[xyz])?\s*=(?!=)/;
    expect(fp04.test(source)).toBe(false);
  });
});
