import { describe, it, expect } from 'vitest';
import { magmaCracksPrimitive } from '@/lib/prism/animatable/primitives/magma-cracks';
import { makeTarget, runConformance } from './_conformance';

type Uniforms = {
  uTime: { value: number };
  uScale: { value: number };
  uPulse: { value: number };
  uHeat: { value: number };
};

describe('magma-cracks primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(magmaCracksPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(magmaCracksPrimitive);
    const inst = magmaCracksPrimitive.create(target);
    const u = target.userData.magmaCracks as Uniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.7);
    const tMid = u.uTime.value;

    // A mid-animation frame differs from t=0 (looping; duration is Infinity).
    expect(t0).toBe(0);
    expect(tMid).toBeCloseTo(1.7);
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    inst.dispose();
  });

  it('controls change output: heat extremes drive the heat uniform', () => {
    const target = makeTarget(magmaCracksPrimitive);
    const inst = magmaCracksPrimitive.create(target);
    const u = target.userData.magmaCracks as Uniforms;

    inst.setControl('heat', 0.3);
    inst.seek(0.5);
    const low = u.uHeat.value;

    inst.setControl('heat', 3);
    inst.seek(0.5);
    const high = u.uHeat.value;

    expect(high).toBeGreaterThan(low + 1);
    inst.dispose();
  });
});
