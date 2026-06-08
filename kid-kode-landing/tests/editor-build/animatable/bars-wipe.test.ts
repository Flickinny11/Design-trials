import { describe, it, expect } from 'vitest';
import { barsWipePrimitive } from '@/lib/prism/animatable/primitives/bars-wipe';
import { makeTarget, runConformance } from './_conformance';

type U = { value: number };

describe('bars-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(barsWipePrimitive).dispose();
  });

  it('plays: reveal progress advances across the timeline', () => {
    const target = makeTarget(barsWipePrimitive);
    const inst = barsWipePrimitive.create(target);
    const dur = inst.duration();

    inst.seek(0);
    const p0 = (target.userData.barsProgress as U).value;

    inst.seek(dur / 2);
    const pMid = (target.userData.barsProgress as U).value;

    inst.seek(dur);
    const pEnd = (target.userData.barsProgress as U).value;

    // mid-animation differs from t=0 AND from the settled end
    expect(pMid).toBeGreaterThan(p0 + 0.1);
    expect(pEnd).toBeGreaterThan(pMid + 0.1);
    expect(p0).toBeCloseTo(0, 5);
    expect(pEnd).toBeCloseTo(1, 5);
    inst.dispose();
  });

  it('controls change output: bar count follows the knob', () => {
    const target = makeTarget(barsWipePrimitive);
    const inst = barsWipePrimitive.create(target);

    inst.setControl('bars', 3);
    inst.seek(0.5);
    const few = (target.userData.barsCount as U).value;

    inst.setControl('bars', 16);
    inst.seek(0.5);
    const many = (target.userData.barsCount as U).value;

    expect(many).toBeGreaterThan(few + 1);
    inst.dispose();
  });
});
