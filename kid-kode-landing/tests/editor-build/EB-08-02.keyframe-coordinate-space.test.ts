// EB-08-02 — PrismKeyframe with required coordinateSpace discriminator.
//
// Spec refs:
//   §8 SC-043  "`PrismKeyframe` type has a required `coordinateSpace:
//               'universe' | 'hub-scene' | 'viewport-composition' |
//               'scroll-timeline' | 'camera'` discriminator (INV-21)."
//   §8 INV-21  "Every keyframe declares its `coordinateSpace` from the
//               canonical 5. No keyframe is space-agnostic."
//   §8 FP-08   "Keyframe object literal without `coordinateSpace`."
//   §4         Coordinate systems — five spaces, never collapsed (INV-22).
//   §9 RA-03   The valid keyframe space set is fixed at the §4 five.
//
// haltCheck (from ralph-state.json EB-08-02):
//   "PrismKeyframe has required coordinateSpace ∈ {universe, hub-scene,
//    viewport-composition, scroll-timeline, camera}; tsc fails on any
//    keyframe literal missing the discriminator. Hook FP-08 also fires
//    for runtime-authored cases."

import { describe, it, expect, expectTypeOf } from 'vitest';

import type {
  PrismKeyframe,
  PrismKeyframeCoordinateSpace,
  PrismKeyframeTrigger,
  PrismNode,
} from '@/lib/prism-graph/types';
import {
  KEYFRAME_COORDINATE_SPACES,
  KEYFRAME_TRIGGERS,
} from '@/lib/prism-graph/types';

// Minimal legal PrismNode for embedding keyframes.
function makeLegacyNode(): PrismNode {
  return {
    nodeId: 'kf-host-1',
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

describe('EB-08-02 — PrismKeyframe coordinateSpace discriminator', () => {
  describe('SC-043 / INV-21: KEYFRAME_COORDINATE_SPACES is the canonical 5', () => {
    it('contains exactly the 5 canonical coordinate spaces from §4', () => {
      expect([...KEYFRAME_COORDINATE_SPACES].sort()).toEqual([
        'camera',
        'hub-scene',
        'scroll-timeline',
        'universe',
        'viewport-composition',
      ]);
    });

    it('preserves spec-declared order from §4 (universe first, camera last)', () => {
      expect(KEYFRAME_COORDINATE_SPACES).toEqual([
        'universe',
        'hub-scene',
        'viewport-composition',
        'scroll-timeline',
        'camera',
      ]);
    });

    it('PrismKeyframeCoordinateSpace is the exact 5-member union', () => {
      expectTypeOf<PrismKeyframeCoordinateSpace>().toEqualTypeOf<
        'universe' | 'hub-scene' | 'viewport-composition' | 'scroll-timeline' | 'camera'
      >();
    });
  });

  describe('SC-044: KEYFRAME_TRIGGERS enum exists', () => {
    it('contains exactly the 5 canonical triggers', () => {
      expect([...KEYFRAME_TRIGGERS].sort()).toEqual([
        'click',
        'hover',
        'in-view',
        'load',
        'scroll',
      ]);
    });

    it('PrismKeyframeTrigger is the exact 5-member union', () => {
      expectTypeOf<PrismKeyframeTrigger>().toEqualTypeOf<
        'load' | 'scroll' | 'hover' | 'click' | 'in-view'
      >();
    });
  });

  describe('SC-043: coordinateSpace is REQUIRED on PrismKeyframe', () => {
    it('a keyframe with coordinateSpace type-checks and round-trips', () => {
      const kf: PrismKeyframe = {
        t: 0,
        coordinateSpace: 'hub-scene',
        params: { x: 0, y: 0, opacity: 0 },
      };
      expect(kf.coordinateSpace).toBe('hub-scene');
      expect(kf.t).toBe(0);
    });

    it('accepts every canonical coordinate space', () => {
      for (const space of KEYFRAME_COORDINATE_SPACES) {
        const kf: PrismKeyframe = {
          t: 1,
          coordinateSpace: space,
          params: { opacity: 1 },
        };
        expect(kf.coordinateSpace).toBe(space);
      }
    });

    it('accepts every canonical trigger when present', () => {
      for (const trigger of KEYFRAME_TRIGGERS) {
        const kf: PrismKeyframe = {
          t: 0,
          coordinateSpace: 'hub-scene',
          trigger,
          values: { opacity: 1 },
        };
        expect(kf.trigger).toBe(trigger);
      }
    });

    it('rejects keyframe literals missing coordinateSpace at the type level', () => {
      // @ts-expect-error — coordinateSpace is required (INV-21 / SC-043).
      const bad: PrismKeyframe = { t: 0, params: { x: 1 } };
      expect(bad).toBeDefined();
    });

    it('rejects non-canonical coordinate-space values at the type level', () => {
      // @ts-expect-error — 'world' is not in the canonical 5 (RA-03).
      const bad: PrismKeyframe = { t: 0, coordinateSpace: 'world', params: {} };
      expect(bad).toBeDefined();
    });

    it('rejects non-canonical trigger values at the type level', () => {
      const bad: PrismKeyframe = {
        t: 0,
        coordinateSpace: 'hub-scene',
        // @ts-expect-error — 'tap' is not in the SC-044 enum.
        trigger: 'tap',
        params: {},
      };
      expect(bad).toBeDefined();
    });
  });

  describe('PrismNode.keyframes? accepts PrismKeyframe[] (additive INV-18)', () => {
    it('a legacy node without keyframes still type-checks (additive)', () => {
      const node = makeLegacyNode();
      expect(node.keyframes).toBeUndefined();
    });

    it('a node with a populated keyframes[] type-checks', () => {
      const node: PrismNode = {
        ...makeLegacyNode(),
        keyframes: [
          { t: 0, coordinateSpace: 'hub-scene', params: { opacity: 0 } },
          { t: 1, coordinateSpace: 'hub-scene', params: { opacity: 1 } },
        ],
      };
      expect(node.keyframes).toHaveLength(2);
      expect(node.keyframes?.[0]?.coordinateSpace).toBe('hub-scene');
    });

    it('serialization round-trip drops undefined keyframes (legacy graphs unchanged)', () => {
      const legacy = makeLegacyNode();
      const roundTripped = JSON.parse(JSON.stringify(legacy));
      expect('keyframes' in roundTripped).toBe(false);
    });
  });
});
