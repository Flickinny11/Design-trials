import { describe, it, expect } from 'vitest';
import { plasmaPrimitive } from '@/lib/prism/animatable/primitives/plasma';
import { makeTarget, runConformance } from './_conformance';

type PlasmaUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uScale: { value: number };
  uSat: { value: number };
};

describe('plasma primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(plasmaPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(plasmaPrimitive);
    const inst = plasmaPrimitive.create(target);
    const u = target.userData.plasma as PlasmaUniforms;

    inst.seek(0);
    const t0 = u.uTime.value;

    inst.seek(1.5);
    const tMid = u.uTime.value;

    inst.seek(3.0);
    const tLate = u.uTime.value;

    // Looping effect: a mid frame differs from t=0 and from a later frame.
    expect(tMid).toBeGreaterThan(t0);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: saturation extremes drive different uniform values', () => {
    const target = makeTarget(plasmaPrimitive);
    const inst = plasmaPrimitive.create(target);
    const u = target.userData.plasma as PlasmaUniforms;

    inst.setControl('saturation', 0);
    inst.seek(0.5);
    const low = u.uSat.value;

    inst.setControl('saturation', 1);
    inst.seek(0.5);
    const high = u.uSat.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
