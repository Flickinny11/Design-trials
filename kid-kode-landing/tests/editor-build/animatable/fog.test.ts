import { describe, it, expect } from 'vitest';
import { fogPrimitive } from '@/lib/prism/animatable/primitives/fog';
import { makeTarget, runConformance } from './_conformance';

type FogUniforms = {
  uTime: { value: number };
  uSpeed: { value: number };
  uDensity: { value: number };
  uLayers: { value: number };
};

describe('fog primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fogPrimitive).dispose();
  });

  it('plays: time uniform advances across the timeline', () => {
    const target = makeTarget(fogPrimitive);
    const inst = fogPrimitive.create(target);
    const uniforms = target.userData.fogUniforms as FogUniforms;

    inst.seek(0);
    const t0 = uniforms.uTime.value;

    inst.seek(2.5);
    const tMid = uniforms.uTime.value;

    inst.seek(5);
    const tLate = uniforms.uTime.value;

    // Continuous loop (duration Infinity): the advection clock moves forward,
    // so a mid frame differs from t=0 and from a late frame.
    expect(tMid).toBeGreaterThan(t0 + 0.5);
    expect(tLate).toBeGreaterThan(tMid + 0.5);
    inst.dispose();
  });

  it('controls change output: density extremes drive distinct uniform values', () => {
    const target = makeTarget(fogPrimitive);
    const inst = fogPrimitive.create(target);
    const uniforms = target.userData.fogUniforms as FogUniforms;

    inst.setControl('density', 0.1);
    inst.seek(1);
    const low = uniforms.uDensity.value;

    inst.setControl('density', 2);
    inst.seek(1);
    const high = uniforms.uDensity.value;

    expect(high).toBeGreaterThan(low + 0.5);
    inst.dispose();
  });
});
