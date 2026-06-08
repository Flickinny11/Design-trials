import { describe, it, expect } from 'vitest';
import { edgeCausticsPrimitive } from '@/lib/prism/animatable/primitives/edge-caustics';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uDensity: { value: number };
  uEdgePow: { value: number };
};

describe('edge-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(edgeCausticsPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (looping/Infinity)', () => {
    const target = makeTarget(edgeCausticsPrimitive);
    const inst = edgeCausticsPrimitive.create(target);
    const u = target.userData.edgeCaustics as Uniforms;

    // Looping primitive: duration is Infinity, so pick two distinct t values.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.3);
    const tMid = u.uTime.value;

    inst.seek(2.7);
    const tLate = u.uTime.value;

    // Time uniform crawls forward => mid frame differs from start AND from late.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: density knob drives the density uniform', () => {
    const target = makeTarget(edgeCausticsPrimitive);
    const inst = edgeCausticsPrimitive.create(target);
    const u = target.userData.edgeCaustics as Uniforms;

    inst.setControl('density', 1);
    inst.seek(0.5);
    const low = u.uDensity.value;

    inst.setControl('density', 14);
    inst.seek(0.5);
    const high = u.uDensity.value;

    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });
});
