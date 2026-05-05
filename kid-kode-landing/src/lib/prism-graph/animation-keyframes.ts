// T08 — Animation timeline keyframe model (capture + replay).
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 + §17 L539.
//
// Stub — populated during implementation phase.

export type AnimationTabMode = 'i2v-frame-scrub' | 'timeline-keyframe';

export const ANIMATION_TAB_MODES: readonly AnimationTabMode[] = [];

export interface KeyframeParams {
  scale: number;
  opacity: number;
  rotation: number;
  x: number;
  y: number;
}

export interface Keyframe {
  t: number;
  params: KeyframeParams;
}

export interface KeyframeTimeline {
  durationMs: number;
  keyframes: Keyframe[];
}

export interface CreateKeyframeTimelineOptions {
  durationMs?: number;
}

export function createKeyframeTimeline(_opts: CreateKeyframeTimelineOptions = {}): KeyframeTimeline {
  return { durationMs: 0, keyframes: [] };
}

export function captureKeyframe(_tl: KeyframeTimeline, _t: number, _params: KeyframeParams): KeyframeTimeline {
  return _tl;
}

export function replayKeyframeTimeline(_tl: KeyframeTimeline, _t: number): KeyframeParams {
  return { scale: 0, opacity: 0, rotation: 0, x: 0, y: 0 };
}
