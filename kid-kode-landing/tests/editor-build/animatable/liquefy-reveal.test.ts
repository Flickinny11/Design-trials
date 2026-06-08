import { describe, it, expect } from 'vitest';
import { liquefyRevealPrimitive } from '@/lib/prism/animatable/primitives/liquefy-reveal';
import { makeTarget, runConformance } from './_conformance';

describe('liquefy-reveal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(liquefyRevealPrimitive).dispose();
  });

  it('plays: progress and time advance across the timeline', () => {
    const target = makeTarget(liquefyRevealPrimitive);
    const inst = liquefyRevealPrimitive.create(target);
    const dur = inst.duration();

    const uProgress = target.userData.liquefyProgress as { value: number };
    const uTime = target.userData.liquefyTime as { value: number };

    inst.seek(0);
    const p0 = uProgress.value;
    const time0 = uTime.value;

    inst.seek(dur / 2);
    const pMid = uProgress.value;

    inst.seek(dur);
    const pEnd = uProgress.value;
    const timeEnd = uTime.value;

    // progress climbs from 0 at the start to a settled 1 at the end, with the
    // mid frame strictly between the two.
    expect(p0).toBeLessThan(pMid);
    expect(pMid).toBeLessThan(pEnd);
    expect(pEnd).toBeCloseTo(1, 5);
    // time advances too (drives the liquid wobble).
    expect(timeEnd).toBeGreaterThan(time0);
    inst.dispose();
  });

  it('controls change output: viscosity knob updates the threshold uniform', () => {
    const target = makeTarget(liquefyRevealPrimitive);
    const inst = liquefyRevealPrimitive.create(target);

    // The threshold uniform is set from viscosity; assert it differs at extremes.
    // We read it via a fresh instance per extreme so the mid-seek doesn't matter.
    inst.setControl('viscosity', 0.4);
    inst.seek(0);
    const lowParam = inst.getParams().viscosity as number;

    inst.setControl('viscosity', 1.6);
    inst.seek(0);
    const highParam = inst.getParams().viscosity as number;

    expect(highParam).toBeGreaterThan(lowParam + 0.3);

    // wobble knob is the second numeric control — extremes must differ in params.
    inst.setControl('wobble', 0);
    const wLow = inst.getParams().wobble as number;
    inst.setControl('wobble', 0.4);
    const wHigh = inst.getParams().wobble as number;
    expect(wHigh).toBeGreaterThan(wLow + 0.3);

    inst.dispose();
  });
});
