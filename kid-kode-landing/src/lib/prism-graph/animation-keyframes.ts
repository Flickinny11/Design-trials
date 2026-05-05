// T08 — Animation timeline keyframe model (capture + replay).
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 — '"save as keyframe"
//     snapshots current parameter state.'
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L539 (DoD #9) — "The Animation
//     tab keyframe timeline successfully captures and replays parameter
//     snapshots."
//
// Pure-logic surface — the editor's Animation tab composes this with React
// state + a GSAP-style track widget.

export type AnimationTabMode = 'i2v-frame-scrub' | 'timeline-keyframe';

export const ANIMATION_TAB_MODES: readonly AnimationTabMode[] = [
  'i2v-frame-scrub',
  'timeline-keyframe',
];

export interface KeyframeParams {
  scale: number;
  opacity: number;
  rotation: number;
  x: number;
  y: number;
}

export interface Keyframe {
  /** Normalized time in [0, 1] */
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

const DEFAULT_DURATION_MS = 1_500;

const IDENTITY_PARAMS: KeyframeParams = Object.freeze({
  scale: 1,
  opacity: 1,
  rotation: 0,
  x: 0,
  y: 0,
});

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function createKeyframeTimeline(opts: CreateKeyframeTimelineOptions = {}): KeyframeTimeline {
  const durationMs = typeof opts.durationMs === 'number' && opts.durationMs > 0
    ? opts.durationMs
    : DEFAULT_DURATION_MS;
  return { durationMs, keyframes: [] };
}

export function captureKeyframe(
  tl: KeyframeTimeline,
  t: number,
  params: KeyframeParams,
): KeyframeTimeline {
  const clamped = clamp01(t);
  const next: Keyframe = {
    t: clamped,
    params: {
      scale: params.scale,
      opacity: params.opacity,
      rotation: params.rotation,
      x: params.x,
      y: params.y,
    },
  };
  const merged = [...tl.keyframes, next].sort((a, b) => a.t - b.t);
  return {
    durationMs: tl.durationMs,
    keyframes: merged,
  };
}

export function replayKeyframeTimeline(tl: KeyframeTimeline, t: number): KeyframeParams {
  const ks = tl.keyframes;
  if (ks.length === 0) return { ...IDENTITY_PARAMS };
  const clamped = clamp01(t);
  if (ks.length === 1) return { ...ks[0].params };

  if (clamped <= ks[0].t) return { ...ks[0].params };
  if (clamped >= ks[ks.length - 1].t) return { ...ks[ks.length - 1].params };

  // Find bracketing keyframes.
  for (let i = 1; i < ks.length; i += 1) {
    const a = ks[i - 1];
    const b = ks[i];
    if (clamped >= a.t && clamped <= b.t) {
      const span = b.t - a.t;
      const local = span > 0 ? (clamped - a.t) / span : 0;
      return {
        scale: lerp(a.params.scale, b.params.scale, local),
        opacity: lerp(a.params.opacity, b.params.opacity, local),
        rotation: lerp(a.params.rotation, b.params.rotation, local),
        x: lerp(a.params.x, b.params.x, local),
        y: lerp(a.params.y, b.params.y, local),
      };
    }
  }
  return { ...ks[ks.length - 1].params };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
