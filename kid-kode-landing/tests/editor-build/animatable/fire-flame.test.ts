import { describe, it, expect } from 'vitest';
import { fireFlamePrimitive } from '@/lib/prism/animatable/primitives/fire-flame';
import { makeTarget, runConformance } from './_conformance';

type FireHandles = {
  uTime: { value: number };
  uSpeed: { value: number };
  uHeight: { value: number };
  uTurb: { value: number };
};

describe('fire-flame primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fireFlamePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(fireFlamePrimitive);
    const inst = fireFlamePrimitive.create(target);
    const h = target.userData.fireFlame as FireHandles;

    // Looping/stateful effect — pick two distinct t values.
    inst.seek(0);
    const tEarly = h.uTime.value;

    inst.seek(1.7);
    const tMid = h.uTime.value;

    inst.seek(3.4);
    const tLate = h.uTime.value;

    // The driver clock advances the time uniform; mid differs from early
    // and from late (continuous motion across the loop).
    expect(tMid).toBeGreaterThan(tEarly + 0.5);
    expect(tLate).toBeGreaterThan(tMid + 0.5);
    inst.dispose();
  });

  it('controls change output: speed extremes drive different uniform values', () => {
    const target = makeTarget(fireFlamePrimitive);
    const inst = fireFlamePrimitive.create(target);
    const h = target.userData.fireFlame as FireHandles;

    inst.setControl('speed', 0.1);
    inst.seek(1.0);
    const slow = h.uSpeed.value;

    inst.setControl('speed', 4);
    inst.seek(1.0);
    const fast = h.uSpeed.value;

    expect(fast).toBeGreaterThan(slow + 0.3);

    // height control is also live-observable.
    inst.setControl('height', 0.3);
    inst.seek(1.0);
    const shortH = h.uHeight.value;
    inst.setControl('height', 2);
    inst.seek(1.0);
    const tallH = h.uHeight.value;
    expect(tallH).toBeGreaterThan(shortH + 0.5);

    inst.dispose();
  });
});
