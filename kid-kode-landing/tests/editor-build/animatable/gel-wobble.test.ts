import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { gelWobblePrimitive } from '@/lib/prism/animatable/primitives/gel-wobble';
import { makeTarget, runConformance } from './_conformance';

// Pick a vertex that has a non-trivial mode weight (interior, not on the
// nodal lines uvX∈{0,1} where sin(uvX*PI)=0). Scan for the vertex whose base
// displacement potential is largest so the wobble is clearly observable.
function pickActiveVertex(attr: BufferAttribute): number {
  let best = 0;
  let bestW = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < attr.count; i++) {
    minX = Math.min(minX, attr.getX(i));
    maxX = Math.max(maxX, attr.getX(i));
    minY = Math.min(minY, attr.getY(i));
    maxY = Math.max(maxY, attr.getY(i));
  }
  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;
  for (let i = 0; i < attr.count; i++) {
    const ux = (attr.getX(i) - minX) / sx;
    const uy = (attr.getY(i) - minY) / sy;
    const w =
      Math.abs(Math.sin(ux * Math.PI)) +
      Math.abs(Math.sin(uy * Math.PI) * Math.cos(ux * Math.PI));
    if (w > bestW) {
      bestW = w;
      best = i;
    }
  }
  return best;
}

describe('gel-wobble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gelWobblePrimitive).dispose();
  });

  it('plays: a vertex z varies across time (damped wobble)', () => {
    const target = makeTarget(gelWobblePrimitive);
    const inst = gelWobblePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).attributes.position as BufferAttribute;
    const v = pickActiveVertex(attr);

    inst.seek(0);
    const zStart = attr.getZ(v);

    // Sample across the first poke cycle; the damped sinusoid must move this
    // vertex's z meaningfully at some mid-frame relative to the t=0 frame.
    let maxDelta = 0;
    for (let i = 1; i <= 40; i++) {
      inst.seek((i / 40) * 1.2);
      maxDelta = Math.max(maxDelta, Math.abs(attr.getZ(v) - zStart));
    }

    expect(maxDelta).toBeGreaterThan(0.02);
    inst.dispose();
  });

  it('controls change output: larger amplitude means larger z displacement', () => {
    const target = makeTarget(gelWobblePrimitive);
    const inst = gelWobblePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const attr = (mesh.geometry as PlaneGeometry).attributes.position as BufferAttribute;
    const v = pickActiveVertex(attr);

    inst.seek(0);
    const base = attr.getZ(v);

    // A time where the damped wobble is near a peak (early in the cycle, before
    // decay dampens it). 0.05 ≈ first sin peak for freq≈5.
    const probe = 0.05;

    inst.setControl('amplitude', 0.05);
    inst.seek(probe);
    const small = Math.abs(attr.getZ(v) - base);

    inst.setControl('amplitude', 0.6);
    inst.seek(probe);
    const large = Math.abs(attr.getZ(v) - base);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
