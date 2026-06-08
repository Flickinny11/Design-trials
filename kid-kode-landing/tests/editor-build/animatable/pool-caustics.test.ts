import { describe, it, expect } from 'vitest';
import { poolCausticsPrimitive } from '@/lib/prism/animatable/primitives/pool-caustics';
import { makeTarget, runConformance } from './_conformance';

interface PoolUniforms {
  uTime: { value: number };
  uSpeed: { value: number };
  uScale: { value: number };
  uSharp: { value: number };
}

describe('pool-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(poolCausticsPrimitive).dispose();
  });

  it('plays: seek advances the time uniform across the timeline', () => {
    const target = makeTarget(poolCausticsPrimitive);
    const inst = poolCausticsPrimitive.create(target);
    const u = target.userData.poolCaustics as PoolUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.7);
    const tMid = u.uTime.value;

    inst.seek(4.0);
    const tLate = u.uTime.value;

    // distinct frames → the crawling net is advancing, not frozen.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tMid).toBeCloseTo(1.7, 5);
    inst.dispose();
  });

  it('controls change output: sharpness extremes drive distinct uniform values', () => {
    const target = makeTarget(poolCausticsPrimitive);
    const inst = poolCausticsPrimitive.create(target);
    const u = target.userData.poolCaustics as PoolUniforms;

    inst.setControl('sharpness', 1);
    inst.seek(0.5);
    const low = u.uSharp.value;

    inst.setControl('sharpness', 6);
    inst.seek(0.5);
    const high = u.uSharp.value;

    expect(high).toBeGreaterThan(low + 1);

    // scale knob is also live and observable.
    inst.setControl('scale', 3);
    inst.seek(0.5);
    const smallScale = u.uScale.value;
    inst.setControl('scale', 14);
    inst.seek(0.5);
    const bigScale = u.uScale.value;
    expect(bigScale).toBeGreaterThan(smallScale + 5);

    inst.dispose();
  });
});
