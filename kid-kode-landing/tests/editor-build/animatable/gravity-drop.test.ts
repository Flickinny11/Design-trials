import { describe, it, expect } from 'vitest';
import { Points, BufferAttribute } from 'three';
import { gravityDropPrimitive } from '@/lib/prism/animatable/primitives/gravity-drop';
import { makeTarget, runConformance } from './_conformance';

/** Find the Points object the primitive builds into target.object. */
function findPoints(obj: { children: unknown[] }): Points {
  const p = (obj.children as unknown[]).find((c) => c instanceof Points) as Points | undefined;
  if (!p) throw new Error('gravity-drop did not build a THREE.Points');
  return p;
}

describe('gravity-drop primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(gravityDropPrimitive).dispose();
  });

  it('plays: a particle falls then bounces (y dips below an early-frame value)', () => {
    const target = makeTarget(gravityDropPrimitive);
    const inst = gravityDropPrimitive.create(target);
    const points = findPoints(target.object as unknown as { children: unknown[] });
    const attr = points.geometry.getAttribute('position') as BufferAttribute;

    // Track one particle's y across the timeline; with gravity it must drop, and
    // because of the floor + restitution it must bounce back up at some point.
    inst.seek(0);
    const yStart = attr.getY(0);

    let yMin = Infinity;
    let bouncedUp = false;
    let prevY = yStart;
    for (let i = 1; i <= 40; i++) {
      inst.seek((i / 40) * 4);
      const y = attr.getY(0);
      if (y < yMin) yMin = y;
      // a rise after having descended below the start => a bounce occurred
      if (y > prevY + 1e-4 && prevY < yStart - 0.1) bouncedUp = true;
      prevY = y;
    }

    // descended meaningfully below where it began
    expect(yMin).toBeLessThan(yStart - 0.3);
    // and at some later frame moved back up (bounce)
    expect(bouncedUp).toBe(true);
    inst.dispose();
  });

  it('controls change output: lower gravity = particle is higher at a fixed time', () => {
    const target = makeTarget(gravityDropPrimitive);
    const inst = gravityDropPrimitive.create(target);
    const points = findPoints(target.object as unknown as { children: unknown[] });
    const attr = points.geometry.getAttribute('position') as BufferAttribute;

    inst.setControl('gravity', 18);
    inst.seek(0.5);
    const yHighG = attr.getY(0);

    inst.setControl('gravity', 1);
    inst.seek(0.5);
    const yLowG = attr.getY(0);

    // Under weaker gravity the particle has fallen less, so it sits higher.
    expect(yLowG).toBeGreaterThan(yHighG + 0.2);
    inst.dispose();
  });
});
