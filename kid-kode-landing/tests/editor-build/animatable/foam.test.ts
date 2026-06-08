import { describe, it, expect } from 'vitest';
import { foamPrimitive } from '@/lib/prism/animatable/primitives/foam';
import { makeTarget, runConformance } from './_conformance';

// The foam look is GPU-driven (TSL colorNode = mix(waterTint, white, foamMask)),
// so headless tests assert on CPU-observable uniform state. The primitive
// publishes its live uniform handles on target.userData.foam (the contract's
// shared scratch space for "uniform handles, etc."), giving concrete .value
// assertions without walking the node graph.
type FoamUniforms = {
  uTime: { value: number };
  uThreshold: { value: number };
  uSpeed: { value: number };
  uScale: { value: number };
};

describe('foam primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(foamPrimitive).dispose();
  });

  it('plays: the drift time uniform advances between early and later frames', () => {
    const target = makeTarget(foamPrimitive);
    const inst = foamPrimitive.create(target);
    const u = (target.userData.foam as FoamUniforms);

    // Looping/stateful primitive: continuous drift over time.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const tEarly = u.uTime.value;

    inst.seek(2.5);
    const tMid = u.uTime.value;

    inst.seek(5.0);
    const tLate = u.uTime.value;

    // Concrete numeric motion: uTime strictly advances across the timeline, so
    // the fbm drift (foam crests) moves between frames.
    expect(tMid).toBeGreaterThan(tEarly);
    expect(tLate).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: density sets the foam threshold (more density -> lower threshold)', () => {
    const target = makeTarget(foamPrimitive);
    const inst = foamPrimitive.create(target);
    const u = (target.userData.foam as FoamUniforms);

    // Low density -> high smoothstep threshold (sparse foam).
    inst.setControl('density', 0);
    inst.seek(1);
    const thresholdLow = u.uThreshold.value;

    // High density -> low threshold (more of the surface reads as foam).
    inst.setControl('density', 1);
    inst.seek(1);
    const thresholdHigh = u.uThreshold.value;

    expect(thresholdLow).toBeGreaterThan(thresholdHigh + 0.5);
    inst.dispose();
  });
});
