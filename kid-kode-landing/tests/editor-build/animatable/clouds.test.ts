import { describe, it, expect } from 'vitest';
import { cloudsPrimitive } from '@/lib/prism/animatable/primitives/clouds';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('clouds primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cloudsPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(cloudsPrimitive);
    const inst = cloudsPrimitive.create(target);

    inst.seek(0);
    const uTime = target.userData.uTime as Uniform;
    const t0 = uTime.value;

    inst.seek(2.5);
    const tMid = uTime.value;

    inst.seek(5);
    const tEnd = uTime.value;

    // mid frame differs from start AND from the late frame — visible drift.
    expect(tMid).toBeGreaterThan(t0);
    expect(tEnd).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: coverage extremes drive the threshold uniform', () => {
    const target = makeTarget(cloudsPrimitive);
    const inst = cloudsPrimitive.create(target);
    const uCoverage = target.userData.uCoverage as Uniform;

    inst.setControl('coverage', 0.0);
    inst.seek(1);
    const low = uCoverage.value;

    inst.setControl('coverage', 0.95);
    inst.seek(1);
    const high = uCoverage.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
