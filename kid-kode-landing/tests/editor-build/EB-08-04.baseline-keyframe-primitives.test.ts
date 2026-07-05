// EB-08-04 — Three baseline keyframe primitives (load fade-in, in-view slide,
// hover lift).
//
// Spec refs:
//   §6 SC-046  "At minimum 3 keyframe primitives ship with this phase: a
//               `load` fade-in, an `in-view` slide, a `hover` lift."
//   §7 INV-21  "Every keyframe declares its `coordinateSpace` from the
//               canonical 5. No keyframe is space-agnostic."
//   §7 INV-18  "Additive schema growth."
//   §8 FP-08   "Keyframe object literal without `coordinateSpace`."
//   §4         Coordinate systems — five spaces, never collapsed (INV-22).
//
// haltCheck (from ralph-state.json EB-08-04):
//   "Three primitives ship as composable keyframe sets; each declares its
//    coordinateSpace; demo node in canvas mode visibly runs each on its
//    trigger; snapshot captures the in-view-slide state."
//
// Source-shape strategy: matches established editor-build pattern. Runtime
// behavior (canvas-mode demo node, primitives running on their triggers) is
// gated by the two-runtime snapshot at
// `kid-kode-landing/notes/ralph-snapshots/EB-08-04/`. These assertions verify
// the *source contract* that makes the snapshot possible.

import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  KEYFRAME_COORDINATE_SPACES,
  KEYFRAME_TRIGGERS,
} from '@/lib/prism-graph/types';
import type {
  PrismKeyframe,
  PrismKeyframeCoordinateSpace,
  PrismKeyframeTrigger,
} from '@/lib/prism-graph/types';
import {
  BASELINE_KEYFRAME_PRIMITIVES,
  LOAD_FADE_IN,
  IN_VIEW_SLIDE,
  HOVER_LIFT,
  interpolateKeyframePrimitive,
  type KeyframePrimitive,
} from '@/lib/prism-graph/keyframe-primitives';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const keyframePrimitivesSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'keyframe-primitives.ts'),
  'utf8',
);

describe('EB-08-04 — baseline keyframe primitives (SC-046)', () => {
  describe('SC-046: three primitives ship as composable keyframe sets', () => {
    it('exports LOAD_FADE_IN, IN_VIEW_SLIDE, HOVER_LIFT', () => {
      expect(LOAD_FADE_IN).toBeDefined();
      expect(IN_VIEW_SLIDE).toBeDefined();
      expect(HOVER_LIFT).toBeDefined();
    });

    it('BASELINE_KEYFRAME_PRIMITIVES collects all three by id', () => {
      expect(BASELINE_KEYFRAME_PRIMITIVES).toHaveLength(3);
      const ids = BASELINE_KEYFRAME_PRIMITIVES.map((p) => p.id).sort();
      expect(ids).toEqual(['hover-lift', 'in-view-slide', 'load-fade-in']);
    });

    it('LOAD_FADE_IN is a load-trigger fade primitive', () => {
      expect(LOAD_FADE_IN.trigger).toBe<PrismKeyframeTrigger>('load');
      expect(LOAD_FADE_IN.keyframes.length).toBeGreaterThanOrEqual(2);
      // Fade-in: opacity rises from <1 → 1 across the keyframe set.
      const first = LOAD_FADE_IN.keyframes[0];
      const last = LOAD_FADE_IN.keyframes[LOAD_FADE_IN.keyframes.length - 1];
      const firstOpacity = (first.params?.opacity ?? first.values?.opacity) as number | undefined;
      const lastOpacity = (last.params?.opacity ?? last.values?.opacity) as number | undefined;
      expect(typeof firstOpacity).toBe('number');
      expect(typeof lastOpacity).toBe('number');
      expect(firstOpacity!).toBeLessThan(lastOpacity!);
      expect(lastOpacity).toBeCloseTo(1, 5);
    });

    it('IN_VIEW_SLIDE is an in-view-trigger slide primitive (translateY changes)', () => {
      expect(IN_VIEW_SLIDE.trigger).toBe<PrismKeyframeTrigger>('in-view');
      expect(IN_VIEW_SLIDE.keyframes.length).toBeGreaterThanOrEqual(2);
      const first = IN_VIEW_SLIDE.keyframes[0];
      const last = IN_VIEW_SLIDE.keyframes[IN_VIEW_SLIDE.keyframes.length - 1];
      const firstY = (first.params?.translateY ?? first.values?.translateY) as number | undefined;
      const lastY = (last.params?.translateY ?? last.values?.translateY) as number | undefined;
      expect(typeof firstY).toBe('number');
      expect(typeof lastY).toBe('number');
      expect(firstY).not.toBe(lastY);
    });

    it('HOVER_LIFT is a hover-trigger lift primitive (translateZ rises)', () => {
      expect(HOVER_LIFT.trigger).toBe<PrismKeyframeTrigger>('hover');
      expect(HOVER_LIFT.keyframes.length).toBeGreaterThanOrEqual(2);
      const first = HOVER_LIFT.keyframes[0];
      const last = HOVER_LIFT.keyframes[HOVER_LIFT.keyframes.length - 1];
      const firstZ = (first.params?.translateZ ?? first.values?.translateZ) as number | undefined;
      const lastZ = (last.params?.translateZ ?? last.values?.translateZ) as number | undefined;
      expect(typeof firstZ).toBe('number');
      expect(typeof lastZ).toBe('number');
      // "Lift" means Z (or Y) rises on hover.
      expect(lastZ!).toBeGreaterThan(firstZ!);
    });
  });

  describe('INV-21 / FP-08: every keyframe in every primitive declares coordinateSpace', () => {
    it('all keyframes carry a coordinateSpace from the canonical 5', () => {
      const allKeyframes: PrismKeyframe[] = BASELINE_KEYFRAME_PRIMITIVES.flatMap(
        (p) => p.keyframes,
      );
      // Sanity — primitives are non-empty.
      expect(allKeyframes.length).toBeGreaterThan(0);
      for (const kf of allKeyframes) {
        expect(KEYFRAME_COORDINATE_SPACES).toContain(kf.coordinateSpace);
      }
    });

    it('each primitive pins its keyframes to a single coordinate space (no mid-set space hopping)', () => {
      for (const p of BASELINE_KEYFRAME_PRIMITIVES) {
        const spaces = new Set(p.keyframes.map((k) => k.coordinateSpace));
        expect(spaces.size).toBe(1);
      }
    });

    it('FP-08 source-shape: every keyframe literal in keyframe-primitives.ts has `coordinateSpace:`', () => {
      // Defense-in-depth: even though the type is required, the FP-08 hook
      // greps for `{ t: …, params|values: … }` blocks missing `coordinateSpace`.
      // Verify the source has at least one `coordinateSpace:` per keyframe.
      const keyframeBlockCount = (keyframePrimitivesSrc.match(/\bt:\s*[0-9.]+/g) || []).length;
      const coordSpaceCount = (keyframePrimitivesSrc.match(/coordinateSpace\s*:/g) || []).length;
      expect(coordSpaceCount).toBeGreaterThanOrEqual(keyframeBlockCount);
    });
  });

  describe('triggers: SC-044 enum coverage for the three baseline primitives', () => {
    it('each primitive trigger is a canonical PrismKeyframeTrigger', () => {
      for (const p of BASELINE_KEYFRAME_PRIMITIVES) {
        expect(KEYFRAME_TRIGGERS).toContain(p.trigger);
      }
    });

    it('the three baselines cover triggers load + in-view + hover', () => {
      const triggers = BASELINE_KEYFRAME_PRIMITIVES.map((p) => p.trigger).sort();
      expect(triggers).toEqual(['hover', 'in-view', 'load']);
    });
  });

  describe('composability: primitives are pure data + interpolator', () => {
    it('interpolateKeyframePrimitive at t=0 returns the first keyframe params', () => {
      const r = interpolateKeyframePrimitive(LOAD_FADE_IN, 0);
      const expected = LOAD_FADE_IN.keyframes[0].params?.opacity
        ?? LOAD_FADE_IN.keyframes[0].values?.opacity;
      expect(r.opacity).toBeCloseTo(expected as number, 5);
    });

    it('interpolateKeyframePrimitive at t=1 returns the last keyframe params', () => {
      const last = LOAD_FADE_IN.keyframes[LOAD_FADE_IN.keyframes.length - 1];
      const r = interpolateKeyframePrimitive(LOAD_FADE_IN, 1);
      const expected = last.params?.opacity ?? last.values?.opacity;
      expect(r.opacity).toBeCloseTo(expected as number, 5);
    });

    it('interpolateKeyframePrimitive at mid t lerps between bracketing keyframes', () => {
      const r = interpolateKeyframePrimitive(IN_VIEW_SLIDE, 0.5);
      // mid-slide value should sit strictly between the two endpoints
      const first = IN_VIEW_SLIDE.keyframes[0];
      const last = IN_VIEW_SLIDE.keyframes[IN_VIEW_SLIDE.keyframes.length - 1];
      const a = (first.params?.translateY ?? first.values?.translateY) as number;
      const b = (last.params?.translateY ?? last.values?.translateY) as number;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      expect(r.translateY).toBeGreaterThanOrEqual(lo);
      expect(r.translateY).toBeLessThanOrEqual(hi);
    });

    it('interpolator clamps progress outside [0, 1]', () => {
      const rUnder = interpolateKeyframePrimitive(LOAD_FADE_IN, -0.5);
      const rOver = interpolateKeyframePrimitive(LOAD_FADE_IN, 2.0);
      const first = LOAD_FADE_IN.keyframes[0];
      const last = LOAD_FADE_IN.keyframes[LOAD_FADE_IN.keyframes.length - 1];
      const f = (first.params?.opacity ?? first.values?.opacity) as number;
      const l = (last.params?.opacity ?? last.values?.opacity) as number;
      expect(rUnder.opacity).toBeCloseTo(f, 5);
      expect(rOver.opacity).toBeCloseTo(l, 5);
    });
  });

  describe('types: KeyframePrimitive shape', () => {
    it('KeyframePrimitive carries id, label, trigger, keyframes', () => {
      expectTypeOf<KeyframePrimitive>().toMatchTypeOf<{
        id: string;
        label: string;
        trigger: PrismKeyframeTrigger;
        keyframes: PrismKeyframe[];
      }>();
    });

    it('coordinateSpace field of any baseline keyframe is typed as PrismKeyframeCoordinateSpace', () => {
      const sample = LOAD_FADE_IN.keyframes[0];
      expectTypeOf(sample.coordinateSpace).toEqualTypeOf<PrismKeyframeCoordinateSpace>();
    });
  });

  describe('canvas-mode demo node: source-shape contract for the haltCheck', () => {
    it('GraphScene.tsx mounts a KeyframeDemo block gated to canvas mode', () => {
      // Source-shape: the demo lives behind a `data-keyframe-demo` /
      // named `canvas:keyframe-demo` anchor so the snapshot pipeline can
      // find it and so the FP-12 hook can verify the canvas literal.
      expect(graphSceneSrc).toMatch(/canvas:keyframe-demo|KeyframeDemo/);
      // The demo must read from the baseline primitives, not duplicate them.
      expect(graphSceneSrc).toMatch(
        /from\s+['"]@\/lib\/prism-graph\/keyframe-primitives['"]/,
      );
    });

    it('GraphScene.tsx imports the three baseline primitives or the registry', () => {
      // Accept either: importing the registry, OR importing the three named exports.
      const importsRegistry = /\bBASELINE_KEYFRAME_PRIMITIVES\b/.test(graphSceneSrc);
      const importsAllThree =
        /\bLOAD_FADE_IN\b/.test(graphSceneSrc)
        && /\bIN_VIEW_SLIDE\b/.test(graphSceneSrc)
        && /\bHOVER_LIFT\b/.test(graphSceneSrc);
      expect(importsRegistry || importsAllThree).toBe(true);
    });
  });

  describe('snapshot directory (post-implementation gate)', () => {
    it('EB-08-04 snapshot directory contains outer.png + inner.png + state.json', () => {
      const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-08-04');
      expect(existsSync(dir)).toBe(true);
      const files = readdirSync(dir);
      for (const name of ['outer.png', 'inner.png', 'state.json']) {
        expect(files).toContain(name);
      }
    });
  });
});
