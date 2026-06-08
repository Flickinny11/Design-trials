import { describe, it, expect } from 'vitest';
import { diamondSparklePrimitive } from '@/lib/prism/animatable/primitives/diamond-sparkle';
import { makeTarget, runConformance } from './_conformance';

interface SparkleUniforms {
  uTime: { value: number };
  uRate: { value: number };
  uIntensity: { value: number };
  uDiagonal: { value: number };
}

describe('diamond-sparkle primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(diamondSparklePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(diamondSparklePrimitive);
    const inst = diamondSparklePrimitive.create(target);
    const u = target.userData.diamondSparkle as SparkleUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.5);
    const tMid = u.uTime.value;

    inst.seek(3.0);
    const tLate = u.uTime.value;

    // A purely stateful looping effect: uTime tracks seek and is distinct across
    // an early / mid / late frame (the twinkle phase advances with it).
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    expect(tLate).toBeCloseTo(3.0, 5);

    inst.dispose();
  });

  it('controls change output: intensity knob drives the emissive scale uniform', () => {
    const target = makeTarget(diamondSparklePrimitive);
    const inst = diamondSparklePrimitive.create(target);
    const u = target.userData.diamondSparkle as SparkleUniforms;

    inst.setControl('intensity', 0.2);
    inst.seek(1.0);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(1.0);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 0.5);

    // Structural control: switching point count toggles the diagonal-arm gate.
    inst.setControl('points', '4');
    inst.seek(1.0);
    const fourPt = u.uDiagonal.value;

    inst.setControl('points', '6');
    inst.seek(1.0);
    const sixPt = u.uDiagonal.value;

    expect(fourPt).toBe(0);
    expect(sixPt).toBe(1);

    inst.dispose();
  });
});
