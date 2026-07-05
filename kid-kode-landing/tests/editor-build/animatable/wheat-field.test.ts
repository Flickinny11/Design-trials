import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { wheatFieldPrimitive } from '@/lib/prism/animatable/primitives/wheat-field';
import { makeTarget, runConformance } from './_conformance';

function posAttrOf(target: ReturnType<typeof makeTarget>): BufferAttribute {
  const mesh = target.subject as Mesh;
  const geom = mesh.geometry as PlaneGeometry;
  return geom.attributes.position as BufferAttribute;
}

/** Index of the vertex whose |x| moves most between two seeked frames. */
function maxMovingVertex(
  inst: ReturnType<typeof wheatFieldPrimitive.create>,
  attr: BufferAttribute,
  tA: number,
  tB: number,
): { index: number; xA: number; xB: number } {
  inst.seek(tA);
  const xsA = new Float32Array(attr.count);
  for (let i = 0; i < attr.count; i++) xsA[i] = attr.getX(i);
  inst.seek(tB);
  let best = 0;
  let bestDelta = -1;
  for (let i = 0; i < attr.count; i++) {
    const d = Math.abs(attr.getX(i) - xsA[i]);
    if (d > bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return { index: best, xA: xsA[best], xB: attr.getX(best) };
}

describe('wheat-field primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(wheatFieldPrimitive).dispose();
  });

  it('plays: a tip vertex x varies as the gust passes', () => {
    const target = makeTarget(wheatFieldPrimitive);
    const inst = wheatFieldPrimitive.create(target);
    const attr = posAttrOf(target);

    // Looping primitive: pick two distinct times and confirm a blade vertex
    // moves in x between the early and the later frame.
    const moved = maxMovingVertex(inst, attr, 0, 1.3);
    expect(Math.abs(moved.xB - moved.xA)).toBeGreaterThan(0.02);

    inst.dispose();
  });

  it('restores base x positions on dispose', () => {
    const target = makeTarget(wheatFieldPrimitive);
    const inst = wheatFieldPrimitive.create(target);
    const attr = posAttrOf(target);

    const base = new Float32Array(attr.count);
    for (let i = 0; i < attr.count; i++) base[i] = attr.getX(i);

    inst.seek(0.9);
    inst.dispose();

    let maxDrift = 0;
    for (let i = 0; i < attr.count; i++) {
      maxDrift = Math.max(maxDrift, Math.abs(attr.getX(i) - base[i]));
    }
    expect(maxDrift).toBeLessThan(1e-5);
  });

  it('controls change output: larger bend means larger displacement', () => {
    const target = makeTarget(wheatFieldPrimitive);
    const inst = wheatFieldPrimitive.create(target);
    const attr = posAttrOf(target);

    // Capture base x once (dispose restores to this between measurements).
    const base = new Float32Array(attr.count);
    for (let i = 0; i < attr.count; i++) base[i] = attr.getX(i);

    const maxDispAt = (bend: number): number => {
      inst.setControl('bend', bend);
      inst.seek(0.6);
      let m = 0;
      for (let i = 0; i < attr.count; i++) {
        m = Math.max(m, Math.abs(attr.getX(i) - base[i]));
      }
      return m;
    };

    const small = maxDispAt(0.1);
    const large = maxDispAt(0.8);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
