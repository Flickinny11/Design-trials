import { describe, it, expect } from 'vitest';
import { frostedGlassPrimitive } from '@/lib/prism/animatable/primitives/frosted-glass';
import { makeTarget, runConformance } from './_conformance';

type Uni = { value: number };

describe('frosted-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(frostedGlassPrimitive).dispose();
  });

  it('plays: the frost front uFront sweeps across the loop', () => {
    const target = makeTarget(frostedGlassPrimitive);
    const inst = frostedGlassPrimitive.create(target);
    const uFront = target.userData.uFront as Uni;

    // Triangle 0->1->0 over the 4s period at speed 1: t=0 sits at the clear end,
    // t=2 at the fully-frosted peak.
    inst.seek(0);
    const front0 = uFront.value;
    inst.seek(2);
    const frontMid = uFront.value;

    expect(front0).toBeLessThan(0.05); // clear at the start
    expect(frontMid).toBeGreaterThan(front0 + 0.3); // crept toward frosted
    inst.dispose();
  });

  it('controls change output: frostiness sets the frosted-band roughness uniform', () => {
    const target = makeTarget(frostedGlassPrimitive);
    const inst = frostedGlassPrimitive.create(target);
    const uFrost = target.userData.uFrostiness as Uni;

    inst.setControl('frostiness', 0.2);
    inst.seek(1);
    const low = uFrost.value;

    inst.setControl('frostiness', 1);
    inst.seek(1);
    const high = uFrost.value;

    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });
});
