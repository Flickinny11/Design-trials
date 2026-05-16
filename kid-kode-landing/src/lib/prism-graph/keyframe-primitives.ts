// EB-08-04 — Three baseline keyframe primitives (SC-046).
//
// STUB — populated by Step 7 implementation in the same iteration. Created
// here only so the TDD test file (`tests/editor-build/EB-08-04.baseline-keyframe-primitives.test.ts`)
// compiles. Concrete data is intentionally absent so the assertions FAIL at
// commit-time of Step 6 (test-first), per `/ralph-step-editor` rules.

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

export interface InterpolatedKeyframeValues {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  scale?: number;
  rotateZ?: number;
}

export const LOAD_FADE_IN: KeyframePrimitive = {
  id: 'load-fade-in-stub',
  label: 'STUB',
  trigger: 'load',
  keyframes: [],
};

export const IN_VIEW_SLIDE: KeyframePrimitive = {
  id: 'in-view-slide-stub',
  label: 'STUB',
  trigger: 'in-view',
  keyframes: [],
};

export const HOVER_LIFT: KeyframePrimitive = {
  id: 'hover-lift-stub',
  label: 'STUB',
  trigger: 'hover',
  keyframes: [],
};

export const BASELINE_KEYFRAME_PRIMITIVES: readonly KeyframePrimitive[] = [];

export function interpolateKeyframePrimitive(
  _primitive: KeyframePrimitive,
  _t: number,
): InterpolatedKeyframeValues {
  return {};
}
