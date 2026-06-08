import { describe, it, expect } from 'vitest';
import { spiralWipePrimitive } from '@/lib/prism/animatable/primitives/spiral-wipe';
import { makeTarget, runConformance } from './_conformance';

type U = { value: number };

describe('spiral-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(spiralWipePrimitive).dispose();
  });

  it('plays: spiral progress advances from start to end', () => {
    const target = makeTarget(spiralWipePrimitive);
    const inst = spiralWipePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const p0 = (target.userData.spiralProgress as U).value;

    inst.seek(dur * 0.5);
    const pMid = (target.userData.spiralProgress as U).value;

    inst.seek(dur);
    const pEnd = (target.userData.spiralProgress as U).value;

    // progress winds outward: a mid frame differs from t=0 and from the settled end
    expect(pMid).toBeGreaterThan(p0 + 0.05);
    expect(pEnd).toBeGreaterThan(pMid + 0.05);
    expect(p0).toBeCloseTo(0, 5);
    expect(pEnd).toBeCloseTo(1, 5);

    inst.dispose();
  });

  it('controls change output: longer duration means less progress at a fixed time', () => {
    const target = makeTarget(spiralWipePrimitive);
    const inst = spiralWipePrimitive.create(target);

    // At a fixed clock time, a short duration is further along than a long one.
    inst.setControl('duration', 0.3);
    inst.seek(0.3);
    const shortDur = (target.userData.spiralProgress as U).value;

    inst.setControl('duration', 4);
    inst.seek(0.3);
    const longDur = (target.userData.spiralProgress as U).value;

    expect(shortDur).toBeGreaterThan(longDur + 0.1);
    inst.dispose();
  });
});
