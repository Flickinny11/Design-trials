import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { pointerAttractScalePrimitive } from '@/lib/prism/animatable/primitives/pointer-attract-scale';
import { makeTarget, runConformance } from './_conformance';

describe('pointer-attract-scale primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerAttractScalePrimitive).dispose();
  });

  it('plays: scale swells when the pointer is near center vs far', () => {
    const target = makeTarget(pointerAttractScalePrimitive);
    const inst = pointerAttractScalePrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Pointer near center → proximity high → scale converges upward over frames.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    for (let i = 0; i <= 20; i++) inst.seek(i * 0.05);
    const near = mesh.scale.x;

    // Pointer far in the corner → proximity ~0 → scale relaxes back toward base.
    target.userData.pointer = { x: 0, y: 0 };
    for (let i = 0; i <= 20; i++) inst.seek(1 + i * 0.05);
    const far = mesh.scale.x;

    // Mid-animation (first near frame) differs from the settled-near value and
    // both differ from the far/relaxed value.
    expect(near).toBeGreaterThan(far + 0.05);
    expect(near).toBeGreaterThan(1.0);
    inst.dispose();
  });

  it('controls change output: larger maxScale yields a larger swell', () => {
    const target = makeTarget(pointerAttractScalePrimitive);
    const inst = pointerAttractScalePrimitive.create(target);
    const mesh = target.subject as Mesh;
    target.userData.pointer = { x: 0.5, y: 0.5 };

    inst.setControl('maxScale', 1.05);
    let tt = 0;
    for (let i = 0; i <= 30; i++) inst.seek((tt += 0.05));
    const small = mesh.scale.x;

    // Reset state by disposing + recreating for a clean convergence at the extreme.
    inst.dispose();
    const inst2 = pointerAttractScalePrimitive.create(target);
    inst2.setControl('maxScale', 1.6);
    tt = 0;
    for (let i = 0; i <= 30; i++) inst2.seek((tt += 0.05));
    const large = mesh.scale.x;

    expect(large).toBeGreaterThan(small + 0.1);
    inst2.dispose();
  });
});
