import { describe, it, expect } from 'vitest';
import { iceGlassPrimitive } from '@/lib/prism/animatable/primitives/ice-glass';
import { makeTarget, runConformance } from './_conformance';

describe('ice-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(iceGlassPrimitive).dispose();
  });

  it('plays: uFrost grows from 0 at t=0 to a higher value mid-loop', () => {
    const target = makeTarget(iceGlassPrimitive);
    const inst = iceGlassPrimitive.create(target);

    inst.seek(0);
    const uFrost = target.userData.uFrost as { value: number };
    const frost0 = uFrost.value;

    // PERIOD is 4s; mid-loop (t=2) is the peak of the 0->1->0 frost triangle.
    inst.seek(2);
    const frostMid = uFrost.value;

    // settled end of the loop returns toward clear.
    inst.seek(4);
    const frostEnd = uFrost.value;

    // frost creeps in: mid frame is frostier than the start...
    expect(frostMid).toBeGreaterThan(frost0 + 0.2);
    // ...and differs from the settled end (thaws back down).
    expect(frostMid).toBeGreaterThan(frostEnd + 0.2);
    inst.dispose();
  });

  it('controls change output: larger frost means a frostier mid-loop value', () => {
    const target = makeTarget(iceGlassPrimitive);
    const inst = iceGlassPrimitive.create(target);
    const uFrost = target.userData.uFrost as { value: number };

    inst.setControl('frost', 0.2);
    inst.seek(2);
    const low = uFrost.value;

    inst.setControl('frost', 1.0);
    inst.seek(2);
    const high = uFrost.value;

    expect(high).toBeGreaterThan(low + 0.3);
    inst.dispose();
  });
});
