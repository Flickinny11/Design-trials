import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { iridescentGlassPrimitive } from '@/lib/prism/animatable/primitives/iridescent-glass';
import { makeTarget, runConformance } from './_conformance';

describe('iridescent-glass primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(iridescentGlassPrimitive).dispose();
  });

  it('plays: the sphere rotates continuously across the loop timeline', () => {
    const target = makeTarget(iridescentGlassPrimitive);
    const inst = iridescentGlassPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Looping primitive (duration() === Infinity): pick distinct t values.
    expect(inst.duration()).toBe(Infinity);

    inst.seek(0);
    const rot0 = mesh.rotation.y;

    inst.seek(2);
    const rotMid = mesh.rotation.y;

    inst.seek(5);
    const rotLate = mesh.rotation.y;

    // A mid frame differs from t=0, and a later frame differs again — concrete
    // CPU-observable motion on the rotation transform.
    expect(rotMid).not.toBe(rot0);
    expect(rotLate).toBeGreaterThan(rotMid);
    expect(rotLate - rot0).toBeGreaterThan(0.5);

    // dispose restores the base rotation.
    inst.dispose();
    expect(mesh.rotation.y).toBe(rot0);
  });

  it('controls change output: faster rotate speed advances rotation more', () => {
    const target = makeTarget(iridescentGlassPrimitive);
    const inst = iridescentGlassPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const base = mesh.rotation.y;

    inst.setControl('rotateSpeed', 0.1);
    inst.seek(4);
    const slow = mesh.rotation.y - base;

    inst.setControl('rotateSpeed', 2);
    inst.seek(4);
    const fast = mesh.rotation.y - base;

    expect(fast).toBeGreaterThan(slow + 0.5);
    inst.dispose();
  });
});
