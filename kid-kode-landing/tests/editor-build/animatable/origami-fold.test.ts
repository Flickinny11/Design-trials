import { describe, it, expect } from 'vitest';
import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { origamiFoldPrimitive } from '@/lib/prism/animatable/primitives/origami-fold';
import { makeTarget, runConformance } from './_conformance';

function posAttrOf(target: ReturnType<typeof makeTarget>): BufferAttribute {
  const mesh = target.subject as Mesh;
  const geom = mesh.geometry as PlaneGeometry;
  return geom.attributes.position as BufferAttribute;
}

/** Index of the vertex with the largest |z| in the current geometry state. */
function maxAbsZIndex(pos: BufferAttribute): number {
  let idx = 0;
  let best = -1;
  for (let i = 0; i < pos.count; i++) {
    const az = Math.abs(pos.getZ(i));
    if (az > best) {
      best = az;
      idx = i;
    }
  }
  return idx;
}

describe('origami-fold primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(origamiFoldPrimitive).dispose();
  });

  it('plays: a folded vertex z collapses to ~0 and x expands as it unfolds', () => {
    const target = makeTarget(origamiFoldPrimitive);
    const inst = origamiFoldPrimitive.create(target);
    const pos = posAttrOf(target);
    const dur = inst.duration();

    // Early frame: the pleat is folded — pick the vertex lifted highest.
    inst.seek(0);
    const vi = maxAbsZIndex(pos);
    const zEarly = Math.abs(pos.getZ(vi));
    const xEarly = pos.getX(vi);

    // That same vertex must be lifted meaningfully while folded.
    expect(zEarly).toBeGreaterThan(0.1);

    // End frame: the surface lies flat — z collapses toward 0.
    inst.seek(dur);
    const zEnd = Math.abs(pos.getZ(vi));
    const xEnd = pos.getX(vi);

    expect(zEnd).toBeLessThan(zEarly - 0.05);
    expect(zEnd).toBeLessThan(0.02);

    // x expands outward (away from its crease) as it unfolds: |x| grows toward
    // the un-compressed base position.
    expect(Math.abs(xEnd)).toBeGreaterThan(Math.abs(xEarly));

    inst.dispose();
    // dispose restores the flat base (z ~ 0 everywhere).
    expect(Math.abs(pos.getZ(vi))).toBeLessThan(1e-5);
  });

  it('controls change output: larger foldDepth lifts the pleat higher at t=0', () => {
    const target = makeTarget(origamiFoldPrimitive);
    const inst = origamiFoldPrimitive.create(target);
    const pos = posAttrOf(target);

    inst.setControl('foldDepth', 0.2);
    inst.seek(0);
    const shallow = Math.abs(pos.getZ(maxAbsZIndex(pos)));

    inst.setControl('foldDepth', 1.5);
    inst.seek(0);
    const deep = Math.abs(pos.getZ(maxAbsZIndex(pos)));

    expect(deep).toBeGreaterThan(shallow + 0.3);
    inst.dispose();
  });
});
