import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { perspectiveTiltInPrimitive } from '@/lib/prism/animatable/primitives/perspective-tilt-in';
import { makeTarget, runConformance } from './_conformance';

describe('perspective-tilt-in primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(perspectiveTiltInPrimitive).dispose();
  });

  it('plays: rotation.x and position.z ease toward flat while opacity rises', () => {
    const target = makeTarget(perspectiveTiltInPrimitive);
    const inst = perspectiveTiltInPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = mesh.rotation.x;
    const z0 = mesh.position.z;
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotEnd = mesh.rotation.x;
    const zEnd = mesh.position.z;
    const opEnd = mat.opacity;

    // starts tilted back and pushed away, settles flat on its plane
    expect(rot0).toBeGreaterThan(rotEnd + 0.3);
    expect(z0).toBeLessThan(zEnd - 0.5);
    expect(Math.abs(rotEnd)).toBeLessThan(1e-6);
    expect(Math.abs(zEnd)).toBeLessThan(1e-6);
    // opacity rises across the eased phase
    expect(opEnd).toBeGreaterThan(op0);
    inst.dispose();
  });

  it('controls change output: larger tilt and depth mean larger initial offsets', () => {
    const target = makeTarget(perspectiveTiltInPrimitive);
    const inst = perspectiveTiltInPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('tiltDeg', 20);
    inst.setControl('depth', 2);
    inst.seek(0);
    const smallRot = mesh.rotation.x;
    const smallZ = mesh.position.z;

    inst.setControl('tiltDeg', 70);
    inst.setControl('depth', 10);
    inst.seek(0);
    const largeRot = mesh.rotation.x;
    const largeZ = mesh.position.z;

    expect(largeRot).toBeGreaterThan(smallRot + 0.3);
    expect(largeZ).toBeLessThan(smallZ - 0.5);
    inst.dispose();
  });
});
