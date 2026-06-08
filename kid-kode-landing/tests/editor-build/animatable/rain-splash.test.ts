import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { rainSplashPrimitive } from '@/lib/prism/animatable/primitives/rain-splash';
import { makeTarget, runConformance } from './_conformance';

// Mirror the primitive's geometry layout so the test can read crown points.
const MAX_DROPS = 300;
const CROWN = 6;
const FLOOR_Y = -1.2;
const HIDDEN_Y = FLOOR_Y - 1000;

function pointsOf(target: { object: { children: unknown[] } }): Points {
  const p = (target.object.children as unknown[]).find(
    (c) => (c as { type?: string }).type === 'Points',
  );
  return p as Points;
}

describe('rain-splash primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(rainSplashPrimitive).dispose();
  });

  it('plays: a drop falls between two frames and splash crowns appear at impact', () => {
    const target = makeTarget(rainSplashPrimitive);
    const inst = rainSplashPrimitive.create(target);
    const pts = pointsOf(target as never);
    const pos = pts.geometry.getAttribute('position') as { array: Float32Array };
    const splashBase = MAX_DROPS;

    // Drop 0's height must change between two distinct loop times.
    inst.seek(0.05);
    const y0a = pos.array[0 * 3 + 1];
    inst.seek(0.5);
    const y0b = pos.array[0 * 3 + 1];
    expect(Math.abs(y0a - y0b)).toBeGreaterThan(0.05);

    // Sweep a full fall cycle; at SOME frame a crown point must lift above the
    // floor (splash active), and at SOME frame all crowns sit parked (hidden).
    let sawCrownLift = false;
    let sawCrownParked = false;
    for (let s = 0; s <= 60; s++) {
      const t = (s / 60) * 2; // covers more than one fall cycle
      inst.seek(t);
      // crown for drop 0
      let anyLifted = false;
      let allParked = true;
      for (let k = 0; k < CROWN; k++) {
        const sIdx = splashBase + 0 * CROWN + k;
        const cy = pos.array[sIdx * 3 + 1];
        if (cy > FLOOR_Y + 0.001 && cy < FLOOR_Y + 50) anyLifted = true;
        if (cy > HIDDEN_Y + 1) allParked = false;
      }
      if (anyLifted) sawCrownLift = true;
      if (allParked) sawCrownParked = true;
    }
    expect(sawCrownLift).toBe(true); // splash crowns DO appear
    expect(sawCrownParked).toBe(true); // and are hidden between impacts

    inst.dispose();
  });

  it('controls change output: larger splash means a wider crown spread', () => {
    const target = makeTarget(rainSplashPrimitive);
    const inst = rainSplashPrimitive.create(target);
    const pts = pointsOf(target as never);
    const pos = pts.geometry.getAttribute('position') as { array: Float32Array };
    const splashBase = MAX_DROPS;

    // Find a t where drop 0's crown is active (peak of its impact window).
    // ph = (t*fallSpeed + phaseOffset0) % 1 ; default fallSpeed = 1.1.
    // Scan finely for the max crown horizontal spread under each splash value.
    const maxSpread = (): number => {
      let best = 0;
      for (let s = 0; s <= 200; s++) {
        const t = (s / 200) * 1.0; // within first cycle
        inst.seek(t);
        for (let k = 0; k < CROWN; k++) {
          const sIdx = splashBase + 0 * CROWN + k;
          const cy = pos.array[sIdx * 3 + 1];
          if (cy < HIDDEN_Y + 1) continue; // parked
          const dx = pos.array[sIdx * 3] - pos.array[0 * 3]; // vs drop x at this t
          const dz = pos.array[sIdx * 3 + 2] - pos.array[0 * 3 + 2];
          best = Math.max(best, Math.hypot(dx, dz));
        }
      }
      return best;
    };

    inst.setControl('splash', 0.05);
    const small = maxSpread();

    inst.setControl('splash', 0.8);
    const large = maxSpread();

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
