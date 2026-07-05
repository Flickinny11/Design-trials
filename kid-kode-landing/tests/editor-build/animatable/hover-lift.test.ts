import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { hoverLiftPrimitive } from '@/lib/prism/animatable/primitives/hover-lift';
import { makeTarget, runConformance } from './_conformance';

describe('hover-lift primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(hoverLiftPrimitive).dispose();
  });

  it('plays: position.z, scale, and emissive rise as the pointer nears center', () => {
    const target = makeTarget(hoverLiftPrimitive);
    const inst = hoverLiftPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { emissiveIntensity: number };
    const baseZ = mesh.position.z;
    const baseScale = mesh.scale.x;

    // Pointer far from center (corner): little/no lift.
    target.userData.pointer = { x: 1.0, y: 1.0 };
    inst.seek(0);
    const zFar = mesh.position.z;
    const scaleFar = mesh.scale.x;
    const emFar = mat.emissiveIntensity;

    // Pointer at dead center: maximum proximity → maximum lift.
    target.userData.pointer = { x: 0.5, y: 0.5 };
    inst.seek(0.1);
    const zNear = mesh.position.z;
    const scaleNear = mesh.scale.x;
    const emNear = mat.emissiveIntensity;

    expect(zNear).toBeGreaterThan(zFar + 0.1);
    expect(zNear).toBeGreaterThan(baseZ);
    expect(scaleNear).toBeGreaterThan(scaleFar);
    expect(scaleNear).toBeGreaterThan(baseScale);
    expect(emNear).toBeGreaterThan(emFar);
    inst.dispose();
  });

  it('controls change output: larger lift means greater position.z at center', () => {
    const target = makeTarget(hoverLiftPrimitive);
    const inst = hoverLiftPrimitive.create(target);
    const mesh = target.subject as Mesh;
    target.userData.pointer = { x: 0.5, y: 0.5 };

    inst.setControl('lift', 0.1);
    inst.seek(0);
    const small = mesh.position.z;

    inst.setControl('lift', 2);
    inst.seek(0);
    const large = mesh.position.z;

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
