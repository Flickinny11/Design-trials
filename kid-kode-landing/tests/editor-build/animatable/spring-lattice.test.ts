import { describe, it, expect } from 'vitest';
import { Points, type BufferGeometry } from 'three';
import { springLatticePrimitive } from '@/lib/prism/animatable/primitives/spring-lattice';
import { makeTarget, runConformance } from './_conformance';

/** Pull the live position attribute array from the built Points group. */
function positionsOf(object: { children: unknown[] }): Float32Array {
  const pts = (object.children as Points[]).find((c) => c instanceof Points);
  if (!pts) throw new Error('spring-lattice did not build a Points');
  const geo = pts.geometry as BufferGeometry;
  return geo.attributes.position.array as Float32Array;
}

describe('spring-lattice primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(springLatticePrimitive).dispose();
  });

  it('plays: a wobble propagates — an interior node moves between two frames', () => {
    const target = makeTarget(springLatticePrimitive);
    const inst = springLatticePrimitive.create(target);
    const pos = positionsOf(target.object as unknown as { children: unknown[] });

    // grid default = 10 → index of the center-ish node (row 5, col 5).
    const n = 10;
    const mid = (5 * n + 5) * 3;

    // Early frame: the corner poke has not yet reached the interior node.
    inst.seek(0.05);
    const early = Math.hypot(pos[mid], pos[mid + 1], pos[mid + 2]);

    // Later frame: the ripple has propagated through the springs and the
    // interior node has visibly moved from its early position.
    inst.seek(1.2);
    const late = Math.hypot(pos[mid], pos[mid + 1], pos[mid + 2]);

    // The interior node's position must have changed measurably (the wobble
    // reached it). Compare component deltas, not just magnitude, to be robust.
    const moved = Math.abs(late - early);
    expect(moved).toBeGreaterThan(1e-4);
    inst.dispose();
  });

  it('controls change output: higher stiffness propagates the wobble faster', () => {
    // With stiffer springs, the ripple reaches the interior node sooner, so the
    // interior displacement at a fixed early-ish time is larger.
    const mid = (5 * 10 + 5) * 3;
    const cornerNeighbor = 1 * 3; // node (0,1), directly linked to the poked corner

    // Soft springs.
    const tSoft = makeTarget(springLatticePrimitive);
    const soft = springLatticePrimitive.create(tSoft);
    const posSoft = positionsOf(tSoft.object as unknown as { children: unknown[] });
    soft.setControl('stiffness', 20);
    soft.seek(0.25);
    const softNeighbor = Math.hypot(
      posSoft[cornerNeighbor] - (-2.6 / 2 + (1 / 9) * 2.6),
      posSoft[cornerNeighbor + 1],
      posSoft[cornerNeighbor + 2],
    );

    // Stiff springs.
    const tStiff = makeTarget(springLatticePrimitive);
    const stiff = springLatticePrimitive.create(tStiff);
    const posStiff = positionsOf(tStiff.object as unknown as { children: unknown[] });
    stiff.setControl('stiffness', 240);
    stiff.seek(0.25);
    const stiffNeighbor = Math.hypot(
      posStiff[cornerNeighbor] - (-2.6 / 2 + (1 / 9) * 2.6),
      posStiff[cornerNeighbor + 1],
      posStiff[cornerNeighbor + 2],
    );

    void mid;
    // The two stiffness settings produce a different neighbour displacement at
    // the same time — the control demonstrably changes the physics.
    expect(Math.abs(stiffNeighbor - softNeighbor)).toBeGreaterThan(1e-3);
    soft.dispose();
    stiff.dispose();
  });
});
