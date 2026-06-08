import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { orbitRingsPrimitive } from '@/lib/prism/animatable/primitives/orbit-rings';
import { makeTarget, runConformance } from './_conformance';

/** Pull the position BufferAttribute of the THREE.Points the primitive built. */
function posAttr(target: ReturnType<typeof makeTarget>): BufferAttribute {
  let found: BufferAttribute | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) {
      found = (o as Points).geometry.getAttribute('position') as BufferAttribute;
    }
  });
  if (!found) throw new Error('no Points geometry found');
  return found;
}

const angleOf = (a: BufferAttribute, i: number) =>
  Math.atan2(a.getZ(i), a.getX(i));
const radiusOf = (a: BufferAttribute, i: number) =>
  Math.hypot(a.getX(i), a.getZ(i));

/** Smallest absolute angular delta (handles wraparound at ±π). */
const angDelta = (a: number, b: number) => {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
};

describe('orbit-rings primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(orbitRingsPrimitive).dispose();
  });

  it('plays: particles orbit and inner band sweeps faster than outer', () => {
    const target = makeTarget(orbitRingsPrimitive);
    const inst = orbitRingsPrimitive.create(target);
    inst.setControl('rings', 5);
    inst.setControl('speed', 2);

    const a = posAttr(target);

    inst.seek(0);
    // Find one clearly-inner and one clearly-outer particle by radius.
    let inner = 0;
    let outer = 0;
    let rMin = Infinity;
    let rMax = -Infinity;
    for (let i = 0; i < a.count; i++) {
      const r = radiusOf(a, i);
      if (r < rMin) { rMin = r; inner = i; }
      if (r > rMax) { rMax = r; outer = i; }
    }

    const innerA0 = angleOf(a, inner);
    const outerA0 = angleOf(a, outer);
    const innerX0 = a.getX(inner);
    const innerZ0 = a.getZ(inner);

    inst.seek(0.5);
    const innerX1 = a.getX(inner);
    const innerZ1 = a.getZ(inner);

    // A particle's position visibly moved between two t values.
    const moved = Math.hypot(innerX1 - innerX0, innerZ1 - innerZ0);
    expect(moved).toBeGreaterThan(0.02);

    const innerSweep = angDelta(angleOf(a, inner), innerA0);
    const outerSweep = angDelta(angleOf(a, outer), outerA0);

    // Keplerian: the inner band advances more angle than the outer band.
    expect(innerSweep).toBeGreaterThan(outerSweep + 0.05);

    inst.dispose();
  });

  it('controls change output: tilt knob changes vertical spread', () => {
    const target = makeTarget(orbitRingsPrimitive);
    const inst = orbitRingsPrimitive.create(target);
    const a = posAttr(target);

    const spreadY = () => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < a.count; i++) {
        const y = a.getY(i);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      return hi - lo;
    };

    inst.setControl('tilt', 0);
    inst.seek(1);
    const flat = spreadY();

    inst.setControl('tilt', 0.6);
    inst.seek(1);
    const tilted = spreadY();

    expect(tilted).toBeGreaterThan(flat + 0.1);
    inst.dispose();
  });
});
