import { describe, it, expect } from 'vitest';
import { pearlescentPrimitive } from '@/lib/prism/animatable/primitives/pearlescent';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type PearlUniforms = {
  uTime: Uniform;
  uDrift: Uniform;
  uRange: Uniform;
  uSheen: Uniform;
};

describe('pearlescent primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pearlescentPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(pearlescentPrimitive);
    const inst = pearlescentPrimitive.create(target);
    const u = target.userData.pearlescent as PearlUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // Looping primitive (duration === Infinity): a mid frame differs from t=0.
    expect(inst.duration()).toBe(Infinity);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: drift extremes set distinct uniform values', () => {
    const target = makeTarget(pearlescentPrimitive);
    const inst = pearlescentPrimitive.create(target);
    const u = target.userData.pearlescent as PearlUniforms;

    inst.setControl('drift', 0);
    inst.seek(1);
    const low = u.uDrift.value;

    inst.setControl('drift', 0.6);
    inst.seek(1);
    const high = u.uDrift.value;

    expect(high).toBeGreaterThan(low + 0.3);

    // sheen control likewise reaches the live uniform.
    inst.setControl('sheen', 0);
    inst.seek(1);
    const sheenLow = u.uSheen.value;
    inst.setControl('sheen', 1);
    inst.seek(1);
    const sheenHigh = u.uSheen.value;
    expect(sheenHigh).toBeGreaterThan(sheenLow + 0.5);

    inst.dispose();
  });
});
