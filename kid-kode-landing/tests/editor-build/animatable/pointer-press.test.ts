import { describe, it, expect } from 'vitest';
import { Mesh, type MeshStandardMaterial } from 'three';
import { pointerPressPrimitive } from '@/lib/prism/animatable/primitives/pointer-press';
import { makeTarget, runConformance } from './_conformance';

describe('pointer-press primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerPressPrimitive).dispose();
  });

  it('plays: pointer near center presses the card back (-z) and raises emissive', () => {
    const target = makeTarget(pointerPressPrimitive);
    const inst = pointerPressPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as MeshStandardMaterial;

    // Pointer far away -> no press, settled state.
    target.userData.pointer = { x: 1.0, y: 1.0 };
    inst.seek(0.5);
    const zFar = mesh.position.z;
    const emissiveFar = mat.emissiveIntensity;

    // Pointer on center -> recedes (z negative) + emissive blooms.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(1.0);
    const zNear = mesh.position.z;
    const emissiveNear = mat.emissiveIntensity;

    // press RECEDES (distinct from hover-lift which would be +z)
    expect(zNear).toBeLessThan(zFar - 0.1);
    expect(zNear).toBeLessThan(0);
    // contact highlight blooms
    expect(emissiveNear).toBeGreaterThan(emissiveFar + 0.1);

    inst.dispose();
    // transform + material restored
    expect(mesh.position.z).toBe(zFar);
    expect(mat.emissiveIntensity).toBe(emissiveFar);
  });

  it('controls change output: deeper pressDepth recedes farther', () => {
    const target = makeTarget(pointerPressPrimitive);
    const inst = pointerPressPrimitive.create(target);
    const mesh = target.subject as Mesh;

    target.userData.pointer = { x: 0.5, y: 0.5 }; // on center -> full press

    inst.setControl('pressDepth', 0.1);
    inst.seek(0);
    const shallow = mesh.position.z;

    inst.setControl('pressDepth', 2);
    inst.seek(0);
    const deep = mesh.position.z;

    expect(deep).toBeLessThan(shallow - 0.3);
    inst.dispose();
  });
});
