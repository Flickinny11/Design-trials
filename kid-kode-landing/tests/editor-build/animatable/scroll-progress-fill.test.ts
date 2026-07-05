import { describe, it, expect } from 'vitest';
import { scrollProgressFillPrimitive } from '@/lib/prism/animatable/primitives/scroll-progress-fill';
import { makeTarget, runConformance } from './_conformance';

describe('scroll-progress-fill primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(scrollProgressFillPrimitive).dispose();
  });

  it('plays: scroll drives the fill front forward', () => {
    const target = makeTarget(scrollProgressFillPrimitive);
    const inst = scrollProgressFillPrimitive.create(target);

    // Early frame: little/no scroll → fill front near 0.
    target.userData.scroll = 0;
    inst.seek(0);
    const progressLo = target.userData.scrollProgressFill as number;

    // Mid scroll → fill front advances.
    target.userData.scroll = 0.5;
    inst.seek(0);
    const progressMid = target.userData.scrollProgressFill as number;

    // Full scroll → fill front at the end.
    target.userData.scroll = 1;
    inst.seek(0);
    const progressHi = target.userData.scrollProgressFill as number;

    expect(progressMid).toBeGreaterThan(progressLo + 0.2);
    expect(progressHi).toBeGreaterThan(progressMid + 0.2);
    expect(progressHi).toBeCloseTo(1, 5);
    inst.dispose();
  });

  it('controls change output: larger softness widens the leading edge', () => {
    const target = makeTarget(scrollProgressFillPrimitive);
    const inst = scrollProgressFillPrimitive.create(target);

    target.userData.scroll = 0.5;

    inst.setControl('softness', 0);
    inst.seek(0);
    const sharp = target.userData.scrollProgressFillSoftness as number;

    inst.setControl('softness', 0.3);
    inst.seek(0);
    const soft = target.userData.scrollProgressFillSoftness as number;

    expect(soft).toBeGreaterThan(sharp + 0.2);
    inst.dispose();
  });
});
