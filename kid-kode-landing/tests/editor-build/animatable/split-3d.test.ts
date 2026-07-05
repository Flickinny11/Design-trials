import { describe, it, expect } from 'vitest';
import type { Object3D } from 'three';
import { split3dPrimitive } from '@/lib/prism/animatable/primitives/split-3d';
import { makeTarget, runConformance } from './_conformance';

describe('split-3d primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(split3dPrimitive).dispose();
  });

  it('plays: left and right halves swing from opposite depths toward rest', () => {
    const target = makeTarget(split3dPrimitive);
    const inst = split3dPrimitive.create(target);
    const glyphs = (target.subject as Object3D).children;
    const N = glyphs.length;
    const left = glyphs[0]; // index 0 -> left half
    const right = glyphs[N - 1]; // last index -> right half
    const dur = inst.duration();

    // mid-phase: halves are still swung open, opposite-signed rotation.y
    inst.seek(dur * 0.25);
    const leftRotMid = left.rotation.y;
    const rightRotMid = right.rotation.y;
    expect(Math.sign(leftRotMid)).toBe(-Math.sign(rightRotMid));
    expect(leftRotMid * rightRotMid).toBeLessThan(0);
    expect(Math.abs(leftRotMid)).toBeGreaterThan(0.05);

    // settled end: both rotations collapse to ~0
    inst.seek(dur);
    expect(Math.abs(left.rotation.y)).toBeLessThan(Math.abs(leftRotMid));
    expect(Math.abs(right.rotation.y)).toBeLessThan(0.001);
    inst.dispose();
  });

  it('controls change output: larger spread means larger initial x separation', () => {
    const target = makeTarget(split3dPrimitive);
    const inst = split3dPrimitive.create(target);
    const glyphs = (target.subject as Object3D).children;
    const N = glyphs.length;
    const left = glyphs[0];
    const right = glyphs[N - 1];

    inst.setControl('spread', 1);
    inst.seek(0);
    const small = Math.abs(right.position.x - left.position.x);

    inst.setControl('spread', 6);
    inst.seek(0);
    const large = Math.abs(right.position.x - left.position.x);

    expect(large).toBeGreaterThan(small + 1);
    inst.dispose();
  });
});
