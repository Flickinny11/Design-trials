import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { crystalFacetPrimitive } from '@/lib/prism/animatable/primitives/crystal-facet';
import { makeTarget, runConformance } from './_conformance';

describe('crystal-facet primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crystalFacetPrimitive).dispose();
  });

  it('plays: subject rotates across the timeline', () => {
    const target = makeTarget(crystalFacetPrimitive);
    const inst = crystalFacetPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.seek(0);
    const rot0 = mesh.rotation.y;

    inst.seek(2);
    const rotMid = mesh.rotation.y;

    inst.seek(4);
    const rotLate = mesh.rotation.y;

    // Slow turn: rotation increases monotonically across distinct frames.
    expect(rotMid).toBeGreaterThan(rot0);
    expect(rotLate).toBeGreaterThan(rotMid);
    inst.dispose();
  });

  it('plays: time uniform advances and dispose restores rotation', () => {
    const target = makeTarget(crystalFacetPrimitive);
    const inst = crystalFacetPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseRot = mesh.rotation.y;

    inst.seek(3);
    expect(mesh.rotation.y).not.toBe(baseRot);

    inst.dispose();
    // dispose restores the subject's original rotation.
    expect(mesh.rotation.y).toBe(baseRot);
  });

  it('controls change output: larger spin means more rotation at the same time', () => {
    const target = makeTarget(crystalFacetPrimitive);
    const inst = crystalFacetPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const base = mesh.rotation.y;

    inst.setControl('spin', 0.1);
    inst.seek(3);
    const slow = mesh.rotation.y - base;

    inst.setControl('spin', 3);
    inst.seek(3);
    const fast = mesh.rotation.y - base;

    expect(fast).toBeGreaterThan(slow + 1);
    inst.dispose();
  });
});
