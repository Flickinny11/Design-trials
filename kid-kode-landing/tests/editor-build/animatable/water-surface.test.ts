import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { waterSurfacePrimitive } from '@/lib/prism/animatable/primitives/water-surface';
import { makeTarget, runConformance } from './_conformance';

// Sum of |z| across all vertices — a CPU-observable scalar that captures how
// far the sheet has displaced from flat at a given time.
function totalZDisplacement(attr: BufferAttribute): number {
  let s = 0;
  for (let i = 0; i < attr.count; i++) s += Math.abs(attr.getZ(i));
  return s;
}

describe('water-surface primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(waterSurfacePrimitive).dispose();
  });

  it('plays: vertex z displacement differs between two frames', () => {
    const target = makeTarget(waterSurfacePrimitive);
    const inst = waterSurfacePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).getAttribute('position') as BufferAttribute;

    inst.seek(0.0);
    const early = totalZDisplacement(attr);
    // Capture a specific vertex too, to prove per-vertex motion (not just a sum).
    const vEarly = attr.getZ(attr.count >> 1);

    inst.seek(3.1);
    const mid = totalZDisplacement(attr);
    const vMid = attr.getZ(attr.count >> 1);

    // Looping/continuous effect: distinct t values produce distinct surfaces.
    expect(Math.abs(mid - early)).toBeGreaterThan(1e-4);
    expect(Math.abs(vMid - vEarly)).toBeGreaterThan(1e-4);

    // It is actually displacing (not a flat sheet) at the mid frame.
    expect(mid).toBeGreaterThan(0.01);
    inst.dispose();
  });

  it('controls change output: lower calm yields larger amplitude than higher calm', () => {
    const target = makeTarget(waterSurfacePrimitive);
    const inst = waterSurfacePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).getAttribute('position') as BufferAttribute;
    const T = 1.7;

    // Very calm -> small displacement.
    inst.setControl('calm', 1);
    inst.seek(T);
    const calmDisp = totalZDisplacement(attr);

    // Choppier (less calm) -> larger displacement at the same time.
    inst.setControl('calm', 0);
    inst.seek(T);
    const roughDisp = totalZDisplacement(attr);

    expect(roughDisp).toBeGreaterThan(calmDisp + 1e-3);
    inst.dispose();
  });

  it('restores base positions on dispose', () => {
    const target = makeTarget(waterSurfacePrimitive);
    const inst = waterSurfacePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).getAttribute('position') as BufferAttribute;

    const z0 = attr.getZ(attr.count >> 1);
    inst.seek(2.4);
    inst.dispose();
    const zRestored = attr.getZ(attr.count >> 1);
    expect(Math.abs(zRestored - z0)).toBeLessThan(1e-6);
  });
});
