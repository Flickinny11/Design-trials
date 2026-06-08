import { describe, it, expect } from 'vitest';
import { smokePlumePrimitive } from '@/lib/prism/animatable/primitives/smoke-plume';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };
type PlumeUniforms = { uTime: Uni; uRise: Uni; uCurl: Uni; uDensity: Uni };

describe('smoke-plume primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(smokePlumePrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(smokePlumePrimitive);
    const inst = smokePlumePrimitive.create(target);

    // Looping/stateful (duration Infinity) → pick two distinct t values.
    inst.seek(0);
    const t0 = (target.userData.smokePlume as PlumeUniforms).uTime.value;

    inst.seek(2.5);
    const tMid = (target.userData.smokePlume as PlumeUniforms).uTime.value;

    // The plume advection clock must visibly advance.
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(t0).toBe(0);
    inst.dispose();
  });

  it('controls change output: rise knob drives the rise uniform', () => {
    const target = makeTarget(smokePlumePrimitive);
    const inst = smokePlumePrimitive.create(target);
    const uniforms = target.userData.smokePlume as PlumeUniforms;

    inst.setControl('rise', 0.1);
    inst.seek(1);
    const slow = uniforms.uRise.value;

    inst.setControl('rise', 3);
    inst.seek(1);
    const fast = uniforms.uRise.value;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
