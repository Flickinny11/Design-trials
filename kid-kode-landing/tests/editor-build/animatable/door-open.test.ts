import { describe, it, expect } from 'vitest';
import { Mesh, type Material } from 'three';
import { doorOpenPrimitive } from '@/lib/prism/animatable/primitives/door-open';
import { makeTarget, runConformance } from './_conformance';

describe('door-open primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(doorOpenPrimitive).dispose();
  });

  it('plays: rotation.y swings from a shut angle toward flat (0) and position arcs', () => {
    const target = makeTarget(doorOpenPrimitive);
    const inst = doorOpenPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const mat = mesh.material as Material & { opacity: number };
    const dur = inst.duration();

    inst.seek(0);
    const rot0 = mesh.rotation.y;
    const x0 = mesh.position.x;
    const op0 = mat.opacity;

    inst.seek(dur);
    const rotEnd = mesh.rotation.y;
    const xEnd = mesh.position.x;
    const opEnd = mat.opacity;

    // Starts at a meaningful (shut) angle, ends flat (~0).
    expect(Math.abs(rot0)).toBeGreaterThan(0.5);
    expect(Math.abs(rotEnd)).toBeLessThan(1e-6);
    // The hinge offset makes the x position trace an arc — it moves.
    expect(Math.abs(x0 - xEnd)).toBeGreaterThan(0.05);
    // Opacity rises across the open.
    expect(opEnd).toBeGreaterThan(op0);

    inst.dispose();
    // Restored to base on dispose.
    expect(mesh.rotation.y).toBeCloseTo(0, 6);
  });

  it('controls change output: larger open angle means larger initial rotation', () => {
    const target = makeTarget(doorOpenPrimitive);
    const inst = doorOpenPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.setControl('openAngleDeg', 60);
    inst.seek(0);
    const small = Math.abs(mesh.rotation.y);

    inst.setControl('openAngleDeg', 160);
    inst.seek(0);
    const large = Math.abs(mesh.rotation.y);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
