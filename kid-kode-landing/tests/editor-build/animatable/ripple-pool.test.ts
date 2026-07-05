import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { ripplePoolPrimitive } from '@/lib/prism/animatable/primitives/ripple-pool';
import { makeTarget, runConformance } from './_conformance';

function zAt(mesh: Mesh, i: number): number {
  const pos = (mesh.geometry as PlaneGeometry).getAttribute('position') as BufferAttribute;
  return pos.getZ(i);
}

// Sum |z| across the plane's vertices — a scalar that captures total surface
// deformation regardless of which vertex any given ripple reaches.
function totalDeform(mesh: Mesh): number {
  const pos = (mesh.geometry as PlaneGeometry).getAttribute('position') as BufferAttribute;
  let sum = 0;
  for (let i = 0; i < pos.count; i++) sum += Math.abs(pos.getZ(i));
  return sum;
}

describe('ripple-pool primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(ripplePoolPrimitive).dispose();
  });

  it('plays: surface deforms and a mid frame differs from the settled start', () => {
    const target = makeTarget(ripplePoolPrimitive);
    const inst = ripplePoolPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.seek(0);
    const deform0 = totalDeform(mesh);
    const sampleEarly = zAt(mesh, 1500);

    inst.seek(1.3);
    const deformMid = totalDeform(mesh);
    const sampleMid = zAt(mesh, 1500);

    // The pool is visibly displaced at a mid frame...
    expect(deformMid).toBeGreaterThan(0.05);
    // ...and the wave has moved between two distinct times.
    expect(Math.abs(sampleMid - sampleEarly)).toBeGreaterThan(1e-4);
    expect(Math.abs(deformMid - deform0)).toBeGreaterThan(1e-3);

    inst.dispose();
  });

  it('controls change output: more drops and larger amplitude deform more', () => {
    const target = makeTarget(ripplePoolPrimitive);
    const inst = ripplePoolPrimitive.create(target);
    const mesh = target.subject as Mesh;

    // Single small drop.
    inst.setControl('drops', 1);
    inst.setControl('amplitude', 0.04);
    inst.seek(1.3);
    const low = totalDeform(mesh);

    // Four large drops — overlapping rings sum to more total deformation.
    inst.setControl('drops', 4);
    inst.setControl('amplitude', 0.5);
    inst.seek(1.3);
    const high = totalDeform(mesh);

    expect(high).toBeGreaterThan(low + 0.5);

    inst.dispose();
  });

  it('dispose restores the flat pool', () => {
    const target = makeTarget(ripplePoolPrimitive);
    const inst = ripplePoolPrimitive.create(target);
    const mesh = target.subject as Mesh;

    inst.seek(1.3);
    expect(totalDeform(mesh)).toBeGreaterThan(0.05);

    inst.dispose();
    expect(totalDeform(mesh)).toBeLessThan(1e-5);
  });
});
