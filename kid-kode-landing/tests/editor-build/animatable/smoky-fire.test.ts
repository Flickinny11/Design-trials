import { describe, it, expect } from 'vitest';
import { smokyFirePrimitive } from '@/lib/prism/animatable/primitives/smoky-fire';
import { makeTarget, runConformance } from './_conformance';

type Handles = {
  uTime: { value: number };
  uRise: { value: number };
  uSmoke: { value: number };
  uTurb: { value: number };
};

describe('smoky-fire primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokyFirePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(smokyFirePrimitive);
    const inst = smokyFirePrimitive.create(target);
    const h = target.userData.smokyFire as Handles;

    inst.seek(0);
    const t0 = h.uTime.value;

    inst.seek(2.5);
    const tMid = h.uTime.value;

    // Looping/stateful effect — duration is Infinity; assert distinct frames.
    expect(inst.duration()).toBe(Infinity);
    expect(tMid).toBeGreaterThan(t0 + 1);
    inst.dispose();
  });

  it('controls change output: smokeAmount extremes drive the smoke uniform', () => {
    const target = makeTarget(smokyFirePrimitive);
    const inst = smokyFirePrimitive.create(target);
    const h = target.userData.smokyFire as Handles;

    inst.setControl('smokeAmount', 0);
    inst.seek(1);
    const low = h.uSmoke.value;

    inst.setControl('smokeAmount', 1);
    inst.seek(1);
    const high = h.uSmoke.value;

    expect(high).toBeGreaterThan(low + 0.5);
    expect(low).toBeCloseTo(0, 5);
    expect(high).toBeCloseTo(1, 5);
    inst.dispose();
  });
});
