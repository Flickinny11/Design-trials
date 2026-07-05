import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { diamondWipePrimitive } from '@/lib/prism/animatable/primitives/diamond-wipe';
import { makeTarget, runConformance } from './_conformance';

// The opacityNode is a TSL smoothstep over a diamond-distance uniform — not
// CPU-observable as pixels (headless has no real GPU). The primitive shares its
// driving uniform handles via target.userData (the contract's sanctioned scratch
// space for uniform handles), exactly as caustics drives a time uniform; we
// observe those .value fields, which seek() advances.
interface DiamondHandles {
  uProgress: { value: number };
  uSoftness: { value: number };
  uSquare: { value: number };
}
function handlesOf(target: ReturnType<typeof makeTarget>): DiamondHandles {
  return target.userData.diamondWipe as DiamondHandles;
}

describe('diamond-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(diamondWipePrimitive).dispose();
  });

  it('plays: the diamond progress uniform advances from ~0 to ~1 across the timeline', () => {
    const target = makeTarget(diamondWipePrimitive);
    const inst = diamondWipePrimitive.create(target);
    // ensure the material was swapped onto the card panel.
    expect((target.subject as Mesh).material).toBeTruthy();
    const h = handlesOf(target);
    const dur = inst.duration();

    inst.seek(0);
    const early = h.uProgress.value;

    inst.seek(dur);
    const late = h.uProgress.value;

    // The diamond reveal front grows: late progress strictly exceeds t=0.
    expect(early).toBeLessThan(0.05);
    expect(late).toBeGreaterThan(early + 0.5);
    inst.dispose();
  });

  it('controls change output: softer front widens the smoothstep band uniform', () => {
    const target = makeTarget(diamondWipePrimitive);
    const inst = diamondWipePrimitive.create(target);
    const h = handlesOf(target);

    // softness is the smoothstep band width (edge0 - edge1 = progress+softness
    // minus progress). Two extremes must drive a visibly different band.
    inst.setControl('softness', 0.01);
    inst.seek(0.0001);
    const bandSmall = h.uSoftness.value;

    inst.setControl('softness', 0.4);
    inst.seek(0.0001);
    const bandLarge = h.uSoftness.value;

    expect(bandLarge).toBeGreaterThan(bandSmall + 0.2);
    inst.dispose();
  });
});
