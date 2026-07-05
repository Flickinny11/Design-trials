import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { galaxyParticlesPrimitive } from '@/lib/prism/animatable/primitives/galaxy-particles';
import { makeTarget, runConformance } from './_conformance';

/** Find the generated THREE.Points the primitive added to target.object. */
function findPoints(object: { children: unknown[] }): Points {
  const pts = (object.children as unknown[]).find((c) => c instanceof Points);
  expect(pts, 'primitive built a THREE.Points').toBeTruthy();
  return pts as Points;
}

describe('galaxy-particles primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(galaxyParticlesPrimitive).dispose();
  });

  it('plays: stars rotate (a position changes across two times)', () => {
    const target = makeTarget(galaxyParticlesPrimitive);
    const inst = galaxyParticlesPrimitive.create(target);
    const pts = findPoints(target.object);
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;

    inst.seek(0);
    const x0 = attr.getX(7);
    const z0 = attr.getZ(7);

    inst.seek(1.5);
    const xMid = attr.getX(7);
    const zMid = attr.getZ(7);

    // The star at index 7 moved along the disk between the two frames (rotation).
    const moved = Math.hypot(xMid - x0, zMid - z0);
    expect(moved).toBeGreaterThan(0.05);

    // Radius is preserved (rotation, not inward collapse) — distinct from vortex.
    const r0 = Math.hypot(x0, z0);
    const rMid = Math.hypot(xMid, zMid);
    expect(Math.abs(rMid - r0)).toBeLessThan(1e-4);

    inst.dispose();
  });

  it('controls change output: more spin means more rotation in a fixed time', () => {
    const target = makeTarget(galaxyParticlesPrimitive);
    const inst = galaxyParticlesPrimitive.create(target);
    const pts = findPoints(target.object);
    const attr = pts.geometry.getAttribute('position') as BufferAttribute;

    // Reference position at t=0 (independent of spin).
    inst.seek(0);
    const x0 = attr.getX(3);
    const z0 = attr.getZ(3);

    inst.setControl('spin', 0.1);
    inst.seek(1.5);
    const slow = Math.hypot(attr.getX(3) - x0, attr.getZ(3) - z0);

    inst.setControl('spin', 4);
    inst.seek(1.5);
    const fast = Math.hypot(attr.getX(3) - x0, attr.getZ(3) - z0);

    expect(fast).toBeGreaterThan(slow + 0.05);
    inst.dispose();
  });
});
