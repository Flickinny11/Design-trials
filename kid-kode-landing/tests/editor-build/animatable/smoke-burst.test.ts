import { describe, it, expect } from 'vitest';
import { smokeBurstPrimitive } from '@/lib/prism/animatable/primitives/smoke-burst';
import { makeTarget, runConformance } from './_conformance';

type UniformHandle = { value: number };
type SmokeBurstUniforms = {
  uTime: UniformHandle;
  uBurstRate: UniformHandle;
  uTurb: UniformHandle;
  uScale: UniformHandle;
};

describe('smoke-burst primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokeBurstPrimitive).dispose();
  });

  it('plays: the time uniform advances across the looping timeline', () => {
    const target = makeTarget(smokeBurstPrimitive);
    const inst = smokeBurstPrimitive.create(target);
    const u = target.userData.smokeBurst as SmokeBurstUniforms;

    // Looping primitive (duration Infinity) — pick two distinct times.
    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.7);
    const tMid = u.uTime.value;

    // Mid-animation frame differs from t=0: the burst clock has advanced, so the
    // shader's expanding/fading poof is at a visibly different point in its loop.
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: burstRate is reflected live in the uniform', () => {
    const target = makeTarget(smokeBurstPrimitive);
    const inst = smokeBurstPrimitive.create(target);
    const u = target.userData.smokeBurst as SmokeBurstUniforms;

    inst.setControl('burstRate', 0.1);
    inst.seek(1.0);
    const slow = u.uBurstRate.value;

    inst.setControl('burstRate', 2);
    inst.seek(1.0);
    const fast = u.uBurstRate.value;

    // Two extremes produce distinct, observable burst-rate uniform values.
    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
