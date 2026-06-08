import { describe, it, expect } from 'vitest';
import { checkerWipePrimitive } from '@/lib/prism/animatable/primitives/checker-wipe';
import { makeTarget, runConformance } from './_conformance';

interface UniformLike {
  value: number;
}

describe('checker-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(checkerWipePrimitive).dispose();
  });

  it('plays: reveal progress advances across the timeline', () => {
    const target = makeTarget(checkerWipePrimitive);
    const inst = checkerWipePrimitive.create(target);
    const dur = inst.duration();

    const progress = target.userData.checkerProgress as UniformLike;

    inst.seek(0);
    const p0 = progress.value;

    inst.seek(dur / 2);
    const pMid = progress.value;

    inst.seek(dur);
    const pEnd = progress.value;

    // progress rises monotonically from 0 to 1 across the reveal
    expect(p0).toBeLessThan(pMid);
    expect(pMid).toBeLessThan(pEnd);
    expect(p0).toBeCloseTo(0, 5);
    expect(pEnd).toBeCloseTo(1, 5);

    inst.dispose();
  });

  it('controls change output: cells knob drives the live cell-count uniform', () => {
    const target = makeTarget(checkerWipePrimitive);
    const inst = checkerWipePrimitive.create(target);
    const cells = target.userData.checkerCells as UniformLike;

    inst.setControl('cells', 4);
    inst.seek(0.1);
    const few = cells.value;

    inst.setControl('cells', 16);
    inst.seek(0.1);
    const many = cells.value;

    expect(many).toBeGreaterThan(few + 2);
    expect(few).toBe(4);
    expect(many).toBe(16);

    inst.dispose();
  });
});
