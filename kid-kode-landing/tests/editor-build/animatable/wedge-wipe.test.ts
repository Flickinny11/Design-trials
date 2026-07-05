import { describe, it, expect } from 'vitest';
import { wedgeWipePrimitive } from '@/lib/prism/animatable/primitives/wedge-wipe';
import { makeTarget, runConformance } from './_conformance';

type Uniform = { value: number };

describe('wedge-wipe primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(wedgeWipePrimitive).dispose();
  });

  it('plays: progress uniform advances from start to end', () => {
    const target = makeTarget(wedgeWipePrimitive);
    const inst = wedgeWipePrimitive.create(target);
    const dur = inst.duration();
    const progress = target.userData.wedgeProgress as Uniform;

    inst.seek(0);
    const p0 = progress.value;

    inst.seek(dur * 0.5);
    const pMid = progress.value;

    inst.seek(dur);
    const pEnd = progress.value;

    // Mid frame differs from t=0 AND from the settled end.
    expect(pMid).toBeGreaterThan(p0 + 0.05);
    expect(pEnd).toBeGreaterThan(pMid + 0.05);
    expect(p0).toBeLessThan(0.05);
    expect(pEnd).toBeGreaterThan(0.95);
    inst.dispose();
  });

  it('controls change output: wedge count drives the wedges uniform', () => {
    const target = makeTarget(wedgeWipePrimitive);
    const inst = wedgeWipePrimitive.create(target);
    const wedges = target.userData.wedgeCount as Uniform;

    // The wedges uniform is read live in seek; two extremes give distinct N.
    inst.setControl('wedges', 2);
    inst.seek(0.1);
    const small = wedges.value;

    inst.setControl('wedges', 8);
    inst.seek(0.1);
    const large = wedges.value;

    expect(large).toBeGreaterThan(small + 3);
    expect(small).toBe(2);
    expect(large).toBe(8);
    inst.dispose();
  });
});
