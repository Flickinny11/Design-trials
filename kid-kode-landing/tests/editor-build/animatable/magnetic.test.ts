import { describe, it, expect } from 'vitest';
import { type Mesh } from 'three';
import { magneticPrimitive } from '@/lib/prism/animatable/primitives/magnetic';
import { makeTarget, runConformance } from './_conformance';

describe('magnetic primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(magneticPrimitive).dispose();
  });

  it('plays: subject springs toward the pointer sign', () => {
    const target = makeTarget(magneticPrimitive);
    const inst = magneticPrimitive.create(target);
    const subject = target.subject as Mesh;

    // Pull right.
    target.userData.pointer = { x: 1, y: 0 };
    for (let i = 0; i < 8; i++) inst.seek(0);
    const right = subject.position.x;

    // Reset to base, pull left.
    inst.dispose();
    target.userData.pointer = { x: -1, y: 0 };
    for (let i = 0; i < 8; i++) inst.seek(0);
    const left = subject.position.x;

    expect(right).toBeGreaterThan(0);
    expect(left).toBeLessThan(0);
    expect(right - left).toBeGreaterThan(0.2);
    inst.dispose();
  });

  it('controls change output: strength scales how fast it converges', () => {
    const target = makeTarget(magneticPrimitive);
    const inst = magneticPrimitive.create(target);
    const subject = target.subject as Mesh;

    target.userData.pointer = { x: 1, y: 0 };
    inst.setControl('strength', 0.02);
    inst.seek(0);
    const weak = subject.position.x;

    inst.dispose();
    inst.setControl('strength', 1);
    inst.seek(0);
    const strong = subject.position.x;

    expect(strong).toBeGreaterThan(weak);
    inst.dispose();
  });
});
