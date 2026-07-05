import { describe, it, expect } from 'vitest';
import { liquidMetalFlowPrimitive } from '@/lib/prism/animatable/primitives/liquid-metal-flow';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('liquid-metal-flow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquidMetalFlowPrimitive).dispose();
  });

  it('plays: seek advances the flow time uniform (continuous loop)', () => {
    const target = makeTarget(liquidMetalFlowPrimitive);
    const inst = liquidMetalFlowPrimitive.create(target);

    // Continuous/stateful: duration is Infinity, motion observed across t.
    expect(inst.duration()).toBe(Infinity);

    const uTime = target.userData.uTime as Uniform;

    inst.seek(0);
    const t0 = uTime.value;

    inst.seek(1.5);
    const tMid = uTime.value;

    inst.seek(3.2);
    const tLate = uTime.value;

    // The flow clock advances with seek — distinct frames produce distinct
    // shader-time values (the chrome reflection has visibly drifted).
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tLate).toBeGreaterThan(tMid + 0.5);
    expect(t0).toBe(0);

    inst.dispose();
  });

  it('controls change output: contrast extremes drive distinct highlight sharpness', () => {
    const target = makeTarget(liquidMetalFlowPrimitive);
    const inst = liquidMetalFlowPrimitive.create(target);
    const uContrast = target.userData.uContrast as Uniform;

    inst.setControl('contrast', 0.2);
    inst.seek(1.0);
    const low = uContrast.value;

    inst.setControl('contrast', 3);
    inst.seek(1.0);
    const high = uContrast.value;

    expect(high).toBeGreaterThan(low + 1);
    expect(low).toBeCloseTo(0.2, 5);
    expect(high).toBeCloseTo(3, 5);

    inst.dispose();
  });
});
