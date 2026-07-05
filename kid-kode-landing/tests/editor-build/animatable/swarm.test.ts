import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { swarmPrimitive } from '@/lib/prism/animatable/primitives/swarm';
import { makeTarget, runConformance } from './_conformance';

/** Pull the swarm's position attribute out of the built THREE.Points. */
function positionsOf(object: { children: unknown[] }): BufferAttribute {
  const pts = (object.children as unknown[]).find(
    (c): c is Points => c instanceof Points,
  );
  if (!pts) throw new Error('swarm did not build a THREE.Points');
  return pts.geometry.getAttribute('position') as BufferAttribute;
}

describe('swarm primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(swarmPrimitive).dispose();
  });

  it('plays: a particle position element changes across two t (deterministic)', () => {
    const target = makeTarget(swarmPrimitive);
    const inst = swarmPrimitive.create(target);
    const attr = positionsOf(target.object as { children: unknown[] });

    inst.seek(0);
    const early = attr.getX(7);

    inst.seek(2.5);
    const late = attr.getX(7);

    // The flow field + drifting attractor moved this particle observably.
    expect(Math.abs(late - early)).toBeGreaterThan(0.05);

    // Deterministic: reseeking the same t reproduces the same position.
    inst.seek(2.5);
    expect(attr.getX(7)).toBeCloseTo(late, 10);

    inst.dispose();
  });

  it('controls change output: spread scales the field displacement', () => {
    const target = makeTarget(swarmPrimitive);
    const inst = swarmPrimitive.create(target);
    const attr = positionsOf(target.object as { children: unknown[] });

    // Kill cohesion so the difference is purely the spread-scaled field.
    inst.setControl('cohesion', 0);

    inst.setControl('spread', 0);
    inst.seek(1.3);
    const x0 = attr.getX(11);
    const y0 = attr.getY(11);
    const z0 = attr.getZ(11);

    inst.setControl('spread', 1.5);
    inst.seek(1.3);
    const x1 = attr.getX(11);
    const y1 = attr.getY(11);
    const z1 = attr.getZ(11);

    const delta = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    expect(delta).toBeGreaterThan(0.1);

    inst.dispose();
  });
});
