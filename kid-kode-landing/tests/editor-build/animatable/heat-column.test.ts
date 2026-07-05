import { describe, it, expect } from 'vitest';
import { heatColumnPrimitive } from '@/lib/prism/animatable/primitives/heat-column';
import { makeTarget, runConformance } from './_conformance';

type HeatUniforms = {
  uTime: { value: number };
  uRise: { value: number };
  uWobble: { value: number };
  uIntensity: { value: number };
};

describe('heat-column primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(heatColumnPrimitive).dispose();
  });

  it('plays: seek advances the time uniform across the timeline', () => {
    const target = makeTarget(heatColumnPrimitive);
    const inst = heatColumnPrimitive.create(target);
    const u = target.userData.heatColumnUniforms as HeatUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(6);
    const tEnd = u.uTime.value;

    // Continuous looping advection: a mid frame differs from t=0 and from a
    // later frame — the rising-heat field is genuinely time-evolving.
    expect(tMid).toBeGreaterThan(t0);
    expect(tEnd).toBeGreaterThan(tMid);

    // Looping primitive reports Infinity duration.
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('controls change output: wobble extremes drive the live uniform', () => {
    const target = makeTarget(heatColumnPrimitive);
    const inst = heatColumnPrimitive.create(target);
    const u = target.userData.heatColumnUniforms as HeatUniforms;

    inst.setControl('wobble', 0);
    inst.seek(1);
    const low = u.uWobble.value;

    inst.setControl('wobble', 0.1);
    inst.seek(1);
    const high = u.uWobble.value;

    expect(high).toBeGreaterThan(low + 0.05);

    // Intensity is also live-readable on the next seek.
    inst.setControl('intensity', 0);
    inst.seek(1);
    const dim = u.uIntensity.value;
    inst.setControl('intensity', 2);
    inst.seek(1);
    const bright = u.uIntensity.value;
    expect(bright).toBeGreaterThan(dim + 1);

    inst.dispose();
  });
});
