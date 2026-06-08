import { describe, it, expect } from 'vitest';
import { flowingCausticsPrimitive } from '@/lib/prism/animatable/primitives/flowing-caustics';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uScale: { value: number };
  uStreak: { value: number };
};

describe('flowing-caustics primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(flowingCausticsPrimitive).dispose();
  });

  it('plays: seek advances the flow time uniform so the net streams downstream', () => {
    const target = makeTarget(flowingCausticsPrimitive);
    const inst = flowingCausticsPrimitive.create(target);
    const u = target.userData.flowingCaustics as Uniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    // Time uniform advances → the advected net has streamed to a new position.
    expect(t0).toBeCloseTo(0, 5);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: streak knob sets the live anisotropy uniform', () => {
    const target = makeTarget(flowingCausticsPrimitive);
    const inst = flowingCausticsPrimitive.create(target);
    const u = target.userData.flowingCaustics as Uniforms;

    inst.setControl('streak', 1);
    inst.seek(1);
    const low = u.uStreak.value;

    inst.setControl('streak', 4);
    inst.seek(1);
    const high = u.uStreak.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
