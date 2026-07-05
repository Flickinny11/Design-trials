import { describe, it, expect } from 'vitest';
import { Group, Mesh } from 'three';
import { crumblePrimitive } from '@/lib/prism/animatable/primitives/crumble';
import { makeTarget, runConformance } from './_conformance';

/** Find the fragment group the primitive builds into target.object. */
function fragGroup(object: { children: { name?: string }[] }): Group {
  const g = (object.children as unknown[]).find(
    (c) => (c as { name?: string }).name === 'crumble-fragments',
  ) as Group | undefined;
  if (!g) throw new Error('crumble fragment group not found');
  return g;
}

/** A visible fragment's y position, for a stable observed fragment. */
function firstVisibleFragY(g: Group): number {
  const m = g.children.find((c) => (c as Mesh).visible) as Mesh;
  return m.position.y;
}

describe('crumble primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crumblePrimitive).dispose();
  });

  it('plays: fragments fall (position.y decreases) over the timeline', () => {
    const target = makeTarget(crumblePrimitive);
    const inst = crumblePrimitive.create(target);
    const g = fragGroup(target.object as unknown as { children: { name?: string }[] });
    const dur = inst.duration();

    // Drive to a mid frame and capture a specific fragment's y + opacity.
    inst.seek(dur * 0.5);
    const probe = g.children.find((c) => (c as Mesh).visible) as Mesh;
    const yMid = probe.position.y;
    const opMid = (probe.material as { opacity: number }).opacity;

    // Drive to the end: the same fragment must have fallen further (lower y) and
    // faded more.
    inst.seek(dur);
    const yEnd = probe.position.y;
    const opEnd = (probe.material as { opacity: number }).opacity;

    expect(yEnd).toBeLessThan(yMid - 0.05);
    expect(opEnd).toBeLessThan(opMid);
    inst.dispose();
  });

  it('controls change output: higher gravity makes fragments fall further', () => {
    const target = makeTarget(crumblePrimitive);
    const inst = crumblePrimitive.create(target);
    const g = fragGroup(target.object as unknown as { children: { name?: string }[] });
    const dur = inst.duration();

    inst.setControl('gravity', 0.5);
    inst.seek(dur);
    const yLowG = firstVisibleFragY(g);

    inst.setControl('gravity', 6);
    inst.seek(dur);
    const yHighG = firstVisibleFragY(g);

    // Stronger gravity => fell further => lower y.
    expect(yHighG).toBeLessThan(yLowG - 0.3);
    inst.dispose();
  });
});
