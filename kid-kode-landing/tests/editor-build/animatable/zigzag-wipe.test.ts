import { describe, it, expect } from 'vitest';
import { zigzagWipePrimitive } from '@/lib/prism/animatable/primitives/zigzag-wipe';
import { makeTarget, runConformance } from './_conformance';

type UniformLike = { value: number };

describe('zigzag-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(zigzagWipePrimitive).dispose();
  });

  it('plays: zigzag reveal progress sweeps from 0 across the card', () => {
    const target = makeTarget(zigzagWipePrimitive);
    const inst = zigzagWipePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const prog0 = (target.userData.wipeProgress as UniformLike).value;

    inst.seek(dur / 2);
    const progMid = (target.userData.wipeProgress as UniformLike).value;

    inst.seek(dur);
    const progEnd = (target.userData.wipeProgress as UniformLike).value;

    // mid frame differs from t=0, and the settled end is past the right edge
    expect(prog0).toBeLessThan(progMid - 0.05);
    expect(progEnd).toBeGreaterThan(progMid);
    // front fully clears (uProgress climbs past 1.0 to expose the jagged edge)
    expect(progEnd).toBeGreaterThan(1.0);

    inst.dispose();
  });

  it('controls change output: larger amplitude pushes the end progress further', () => {
    const target = makeTarget(zigzagWipePrimitive);
    const inst = zigzagWipePrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('amplitude', 0);
    inst.seek(dur);
    const smallEnd = (target.userData.wipeProgress as UniformLike).value;

    inst.setControl('amplitude', 0.4);
    inst.seek(dur);
    const largeEnd = (target.userData.wipeProgress as UniformLike).value;

    expect(largeEnd).toBeGreaterThan(smallEnd + 0.2);
    inst.dispose();
  });
});
