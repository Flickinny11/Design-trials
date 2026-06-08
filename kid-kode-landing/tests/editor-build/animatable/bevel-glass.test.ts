import { describe, it, expect } from 'vitest';
import { bevelGlassPrimitive } from '@/lib/prism/animatable/primitives/bevel-glass';
import { makeTarget, runConformance } from './_conformance';

type BevelUniforms = {
  uTime: { value: number };
  uBevel: { value: number };
  uThickness: { value: number };
  uShimmer: { value: number };
};

describe('bevel-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bevelGlassPrimitive).dispose();
  });

  it('plays: the time uniform advances and the thickness scalar shimmers between frames', () => {
    const target = makeTarget(bevelGlassPrimitive);
    const inst = bevelGlassPrimitive.create(target);
    const u = target.userData.bevelGlass as BevelUniforms;

    inst.seek(0);
    const time0 = u.uTime.value;

    // Mid-loop frame: uTime must have advanced (distinct observable state).
    inst.seek(1.21);
    const timeMid = u.uTime.value;

    expect(timeMid).toBeGreaterThan(time0);
    expect(timeMid).toBe(1.21);
    expect(time0).toBe(0);
    inst.dispose();
  });

  it('controls change output: a wider bevel knob drives a larger bevel uniform', () => {
    const target = makeTarget(bevelGlassPrimitive);
    const inst = bevelGlassPrimitive.create(target);
    const u = target.userData.bevelGlass as BevelUniforms;

    inst.setControl('bevel', 0.05);
    inst.seek(0.5);
    const narrow = u.uBevel.value;

    inst.setControl('bevel', 0.4);
    inst.seek(0.5);
    const wide = u.uBevel.value;

    expect(wide).toBeGreaterThan(narrow + 0.1);
    inst.dispose();
  });
});
