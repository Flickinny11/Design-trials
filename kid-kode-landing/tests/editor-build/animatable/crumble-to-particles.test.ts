import { describe, it, expect } from 'vitest';
import { Mesh, Points, type Material } from 'three';
import { crumbleToParticlesPrimitive } from '@/lib/prism/animatable/primitives/crumble-to-particles';
import { makeTarget, runConformance } from './_conformance';

function findPoints(obj: { children: unknown[] }): Points {
  const pts = (obj.children as Points[]).find((c) => (c as Points).isPoints);
  if (!pts) throw new Error('no Points cloud built into target.object');
  return pts;
}

describe('crumble-to-particles primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(crumbleToParticlesPrimitive).dispose();
  });

  it('plays: points drift and the card opacity drops across the timeline', () => {
    const target = makeTarget(crumbleToParticlesPrimitive);
    const inst = crumbleToParticlesPrimitive.create(target);
    const card = target.subject as Mesh;
    const cardMat = card.material as Material & { opacity: number };
    const pts = findPoints(target.object as unknown as { children: unknown[] });
    const posArr = pts.geometry.getAttribute('position').array as Float32Array;
    const dur = inst.duration();

    // Early frame: grid intact, card fully opaque.
    inst.seek(0);
    const cardOp0 = cardMat.opacity;
    // Sample a representative point (index near the edge, definitely active).
    const k = 10;
    const x0 = posArr[k * 3];
    const y0 = posArr[k * 3 + 1];

    // Late frame: points have drifted, card faded.
    inst.seek(dur * 0.95);
    const cardOpLate = cardMat.opacity;
    const xLate = posArr[k * 3];
    const yLate = posArr[k * 3 + 1];

    // A point position element changes across phase.
    const moved = Math.hypot(xLate - x0, yLate - y0);
    expect(moved).toBeGreaterThan(0.1);
    // Subject opacity drops as it dissolves.
    expect(cardOp0).toBeGreaterThan(cardOpLate + 0.3);

    inst.dispose();
    // Disposed: card restored to opaque.
    expect(cardMat.opacity).toBe(1);
  });

  it('controls change output: larger spread means farther drift', () => {
    const sampleDrift = (spread: number): number => {
      const target = makeTarget(crumbleToParticlesPrimitive);
      const inst = crumbleToParticlesPrimitive.create(target);
      const pts = findPoints(target.object as unknown as { children: unknown[] });
      const posArr = pts.geometry.getAttribute('position').array as Float32Array;
      const dur = inst.duration();
      const k = 10;

      inst.seek(0);
      const x0 = posArr[k * 3];
      const y0 = posArr[k * 3 + 1];

      inst.setControl('spread', spread);
      inst.seek(dur * 0.9);
      const drift = Math.hypot(posArr[k * 3] - x0, posArr[k * 3 + 1] - y0);
      inst.dispose();
      return drift;
    };

    const small = sampleDrift(1);
    const large = sampleDrift(6);
    expect(large).toBeGreaterThan(small + 0.3);
  });
});
