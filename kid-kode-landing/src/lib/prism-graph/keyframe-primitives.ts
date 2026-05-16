// EB-08-04 / §6 SC-046 — Three baseline keyframe primitives.
//
// SC-046 (verbatim): "At minimum 3 keyframe primitives ship with this phase:
// a `load` fade-in, an `in-view` slide, a `hover` lift."
//
// Each primitive is a **composable keyframe set** (PrismKeyframe[]) — pure
// data + a single pure interpolator. The Phase 8 demo node consumes these in
// canvas mode; the Phase 9 animation library will compose more from the same
// primitive registry.
//
// INV-21 / FP-08: every keyframe declares its `coordinateSpace` from the
// canonical 5 (RA-03). The interpolator returns plain numeric values; mapping
// to renderer state lives in the canvas-mode demo + the runtime appliers
// added by EB-08-05.
//
// INV-18 (additive): this module introduces no breaking change to any
// existing type; it builds on the `PrismKeyframe` / `PrismKeyframeTrigger` /
// `PrismKeyframeCoordinateSpace` types added by EB-08-02 / EB-08-03.

import type {
  PrismKeyframe,
  PrismKeyframeTrigger,
} from './types';

export interface KeyframePrimitive {
  id: string;
  label: string;
  trigger: PrismKeyframeTrigger;
  keyframes: PrismKeyframe[];
}

// Numeric-only value surface returned by the interpolator. The exact keys
// present on any given call depend on which params are authored on the
// bracketing keyframes; absent keys mean "no change vs. identity".
export interface InterpolatedKeyframeValues {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  scale?: number;
  rotateZ?: number;
}

// ---------------------------------------------------------------------------
// `load` fade-in — opacity 0 → 1 in the hub-scene (the active hub's local
// 3D scene where the demo node lives in canvas mode).
// ---------------------------------------------------------------------------
export const LOAD_FADE_IN: KeyframePrimitive = {
  id: 'load-fade-in',
  label: 'Load fade-in',
  trigger: 'load',
  keyframes: [
    {
      coordinateSpace: 'hub-scene',
      t: 0,
      params: { opacity: 0 },
      ease: 'easeOut',
    },
    {
      coordinateSpace: 'hub-scene',
      t: 1,
      params: { opacity: 1 },
    },
  ],
};

// ---------------------------------------------------------------------------
// `in-view` slide — translateY drops from +0.5 to 0 as the node enters the
// viewport. Authored in `viewport-composition` (the 2D-feeling app UI space)
// because in-view detection runs against the composed viewport.
// ---------------------------------------------------------------------------
export const IN_VIEW_SLIDE: KeyframePrimitive = {
  id: 'in-view-slide',
  label: 'In-view slide',
  trigger: 'in-view',
  keyframes: [
    {
      coordinateSpace: 'viewport-composition',
      t: 0,
      params: { translateY: 0.5, opacity: 0 },
      ease: 'easeOut',
    },
    {
      coordinateSpace: 'viewport-composition',
      t: 1,
      params: { translateY: 0, opacity: 1 },
    },
  ],
};

// ---------------------------------------------------------------------------
// `hover` lift — translateZ rises slightly (toward the camera) on hover.
// Authored in `hub-scene` since hover affordance lives in the 3D hub scene.
// ---------------------------------------------------------------------------
export const HOVER_LIFT: KeyframePrimitive = {
  id: 'hover-lift',
  label: 'Hover lift',
  trigger: 'hover',
  keyframes: [
    {
      coordinateSpace: 'hub-scene',
      t: 0,
      params: { translateZ: 0, scale: 1 },
      ease: 'easeOut',
    },
    {
      coordinateSpace: 'hub-scene',
      t: 1,
      params: { translateZ: 0.15, scale: 1.04 },
    },
  ],
};

export const BASELINE_KEYFRAME_PRIMITIVES: readonly KeyframePrimitive[] = [
  LOAD_FADE_IN,
  IN_VIEW_SLIDE,
  HOVER_LIFT,
];

// Pure interpolator. Walks the (sorted-by-`t`) keyframe list for `primitive`,
// finds the bracketing pair for `t ∈ [0..1]`, and linearly interpolates each
// numeric param. Keys present on either endpoint surface in the output; keys
// absent from both fall through as `undefined`.
//
// The per-keyframe `ease` label is currently decorative: this interpolator
// always lerps. EB-08-05 (Transform-edit ↔ keyframe-capture integration) is
// where the runtime applier wires the ease curves through; declaring them on
// the baseline primitives now keeps the data shape stable.
//
// `params` is the canonical numeric-value bag for new keyframe primitives;
// the `values` fallback in `readNumeric` is kept only for compatibility with
// keyframes authored upstream of this module.
export function interpolateKeyframePrimitive(
  primitive: KeyframePrimitive,
  t: number,
): InterpolatedKeyframeValues {
  const kfs = primitive.keyframes;
  if (kfs.length === 0) return {};
  const clamped = clamp01(t);
  if (kfs.length === 1) return readNumeric(kfs[0]);

  if (clamped <= (kfs[0].t ?? 0)) return readNumeric(kfs[0]);
  if (clamped >= (kfs[kfs.length - 1].t ?? 1)) return readNumeric(kfs[kfs.length - 1]);

  for (let i = 1; i < kfs.length; i += 1) {
    const a = kfs[i - 1];
    const b = kfs[i];
    const at = a.t ?? 0;
    const bt = b.t ?? 1;
    if (clamped >= at && clamped <= bt) {
      const span = bt - at;
      const local = span > 0 ? (clamped - at) / span : 0;
      return lerpValues(readNumeric(a), readNumeric(b), local);
    }
  }
  return readNumeric(kfs[kfs.length - 1]);
}

function readNumeric(kf: PrismKeyframe): InterpolatedKeyframeValues {
  const bag = (kf.params ?? kf.values ?? {}) as Record<string, unknown>;
  const out: InterpolatedKeyframeValues = {};
  for (const key of [
    'opacity',
    'translateX',
    'translateY',
    'translateZ',
    'scale',
    'rotateZ',
  ] as const) {
    const v = bag[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

function lerpValues(
  a: InterpolatedKeyframeValues,
  b: InterpolatedKeyframeValues,
  k: number,
): InterpolatedKeyframeValues {
  const out: InterpolatedKeyframeValues = {};
  for (const key of [
    'opacity',
    'translateX',
    'translateY',
    'translateZ',
    'scale',
    'rotateZ',
  ] as const) {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') {
      out[key] = av + (bv - av) * k;
    } else if (typeof av === 'number') {
      out[key] = av;
    } else if (typeof bv === 'number') {
      out[key] = bv;
    }
  }
  return out;
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}
