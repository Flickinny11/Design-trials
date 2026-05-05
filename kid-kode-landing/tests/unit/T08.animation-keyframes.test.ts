// T08 unit — Animation timeline keyframe capture and replay.
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §13 L479 — '"save as keyframe" snapshots
//     current parameter state'.
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L539 (DoD #9) — "The Animation tab
//     keyframe timeline successfully captures and replays parameter snapshots".
//
// halt-check (ralph-state.json T08): "Animation tab supports both i2v
// frame-scrub and timeline-keyframe modes. Timeline keyframes render."

import { describe, expect, it } from 'vitest';
import {
  ANIMATION_TAB_MODES,
  captureKeyframe,
  createKeyframeTimeline,
  replayKeyframeTimeline,
  type AnimationTabMode,
  type KeyframeParams,
  type KeyframeTimeline,
} from '@/lib/prism-graph/animation-keyframes';

const SAMPLE_PARAMS: KeyframeParams = {
  scale: 1.4,
  opacity: 0.8,
  rotation: 30,
  x: 12,
  y: -4,
};

describe('T08 ANIMATION_TAB_MODES', () => {
  it('declares both i2v frame-scrub and timeline-keyframe modes (§13 L479)', () => {
    expect(ANIMATION_TAB_MODES).toContain<AnimationTabMode>('i2v-frame-scrub');
    expect(ANIMATION_TAB_MODES).toContain<AnimationTabMode>('timeline-keyframe');
  });

  it('is a tuple of exactly the two modes (no extras)', () => {
    expect(ANIMATION_TAB_MODES.length).toBe(2);
  });
});

describe('T08 createKeyframeTimeline', () => {
  it('starts with zero keyframes', () => {
    const tl = createKeyframeTimeline();
    expect(tl.keyframes.length).toBe(0);
  });

  it('has a positive default duration in milliseconds', () => {
    const tl = createKeyframeTimeline();
    expect(tl.durationMs).toBeGreaterThan(0);
  });

  it('honours an explicit durationMs override', () => {
    const tl = createKeyframeTimeline({ durationMs: 2_500 });
    expect(tl.durationMs).toBe(2_500);
  });
});

describe('T08 captureKeyframe (DoD §17 L539: "captures … parameter snapshots")', () => {
  it('appends a keyframe at the requested time t∈[0,1]', () => {
    const tl0 = createKeyframeTimeline();
    const tl1 = captureKeyframe(tl0, 0.25, SAMPLE_PARAMS);
    expect(tl1.keyframes.length).toBe(1);
    expect(tl1.keyframes[0].t).toBe(0.25);
  });

  it('snapshots a defensive copy — mutating the source params after capture does not affect the timeline', () => {
    const tl0 = createKeyframeTimeline();
    const params: KeyframeParams = { ...SAMPLE_PARAMS };
    const tl1 = captureKeyframe(tl0, 0, params);
    params.scale = 99;
    expect(tl1.keyframes[0].params.scale).toBe(SAMPLE_PARAMS.scale);
  });

  it('does not mutate the source timeline (returns a new instance)', () => {
    const tl0 = createKeyframeTimeline();
    const tl1 = captureKeyframe(tl0, 0.5, SAMPLE_PARAMS);
    expect(tl0.keyframes.length).toBe(0);
    expect(tl1).not.toBe(tl0);
  });

  it('keeps keyframes sorted by t', () => {
    let tl = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0.7, SAMPLE_PARAMS);
    tl = captureKeyframe(tl, 0.2, SAMPLE_PARAMS);
    tl = captureKeyframe(tl, 0.5, SAMPLE_PARAMS);
    const ts = tl.keyframes.map((k) => k.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
  });

  it('clamps t into [0, 1]', () => {
    let tl = createKeyframeTimeline();
    tl = captureKeyframe(tl, -0.5, SAMPLE_PARAMS);
    tl = captureKeyframe(tl, 1.5, SAMPLE_PARAMS);
    expect(tl.keyframes[0].t).toBe(0);
    expect(tl.keyframes[1].t).toBe(1);
  });
});

describe('T08 replayKeyframeTimeline (DoD §17 L539: "replays … parameter snapshots")', () => {
  it('returns the first keyframe params verbatim at t=0', () => {
    let tl: KeyframeTimeline = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0, { scale: 1, opacity: 1, rotation: 0, x: 0, y: 0 });
    tl = captureKeyframe(tl, 1, { scale: 2, opacity: 0, rotation: 90, x: 50, y: 50 });
    const params = replayKeyframeTimeline(tl, 0);
    expect(params.scale).toBe(1);
    expect(params.opacity).toBe(1);
  });

  it('returns the last keyframe params verbatim at t=1', () => {
    let tl: KeyframeTimeline = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0, { scale: 1, opacity: 1, rotation: 0, x: 0, y: 0 });
    tl = captureKeyframe(tl, 1, { scale: 2, opacity: 0, rotation: 90, x: 50, y: 50 });
    const params = replayKeyframeTimeline(tl, 1);
    expect(params.scale).toBe(2);
    expect(params.opacity).toBe(0);
  });

  it('linearly interpolates numeric params at t=0.5 between two keyframes', () => {
    let tl: KeyframeTimeline = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0, { scale: 1, opacity: 1, rotation: 0, x: 0, y: 0 });
    tl = captureKeyframe(tl, 1, { scale: 2, opacity: 0, rotation: 90, x: 50, y: 50 });
    const params = replayKeyframeTimeline(tl, 0.5);
    expect(params.scale).toBeCloseTo(1.5, 6);
    expect(params.opacity).toBeCloseTo(0.5, 6);
    expect(params.rotation).toBeCloseTo(45, 6);
    expect(params.x).toBeCloseTo(25, 6);
    expect(params.y).toBeCloseTo(25, 6);
  });

  it('returns identity-defaults on an empty timeline', () => {
    const tl = createKeyframeTimeline();
    const params = replayKeyframeTimeline(tl, 0.5);
    expect(params.scale).toBe(1);
    expect(params.opacity).toBe(1);
    expect(params.rotation).toBe(0);
    expect(params.x).toBe(0);
    expect(params.y).toBe(0);
  });

  it('clamps replay t into [0, 1]', () => {
    let tl: KeyframeTimeline = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0, { scale: 1, opacity: 1, rotation: 0, x: 0, y: 0 });
    tl = captureKeyframe(tl, 1, { scale: 9, opacity: 0, rotation: 90, x: 50, y: 50 });
    const before = replayKeyframeTimeline(tl, -1);
    const after = replayKeyframeTimeline(tl, 5);
    expect(before.scale).toBe(1);
    expect(after.scale).toBe(9);
  });
});

describe('T08 capture + replay round-trip (DoD §17 L539 — parameter-snapshot fidelity)', () => {
  it('a captured snapshot replays its exact params at the same t', () => {
    let tl: KeyframeTimeline = createKeyframeTimeline();
    tl = captureKeyframe(tl, 0.4, SAMPLE_PARAMS);
    const replayed = replayKeyframeTimeline(tl, 0.4);
    expect(replayed.scale).toBeCloseTo(SAMPLE_PARAMS.scale, 6);
    expect(replayed.opacity).toBeCloseTo(SAMPLE_PARAMS.opacity, 6);
    expect(replayed.rotation).toBeCloseTo(SAMPLE_PARAMS.rotation, 6);
    expect(replayed.x).toBeCloseTo(SAMPLE_PARAMS.x, 6);
    expect(replayed.y).toBeCloseTo(SAMPLE_PARAMS.y, 6);
  });
});
