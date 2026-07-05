// EB-08-01 — Additive transform/anchor/layer fields on PrismNode.
//
// Spec refs:
//   §8 SC-041  "`editorTransform?` and `canvasTransform?` optional fields
//               exist on `PrismNode` (additive, INV-18)."
//   §8 INV-18  Additive schema growth: no rename, no delete, no required-field
//              addition to PrismNode/PrismHub/PrismRootNode/GraphSource.
//
// haltCheck (from ralph-state.json EB-08-01):
//   "PrismNode adds optional editorTransform?, canvasTransform?,
//    compiledTransform?, uiAnchor?, scrollBinding?, depthLayer? fields;
//    tsc clean; existing graphs serialize without these fields."
//
// This task adds (or keeps additive) the following six optional fields on
// PrismNode. `canvasTransform?` (EB-05-03) and `scrollBinding?` (EB-07-04)
// already shipped; the four new ones are `editorTransform?`,
// `compiledTransform?`, `uiAnchor?`, and `depthLayer?`.
//
// Field shapes per editor-build-gap-analysis.md §3 schema delta:
//
//   editorTransform   EditorTransform?   position+rotation+scale in
//                                        hub-world mode (mirrors ScenePosition)
//   canvasTransform   CanvasTransform?   intermediate transform in canvas mode
//   compiledTransform CompiledTransform? resolved final pose post-compile
//                                        (cached; non-canonical)
//   uiAnchor          UiAnchor?          source-side anchor abstraction (the
//                                        7-member union from compile-anchors.ts)
//   scrollBinding     ScrollBinding[]?   drives transform from scrollProgress
//   depthLayer        DepthLayer?        layered scene graph layer assignment

import { describe, it, expect, expectTypeOf } from 'vitest';

import type {
  PrismNode,
  ScenePosition,
  CanvasTransform,
  EditorTransform,
  CompiledTransform,
  DepthLayer,
  ScrollBinding,
} from '@/lib/prism-graph/types';
import {
  EDITOR_TRANSFORM_DEFAULT,
  COMPILED_TRANSFORM_DEFAULT,
  DEPTH_LAYER_VALUES,
  DEPTH_LAYER_DEFAULT,
} from '@/lib/prism-graph/types';
import type { UiAnchor } from '@/lib/prism-graph/compile-anchors';

// Helper: build a minimal legal PrismNode without any of the editor-build
// additive fields. If this stops compiling, INV-18 has been violated.
function makeLegacyNode(): PrismNode {
  return {
    nodeId: 'legacy-1',
    subtype: 'button',
    parentHubId: 'hub-home',
    serviceTag: 'sample',
    visual: {
      atlasFrame: 'frame-1',
      caption: '',
      behaviorSpec: { kind: 'static' } as never,
      stateEffects: [],
      visualSpec: { kind: 'static' } as never,
      contracts: { kind: 'static' } as never,
    } as never,
    intent: 'navigation' as never,
    codeRef: 'noop.ts',
    backendRef: null,
  };
}

describe('EB-08-01 — additive transform/anchor/layer fields on PrismNode', () => {
  describe('SC-041: editorTransform? + canvasTransform? exist', () => {
    it('editorTransform is assignable as an EditorTransform (mirrors ScenePosition shape)', () => {
      const pose: EditorTransform = {
        x: 1, y: 2, z: 3,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      };
      const node: PrismNode = { ...makeLegacyNode(), editorTransform: pose };
      expect(node.editorTransform).toEqual(pose);
    });

    it('canvasTransform? remains assignable (EB-05-03 must not regress)', () => {
      const pose: CanvasTransform = {
        x: 0, y: 0, z: 0,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      };
      const node: PrismNode = { ...makeLegacyNode(), canvasTransform: pose };
      expect(node.canvasTransform).toEqual(pose);
    });

    it('EditorTransform mirrors ScenePosition shape (so the hub-world editor can drive every axis)', () => {
      // Compile-time guarantee: the two types share the same 9-key surface.
      expectTypeOf<EditorTransform>().toEqualTypeOf<ScenePosition>();
    });

    it('EDITOR_TRANSFORM_DEFAULT is identity', () => {
      expect(EDITOR_TRANSFORM_DEFAULT).toEqual({
        x: 0, y: 0, z: 0,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      });
    });
  });

  describe('compiledTransform? cache field', () => {
    it('is assignable as CompiledTransform with the same 9-key pose shape', () => {
      const cached: CompiledTransform = {
        x: 5, y: -2, z: 0,
        rotationX: 0, rotationY: Math.PI / 4, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      };
      const node: PrismNode = { ...makeLegacyNode(), compiledTransform: cached };
      expect(node.compiledTransform).toEqual(cached);
    });

    it('COMPILED_TRANSFORM_DEFAULT is identity', () => {
      expect(COMPILED_TRANSFORM_DEFAULT).toEqual({
        x: 0, y: 0, z: 0,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      });
    });
  });

  describe('uiAnchor? — source-side anchor abstraction (SC-031)', () => {
    it('accepts the 7-member UiAnchor union from compile-anchors.ts', () => {
      const anchors: UiAnchor[] = [
        'world', 'viewport', 'scroll', 'hybrid', 'sticky', 'parallax', 'camera-locked',
      ];
      for (const a of anchors) {
        const node: PrismNode = { ...makeLegacyNode(), uiAnchor: a };
        expect(node.uiAnchor).toBe(a);
      }
    });
  });

  describe('scrollBinding? — EB-07-04 must not regress', () => {
    it('accepts an array of ScrollBindings', () => {
      const bindings: ScrollBinding[] = [
        { property: 'translateY', from: 0, to: 100, ease: 'easeInOut' },
      ];
      const node: PrismNode = { ...makeLegacyNode(), scrollBinding: bindings };
      expect(node.scrollBinding).toEqual(bindings);
    });
  });

  describe('depthLayer? — layered scene-graph assignment', () => {
    it('exposes the 6-member DEPTH_LAYER_VALUES set', () => {
      expect([...DEPTH_LAYER_VALUES].sort()).toEqual([
        'background',
        'content',
        'environment',
        'foreground-FX',
        'midground',
        'overlay',
      ]);
    });

    it('DEPTH_LAYER_DEFAULT is content', () => {
      expect(DEPTH_LAYER_DEFAULT).toBe('content');
    });

    it('accepts every DepthLayer value on PrismNode', () => {
      const layers: DepthLayer[] = [
        'environment', 'background', 'midground', 'content', 'foreground-FX', 'overlay',
      ];
      for (const layer of layers) {
        const node: PrismNode = { ...makeLegacyNode(), depthLayer: layer };
        expect(node.depthLayer).toBe(layer);
      }
    });
  });

  describe('INV-18 — additive only', () => {
    it('a legacy PrismNode without any of the 6 fields still type-checks', () => {
      const node = makeLegacyNode();
      // All six fields are optional → undefined on a legacy node.
      expect(node.editorTransform).toBeUndefined();
      expect(node.canvasTransform).toBeUndefined();
      expect(node.compiledTransform).toBeUndefined();
      expect(node.uiAnchor).toBeUndefined();
      expect(node.scrollBinding).toBeUndefined();
      expect(node.depthLayer).toBeUndefined();
    });

    it('serialization round-trip drops undefined fields (legacy graphs serialize unchanged)', () => {
      const legacy = makeLegacyNode();
      const roundTripped = JSON.parse(JSON.stringify(legacy));
      // None of the six additive keys should appear in the JSON.
      expect('editorTransform' in roundTripped).toBe(false);
      expect('canvasTransform' in roundTripped).toBe(false);
      expect('compiledTransform' in roundTripped).toBe(false);
      expect('uiAnchor' in roundTripped).toBe(false);
      expect('scrollBinding' in roundTripped).toBe(false);
      expect('depthLayer' in roundTripped).toBe(false);
    });
  });
});
