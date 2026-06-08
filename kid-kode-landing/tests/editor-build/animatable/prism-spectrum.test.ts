import { describe, it, expect } from 'vitest';
import { prismSpectrumPrimitive } from '@/lib/prism/animatable/primitives/prism-spectrum';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
interface SpectrumUniforms {
  uTime: Uniform;
  uSpeed: Uniform;
  uBands: Uniform;
  uIntensity: Uniform;
}

function uniforms(target: { userData: Record<string, unknown> }): SpectrumUniforms {
  return target.userData.prismSpectrumUniforms as SpectrumUniforms;
}

describe('prism-spectrum primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(prismSpectrumPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline (looping)', () => {
    const target = makeTarget(prismSpectrumPrimitive);
    const inst = prismSpectrumPrimitive.create(target);
    const u = uniforms(target);

    inst.seek(0);
    const early = u.uTime.value;

    inst.seek(1.5);
    const mid = u.uTime.value;

    inst.seek(3.0);
    const late = u.uTime.value;

    // Continuous spectral march: the driving time uniform keeps advancing.
    expect(mid).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(mid);
    // Purely stateful / looping primitive.
    expect(inst.duration()).toBe(Infinity);
    inst.dispose();
  });

  it('controls change output: speed extremes route through to the speed uniform', () => {
    const target = makeTarget(prismSpectrumPrimitive);
    const inst = prismSpectrumPrimitive.create(target);
    const u = uniforms(target);

    inst.setControl('speed', 0);
    inst.seek(1.0);
    const slow = u.uSpeed.value;

    inst.setControl('speed', 4);
    inst.seek(1.0);
    const fast = u.uSpeed.value;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
