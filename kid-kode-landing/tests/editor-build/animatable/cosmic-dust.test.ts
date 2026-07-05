import { describe, it, expect } from 'vitest';
import { cosmicDustPrimitive } from '@/lib/prism/animatable/primitives/cosmic-dust';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };
type DustHandles = {
  uTime: Uniform;
  uDrift: Uniform;
  uScale: Uniform;
  uStarDensity: Uniform;
};

describe('cosmic-dust primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(cosmicDustPrimitive).dispose();
  });

  it('plays: the time uniform advances across the timeline', () => {
    const target = makeTarget(cosmicDustPrimitive);
    const inst = cosmicDustPrimitive.create(target);
    const handles = target.userData.cosmicDust as DustHandles;

    inst.seek(0);
    const t0 = handles.uTime.value;

    inst.seek(4);
    const tMid = handles.uTime.value;

    inst.seek(8);
    const tEnd = handles.uTime.value;

    // Continuous stateful drift: uTime monotonically advances as we seek.
    expect(tMid).toBeGreaterThan(t0);
    expect(tEnd).toBeGreaterThan(tMid);
    inst.dispose();
  });

  it('controls change output: starDensity drives the live uniform between extremes', () => {
    const target = makeTarget(cosmicDustPrimitive);
    const inst = cosmicDustPrimitive.create(target);
    const handles = target.userData.cosmicDust as DustHandles;

    inst.setControl('starDensity', 0);
    inst.seek(1);
    const low = handles.uStarDensity.value;

    inst.setControl('starDensity', 1);
    inst.seek(1);
    const high = handles.uStarDensity.value;

    expect(high).toBeGreaterThan(low + 0.5);

    // scale knob also drives its uniform live.
    inst.setControl('scale', 1);
    inst.seek(1);
    const smallScale = handles.uScale.value;
    inst.setControl('scale', 8);
    inst.seek(1);
    const bigScale = handles.uScale.value;
    expect(bigScale).toBeGreaterThan(smallScale + 1);

    inst.dispose();
  });
});
