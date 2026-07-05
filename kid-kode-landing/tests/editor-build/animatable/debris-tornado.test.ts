import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { debrisTornadoPrimitive } from '@/lib/prism/animatable/primitives/debris-tornado';
import { makeTarget, runConformance } from './_conformance';

/** Grab the position attribute of the Points the primitive built. */
function posAttr(target: ReturnType<typeof makeTarget>): BufferAttribute {
  let points: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) points = o as Points;
  });
  if (!points) throw new Error('no Points built');
  return (points as Points).geometry.getAttribute('position') as BufferAttribute;
}

describe('debris-tornado primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(debrisTornadoPrimitive).dispose();
  });

  it('plays: a particle spirals upward across two distinct times', () => {
    const target = makeTarget(debrisTornadoPrimitive);
    const inst = debrisTornadoPrimitive.create(target);
    const attr = posAttr(target);

    // Pick a particle and capture its full position across two times.
    const idx = 7;
    inst.seek(0);
    const x0 = attr.getX(idx);
    const y0 = attr.getY(idx);
    const z0 = attr.getZ(idx);

    inst.seek(1.7);
    const x1 = attr.getX(idx);
    const y1 = attr.getY(idx);
    const z1 = attr.getZ(idx);

    // The particle visibly moved (angle/height changed) between the two frames.
    const moved =
      Math.abs(x1 - x0) + Math.abs(y1 - y0) + Math.abs(z1 - z0);
    expect(moved).toBeGreaterThan(0.05);
    // Specifically the height phase advanced (vertical motion present).
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.001);
    inst.dispose();
  });

  it('controls change output: more swirl twists a particle to a new angle', () => {
    const target = makeTarget(debrisTornadoPrimitive);
    const inst = debrisTornadoPrimitive.create(target);
    const attr = posAttr(target);
    const idx = 13;

    inst.setControl('swirl', 0.2);
    inst.seek(2.0);
    const xLow = attr.getX(idx);
    const zLow = attr.getZ(idx);

    inst.setControl('swirl', 6);
    inst.seek(2.0);
    const xHigh = attr.getX(idx);
    const zHigh = attr.getZ(idx);

    // A different swirl rate places the particle at a different angle (x/z).
    const diff = Math.abs(xHigh - xLow) + Math.abs(zHigh - zLow);
    expect(diff).toBeGreaterThan(0.05);
    inst.dispose();
  });
});
