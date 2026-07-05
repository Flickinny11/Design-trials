import { describe, it, expect } from 'vitest';
import { dustCloudPrimitive } from '@/lib/prism/animatable/primitives/dust-cloud';
import { makeTarget, runConformance } from './_conformance';

// The primitive exposes its live uniform handles on target.userData (shared
// scratch space, per the AnimatableTarget contract) so we can observe the
// CPU-side animation state — uTime advancing, the density control mapping into
// uDensity — without ever reading rendered pixels (headless has no real GPU).
interface DustUniforms {
  time: { value: number };
  drift: { value: number };
  density: { value: number };
  scale: { value: number };
}

describe('dust-cloud primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(dustCloudPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (loops, duration Infinity)', () => {
    const target = makeTarget(dustCloudPrimitive);
    const inst = dustCloudPrimitive.create(target);
    const u = target.userData.dustCloudUniforms as DustUniforms;

    // Looping/stateful haze — duration is Infinity, so sample two distinct t.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const early = u.time.value;

    inst.seek(2.5);
    const mid = u.time.value;

    // mid-animation frame differs from t=0: the drift clock advanced.
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeCloseTo(2.5, 5);
    inst.dispose();
  });

  it('controls change output: density extremes drive the live density uniform', () => {
    const target = makeTarget(dustCloudPrimitive);
    const inst = dustCloudPrimitive.create(target);
    const u = target.userData.dustCloudUniforms as DustUniforms;

    inst.setControl('density', 0);
    inst.seek(1);
    const low = u.density.value;

    inst.setControl('density', 0.6);
    inst.seek(1);
    const high = u.density.value;

    expect(low).toBeCloseTo(0, 5);
    expect(high).toBeGreaterThan(low + 0.4);
    inst.dispose();
  });
});
