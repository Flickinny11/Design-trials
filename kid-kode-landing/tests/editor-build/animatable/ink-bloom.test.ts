import { describe, it, expect } from 'vitest';
import { inkBloomPrimitive } from '@/lib/prism/animatable/primitives/ink-bloom';
import { makeTarget, runConformance } from './_conformance';

type UniformLike = { value: number };
type InkBloomScratch = {
  uGrow: UniformLike;
  uTime: UniformLike;
  uTurb: UniformLike;
  uScale: UniformLike;
  uFlow: UniformLike;
};

describe('ink-bloom primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(inkBloomPrimitive).dispose();
  });

  it('plays: bloom radius and turbulent clock advance across the timeline', () => {
    const target = makeTarget(inkBloomPrimitive);
    const inst = inkBloomPrimitive.create(target);
    const scratch = target.userData.inkBloom as InkBloomScratch;
    const dur = inst.duration();

    inst.seek(0);
    const grow0 = scratch.uGrow.value;
    const time0 = scratch.uTime.value;

    inst.seek(dur * 0.5);
    const growMid = scratch.uGrow.value;
    const timeMid = scratch.uTime.value;

    // bloom radius grows from ~0 outward, and the unfurl clock advances.
    expect(growMid).toBeGreaterThan(grow0 + 0.1);
    expect(timeMid).toBeGreaterThan(time0);

    inst.seek(dur);
    const growEnd = scratch.uGrow.value;
    // settles toward its max, distinct from the mid frame.
    expect(growEnd).toBeGreaterThan(growMid);
    expect(growEnd).toBeLessThanOrEqual(0.92 + 1e-6);

    inst.dispose();
  });

  it('controls change output: turbulence extremes drive different wobble', () => {
    const target = makeTarget(inkBloomPrimitive);
    const inst = inkBloomPrimitive.create(target);
    const scratch = target.userData.inkBloom as InkBloomScratch;

    inst.setControl('turbulence', 0);
    inst.seek(1);
    const low = scratch.uTurb.value;

    inst.setControl('turbulence', 0.4);
    inst.seek(1);
    const high = scratch.uTurb.value;

    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });
});
