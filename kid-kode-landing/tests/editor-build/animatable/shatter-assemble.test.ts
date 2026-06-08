import { describe, it, expect } from 'vitest';
import { Group, Mesh, type Material } from 'three';
import { shatterAssemblePrimitive } from '@/lib/prism/animatable/primitives/shatter-assemble';
import { makeTarget, runConformance } from './_conformance';

/** Pull the live fragment group the primitive builds into target.object. */
function fragGroup(object: { children: unknown[] }): Group {
  const g = (object.children as Group[]).find(
    (c) => (c as Group).name === 'shatter-assemble-fragments',
  );
  if (!g) throw new Error('fragment group not found');
  return g as Group;
}

describe('shatter-assemble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(shatterAssemblePrimitive).dispose();
  });

  it('plays: a fragment converges toward its rest position across the timeline', () => {
    const target = makeTarget(shatterAssemblePrimitive);
    const inst = shatterAssemblePrimitive.create(target);
    const dur = inst.duration();
    const group = fragGroup(target.object as unknown as { children: unknown[] });
    // Pick the corner shard (index 0) — it has the largest outward offset, so
    // its convergence is unambiguous.
    const shard = group.children[0] as Mesh;

    inst.seek(0);
    const early = { x: shard.position.x, y: shard.position.y };
    const distEarly = Math.hypot(early.x, early.y);

    inst.seek(dur);
    const late = { x: shard.position.x, y: shard.position.y };
    const distLate = Math.hypot(late.x, late.y);

    // The shard flies inward: its distance from card centre shrinks markedly.
    expect(distEarly).toBeGreaterThan(distLate + 0.3);
    // And it actually moved (position changed) between the two frames.
    expect(Math.hypot(late.x - early.x, late.y - early.y)).toBeGreaterThan(0.1);

    // Opacity ramps in across the assembly.
    const mat = shard.material as Material & { opacity: number };
    inst.seek(0);
    const op0 = mat.opacity;
    inst.seek(dur);
    const opEnd = mat.opacity;
    expect(opEnd).toBeGreaterThan(op0);

    inst.dispose();
  });

  it('controls change output: larger scatter means larger initial offset', () => {
    const target = makeTarget(shatterAssemblePrimitive);
    const inst = shatterAssemblePrimitive.create(target);
    const group = fragGroup(target.object as unknown as { children: unknown[] });
    const shard = group.children[0] as Mesh;

    inst.setControl('scatter', 1);
    inst.seek(0);
    const small = Math.hypot(shard.position.x, shard.position.y);

    inst.setControl('scatter', 6);
    inst.seek(0);
    const large = Math.hypot(shard.position.x, shard.position.y);

    expect(large).toBeGreaterThan(small + 0.3);
    inst.dispose();
  });
});
