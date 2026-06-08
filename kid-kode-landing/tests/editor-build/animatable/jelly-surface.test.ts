import { describe, it, expect } from 'vitest';
import { Mesh, type BufferAttribute } from 'three';
import { jellySurfacePrimitive } from '@/lib/prism/animatable/primitives/jelly-surface';
import { makeTarget, runConformance } from './_conformance';

/** Index of the vertex closest to the plane center (largest jiggle envelope). */
function centralVertex(pos: BufferAttribute): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getY(i));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Peak |z| over the displaced surface at time t. */
function peakAbsZ(inst: ReturnType<typeof jellySurfacePrimitive.create>, pos: BufferAttribute, t: number): number {
  inst.seek(t);
  let peak = 0;
  for (let i = 0; i < pos.count; i++) {
    const az = Math.abs(pos.getZ(i));
    if (az > peak) peak = az;
  }
  return peak;
}

describe('jelly-surface primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(jellySurfacePrimitive).dispose();
  });

  it('plays: a central vertex z varies over time', () => {
    const target = makeTarget(jellySurfacePrimitive);
    const inst = jellySurfacePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
    const vi = centralVertex(pos);

    // Sample z at several times; the damped radial wave must move the vertex.
    inst.seek(0);
    const z0 = pos.getZ(vi);
    inst.seek(0.35);
    const zMid = pos.getZ(vi);
    inst.seek(0.7);
    const zLate = pos.getZ(vi);

    // The vertex z is not frozen — at least one frame differs meaningfully.
    expect(Math.abs(zMid - z0)).toBeGreaterThan(0.01);
    // And it is genuinely oscillating, not monotone drift.
    const spread = Math.max(z0, zMid, zLate) - Math.min(z0, zMid, zLate);
    expect(spread).toBeGreaterThan(0.01);

    inst.dispose();
    // dispose restores the rest geometry.
    expect(Math.abs(pos.getZ(vi))).toBeLessThan(1e-6);
  });

  it('controls change output: larger amplitude means larger surface jiggle', () => {
    const target = makeTarget(jellySurfacePrimitive);
    const inst = jellySurfacePrimitive.create(target);
    const mesh = target.subject as Mesh;
    const pos = mesh.geometry.getAttribute('position') as BufferAttribute;

    // Freeze falloff/speed; vary amplitude between two extremes. Use a time
    // where the central wave is near its crest so the peak is well-defined.
    const t = 0.25;

    inst.setControl('amplitude', 0.05);
    const small = peakAbsZ(inst, pos, t);

    inst.setControl('amplitude', 0.6);
    const large = peakAbsZ(inst, pos, t);

    expect(large).toBeGreaterThan(small + 0.05);
    inst.dispose();
  });
});
