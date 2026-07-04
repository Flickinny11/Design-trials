// FINISH F-1 — keyframe scrub evaluator (pure) — the panel's live canvas
// playback interpolates captured canvasTransform snapshots at a normalized
// playhead. Mirrors the panel's lane time-normalization rules.

import { describe, expect, it } from 'vitest';
import { evalScrubPose } from '@/lib/prism-graph/keyframe-scrub';
import type { PrismKeyframe } from '@/lib/prism-graph/types';

const kf = (t: number | undefined, params: Record<string, number>): PrismKeyframe => ({
  coordinateSpace: 'hub-scene',
  ...(typeof t === 'number' ? { t } : {}),
  params,
});

describe('evalScrubPose', () => {
  it('returns an empty pose for no keyframes', () => {
    expect(evalScrubPose([], 0.5)).toEqual({});
  });

  it('holds a single captured pose at every scrub position', () => {
    const keys = [kf(0.4, { translateX: 2, rotateZ: 1, scale: 1.5 })];
    for (const t of [0, 0.4, 1]) {
      const p = evalScrubPose(keys, t);
      expect(p.translateX).toBe(2);
      expect(p.rotateZ).toBe(1);
      // uniform `scale` backfills the per-axis channels
      expect(p.scaleX).toBe(1.5);
      expect(p.scaleY).toBe(1.5);
      expect(p.scaleZ).toBe(1.5);
    }
  });

  it('interpolates between two keys with easeInOutCubic (midpoint = average)', () => {
    const keys = [kf(0, { translateY: 0 }), kf(1, { translateY: 10 })];
    expect(evalScrubPose(keys, 0).translateY).toBe(0);
    expect(evalScrubPose(keys, 1).translateY).toBe(10);
    // easeInOutCubic(0.5) === 0.5 → exact midpoint
    expect(evalScrubPose(keys, 0.5).translateY).toBeCloseTo(5, 10);
    // ease-in shape: the first quarter lags linear
    expect(evalScrubPose(keys, 0.25).translateY!).toBeLessThan(2.5);
  });

  it('holds end values outside the keyed range', () => {
    const keys = [kf(0.25, { opacity: 0.2 }), kf(0.75, { opacity: 1 })];
    expect(evalScrubPose(keys, 0).opacity).toBe(0.2);
    expect(evalScrubPose(keys, 1).opacity).toBe(1);
  });

  it('normalizes absolute-seconds t by the track max (maxT > 1)', () => {
    const keys = [kf(0, { translateX: 0 }), kf(4, { translateX: 8 })];
    // t=4s is the max → normalized 1.0; playhead 0.5 → seconds 2 → midpoint
    expect(evalScrubPose(keys, 0.5).translateX).toBeCloseTo(4, 10);
  });

  it('distributes missing t by index and omits unkeyed channels', () => {
    const keys = [kf(undefined, { rotateZ: 0 }), kf(undefined, { rotateZ: Math.PI })];
    const p = evalScrubPose(keys, 0.5);
    expect(p.rotateZ).toBeCloseTo(Math.PI / 2, 10);
    expect(p.translateX).toBeUndefined();
    expect(p.opacity).toBeUndefined();
  });

  it('explicit per-axis scale wins over uniform scale', () => {
    const keys = [kf(0.5, { scale: 2, scaleX: 3 })];
    const p = evalScrubPose(keys, 0.5);
    expect(p.scaleX).toBe(3);
    expect(p.scaleY).toBe(2);
  });
});
