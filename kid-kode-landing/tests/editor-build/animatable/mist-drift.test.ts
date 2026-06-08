import { describe, it, expect } from 'vitest';
import { mistDriftPrimitive } from '@/lib/prism/animatable/primitives/mist-drift';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uDrift: { value: number };
  uDensity: { value: number };
  uScale: { value: number };
};

describe('mist-drift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(mistDriftPrimitive).dispose();
  });

  it('plays: the time uniform advances with seek (continuous loop)', () => {
    const target = makeTarget(mistDriftPrimitive);
    const inst = mistDriftPrimitive.create(target);
    const u = target.userData.mistDriftUniforms as Uniforms;

    // Continuous/stateful effect -> Infinity duration.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // A mid frame differs from t=0: the haze field is advected by uTime.
    expect(tMid).toBeGreaterThan(t0);
    expect(tMid).toBeCloseTo(2.5, 5);
    inst.dispose();
  });

  it('controls change output: density extremes drive different uniform values', () => {
    const target = makeTarget(mistDriftPrimitive);
    const inst = mistDriftPrimitive.create(target);
    const u = target.userData.mistDriftUniforms as Uniforms;

    inst.setControl('density', 0);
    inst.seek(1);
    const low = u.uDensity.value;

    inst.setControl('density', 0.5);
    inst.seek(1);
    const high = u.uDensity.value;

    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });
});
