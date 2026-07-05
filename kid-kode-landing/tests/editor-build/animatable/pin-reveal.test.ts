import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { pinRevealPrimitive } from '@/lib/prism/animatable/primitives/pin-reveal';
import { makeTarget, runConformance } from './_conformance';

describe('pin-reveal primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pinRevealPrimitive).dispose();
  });

  it('plays: scroll=0 is small + dim, scroll=1 is full scale + opaque', () => {
    const target = makeTarget(pinRevealPrimitive);
    const inst = pinRevealPrimitive.create(target);
    const subject = target.subject as Mesh;
    const mat = subject.material as Material & { opacity: number };

    target.userData.scroll = 0;
    inst.seek(0);
    const scale0 = subject.scale.x;
    const op0 = mat.opacity;

    target.userData.scroll = 1;
    inst.seek(0);
    const scale1 = subject.scale.x;
    const op1 = mat.opacity;

    expect(scale1 - scale0).toBeGreaterThan(0.2);
    expect(scale1).toBeCloseTo(1, 2);
    expect(op0).toBeLessThan(0.05);
    expect(op1).toBeGreaterThan(0.95);
    inst.dispose();
  });

  it('controls change output: a larger startScale raises the scroll=0 scale', () => {
    const target = makeTarget(pinRevealPrimitive);
    const inst = pinRevealPrimitive.create(target);
    const subject = target.subject as Mesh;

    target.userData.scroll = 0;
    inst.setControl('startScale', 0.6);
    inst.seek(0);
    const small = subject.scale.x;

    inst.setControl('startScale', 0.95);
    inst.seek(0);
    const large = subject.scale.x;

    expect(large).toBeGreaterThan(small);
    inst.dispose();
  });
});
