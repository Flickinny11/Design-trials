import { describe, it, expect } from 'vitest';
import { smokeRingPrimitive } from '@/lib/prism/animatable/primitives/smoke-ring';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type RingHandles = {
  uTime: Uniform;
  uRise: Uniform;
  uExpand: Uniform;
  uThickness: Uniform;
  uTurb: Uniform;
};

describe('smoke-ring primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokeRingPrimitive).dispose();
  });

  it('plays: time uniform advances and live params drive the ring', () => {
    const target = makeTarget(smokeRingPrimitive);
    const inst = smokeRingPrimitive.create(target);
    const h = target.userData.smokeRing as RingHandles;

    // Looping primitive (duration Infinity) — pick two distinct t values.
    inst.seek(0);
    const t0 = h.uTime.value;

    inst.seek(0.9);
    const tMid = h.uTime.value;

    // The animation clock visibly advances between an early and a later frame.
    expect(t0).toBe(0);
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    // Uniforms that build the rising/expanding ring are populated.
    expect(h.uRise.value).toBeGreaterThan(0);
    expect(h.uExpand.value).toBeGreaterThanOrEqual(0);

    inst.dispose();
  });

  it('controls change output: larger rise feeds a larger rise uniform', () => {
    const target = makeTarget(smokeRingPrimitive);
    const inst = smokeRingPrimitive.create(target);
    const h = target.userData.smokeRing as RingHandles;

    inst.setControl('rise', 0.05);
    inst.seek(0.5);
    const slow = h.uRise.value;

    inst.setControl('rise', 1.5);
    inst.seek(0.5);
    const fast = h.uRise.value;

    expect(fast).toBeGreaterThan(slow + 0.3);
    inst.dispose();
  });
});
