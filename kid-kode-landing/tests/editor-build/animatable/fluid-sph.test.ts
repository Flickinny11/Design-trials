import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { fluidSphPrimitive } from '@/lib/prism/animatable/primitives/fluid-sph';
import { makeTarget, runConformance } from './_conformance';

/** Read the y of a given particle index from the Points position attribute. */
function particleY(target: ReturnType<typeof makeTarget>, idx: number): number {
  const points = target.object.children.find(
    (c) => c instanceof Points,
  ) as Points;
  const arr = points.geometry.getAttribute('position').array as Float32Array;
  return arr[idx * 3 + 1];
}
function particleX(target: ReturnType<typeof makeTarget>, idx: number): number {
  const points = target.object.children.find(
    (c) => c instanceof Points,
  ) as Points;
  const arr = points.geometry.getAttribute('position').array as Float32Array;
  return arr[idx * 3];
}

describe('fluid-sph primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(fluidSphPrimitive).dispose();
  });

  it('plays: particles fall under gravity and settle lower over time', () => {
    const target = makeTarget(fluidSphPrimitive);
    const inst = fluidSphPrimitive.create(target);

    // Early frame: particles still high (just started falling).
    inst.seek(0.05);
    const yEarly = particleY(target, 0);

    // Mid frame: gravity has pulled the blob down.
    inst.seek(0.6);
    const yMid = particleY(target, 0);

    // Late/settled frame: pooled near the floor.
    inst.seek(3.5);
    const yLate = particleY(target, 0);

    // A concrete numeric drop: the particle is clearly lower mid-fall than at
    // the start, and lower still (or at rest near the floor) once settled.
    expect(yEarly).toBeGreaterThan(yMid + 0.1);
    expect(yMid).toBeGreaterThan(yLate - 0.01);
    // It came to rest above the basin floor, not through it.
    expect(yLate).toBeGreaterThan(-1.4);
    inst.dispose();
  });

  it('controls change output: low vs high gravity reach different depths mid-fall', () => {
    // Low gravity → particle is still high at a fixed early time.
    const t1 = makeTarget(fluidSphPrimitive);
    const i1 = fluidSphPrimitive.create(t1);
    i1.setControl('gravity', 0.5);
    i1.seek(0.5);
    const yLowG = particleY(t1, 0);
    i1.dispose();

    // High gravity → same time, particle has dropped much further.
    const t2 = makeTarget(fluidSphPrimitive);
    const i2 = fluidSphPrimitive.create(t2);
    i2.setControl('gravity', 8);
    i2.seek(0.5);
    const yHighG = particleY(t2, 0);
    // sanity: also exercise an X read so a horizontal slosh is observed at all.
    const xHighG = particleX(t2, 0);
    i2.dispose();

    // Distinct numeric outputs: stronger gravity reaches lower at the same t.
    expect(yLowG).toBeGreaterThan(yHighG + 0.2);
    expect(Number.isFinite(xHighG)).toBe(true);
  });
});
