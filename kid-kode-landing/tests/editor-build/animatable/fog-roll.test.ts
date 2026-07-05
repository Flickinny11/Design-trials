import { describe, it, expect } from 'vitest';
import { fogRollPrimitive } from '@/lib/prism/animatable/primitives/fog-roll';
import { makeTarget, runConformance } from './_conformance';

type UniformHandles = {
  uTime: { value: number };
  uRoll: { value: number };
  uDensity: { value: number };
  uScale: { value: number };
};

describe('fog-roll primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fogRollPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (looping)', () => {
    const target = makeTarget(fogRollPrimitive);
    const inst = fogRollPrimitive.create(target);
    const u = target.userData.fogRollUniforms as UniformHandles;

    // Looping primitive (duration Infinity) — pick two distinct t values.
    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // The advecting front is driven by uTime; a mid frame differs from t=0.
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: density extremes drive the live uniform', () => {
    const target = makeTarget(fogRollPrimitive);
    const inst = fogRollPrimitive.create(target);
    const u = target.userData.fogRollUniforms as UniformHandles;

    inst.setControl('density', 0);
    inst.seek(1.0);
    const low = u.uDensity.value;

    inst.setControl('density', 0.8);
    inst.seek(1.0);
    const high = u.uDensity.value;

    expect(high).toBeGreaterThan(low + 0.3);

    // roll knob is also live-read on seek.
    inst.setControl('roll', 0.05);
    inst.seek(1.0);
    const slow = u.uRoll.value;
    inst.setControl('roll', 2);
    inst.seek(1.0);
    const fast = u.uRoll.value;
    expect(fast).toBeGreaterThan(slow + 1);

    inst.dispose();
  });
});
