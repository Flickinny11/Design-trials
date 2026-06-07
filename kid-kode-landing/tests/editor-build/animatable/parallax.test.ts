import { describe, it, expect } from 'vitest';
import { type Object3D } from 'three';
import { parallaxPrimitive } from '@/lib/prism/animatable/primitives/parallax';
import { makeTarget, runConformance } from './_conformance';

describe('parallax primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(parallaxPrimitive).dispose();
  });

  it('plays: scroll 0 vs scroll 1 shifts the subject along the axis', () => {
    const target = makeTarget(parallaxPrimitive);
    const inst = parallaxPrimitive.create(target);
    const subject = (target.subject ?? target.object) as Object3D;

    target.userData.scroll = 0;
    inst.seek(0);
    const y0 = subject.position.y;

    target.userData.scroll = 1;
    inst.seek(0);
    const y1 = subject.position.y;

    const range = 1.5;
    const depth = 1;
    expect(Math.abs(y1 - y0)).toBeGreaterThan(range * depth * 0.5);
    inst.dispose();
  });

  it('controls change output: axis dropdown routes motion to x', () => {
    const target = makeTarget(parallaxPrimitive);
    const inst = parallaxPrimitive.create(target);
    const subject = (target.subject ?? target.object) as Object3D;

    inst.setControl('axis', 'x');

    target.userData.scroll = 0;
    inst.seek(0);
    const x0 = subject.position.x;

    target.userData.scroll = 1;
    inst.seek(0);
    const x1 = subject.position.x;

    expect(Math.abs(x1 - x0)).toBeGreaterThan(1.5 * 1 * 0.5);
    inst.dispose();
  });
});
