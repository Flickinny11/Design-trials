import { describe, it, expect } from 'vitest';
import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { heatHazeWarpPrimitive } from '@/lib/prism/animatable/primitives/heat-haze-warp';
import { makeTarget, runConformance } from './_conformance';

describe('heat-haze-warp primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(heatHazeWarpPrimitive).dispose();
  });

  it('plays: vertex positions warp across time', () => {
    const target = makeTarget(heatHazeWarpPrimitive);
    const inst = heatHazeWarpPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const pos = geom.getAttribute('position') as BufferAttribute;

    // A representative interior vertex (avoid index 0 which can sit on an edge).
    const idx = Math.floor(pos.count / 2);

    inst.seek(0);
    const x0 = pos.getX(idx);
    const z0 = pos.getZ(idx);

    inst.seek(1.3);
    const xMid = pos.getX(idx);
    const zMid = pos.getZ(idx);

    // A vertex's position must visibly differ from the t=0 frame.
    const moved = Math.abs(xMid - x0) + Math.abs(zMid - z0);
    expect(moved).toBeGreaterThan(1e-4);

    // And a later frame differs from the mid frame too (continuous motion).
    inst.seek(2.7);
    const xLate = pos.getX(idx);
    expect(Math.abs(xLate - xMid)).toBeGreaterThan(1e-5);

    inst.dispose();
  });

  it('controls change output: larger amplitude means larger warp', () => {
    const target = makeTarget(heatHazeWarpPrimitive);
    const inst = heatHazeWarpPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const geom = mesh.geometry as BufferGeometry;
    const pos = geom.getAttribute('position') as BufferAttribute;
    const idx = Math.floor(pos.count / 2);

    inst.dispose(); // ensure a clean base before measuring

    // Capture the true rest position (no primitive applied).
    const restX = pos.getX(idx);
    const restZ = pos.getZ(idx);

    const inst2 = heatHazeWarpPrimitive.create(target);

    inst2.setControl('amplitude', 0.0);
    inst2.seek(1.0);
    const small =
      Math.abs(pos.getX(idx) - restX) + Math.abs(pos.getZ(idx) - restZ);

    inst2.setControl('amplitude', 0.15);
    inst2.seek(1.0);
    const large =
      Math.abs(pos.getX(idx) - restX) + Math.abs(pos.getZ(idx) - restZ);

    // At amplitude 0 the vertex sits at its base (~0 displacement); at 0.15 it
    // is visibly displaced.
    expect(small).toBeLessThan(1e-6);
    expect(large).toBeGreaterThan(small + 1e-3);

    inst2.dispose();
  });
});
