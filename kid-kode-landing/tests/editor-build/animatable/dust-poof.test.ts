import { describe, it, expect } from 'vitest';
import { dustPoofPrimitive } from '@/lib/prism/animatable/primitives/dust-poof';
import { makeTarget, runConformance } from './_conformance';

describe('dust-poof primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dustPoofPrimitive).dispose();
  });

  it('plays: seek advances the time uniform across the loop', () => {
    const target = makeTarget(dustPoofPrimitive);
    const inst = dustPoofPrimitive.create(target);
    const uTime = target.userData.uTime as { value: number };

    inst.seek(0);
    const t0 = uTime.value;

    // Two distinct points in the looping timeline produce distinct clock values.
    inst.seek(0.4);
    const tMid = uTime.value;

    inst.seek(1.3);
    const tLate = uTime.value;

    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    // Infinite/looping primitive.
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('controls change output: density extremes drive the density uniform', () => {
    const target = makeTarget(dustPoofPrimitive);
    const inst = dustPoofPrimitive.create(target);
    const uDensity = target.userData.uDensity as { value: number };

    inst.setControl('density', 0);
    inst.seek(0.5);
    const low = uDensity.value;

    inst.setControl('density', 2);
    inst.seek(0.5);
    const high = uDensity.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
