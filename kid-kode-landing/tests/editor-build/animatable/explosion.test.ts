import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { explosionPrimitive } from '@/lib/prism/animatable/primitives/explosion';
import { makeTarget, runConformance } from './_conformance';

// Radial distance of particle `i` from the origin in the position buffer.
function radius(arr: ArrayLike<number>, i: number): number {
  const x = arr[i * 3];
  const y = arr[i * 3 + 1];
  const z = arr[i * 3 + 2];
  return Math.hypot(x, y, z);
}

function posArray(target: ReturnType<typeof makeTarget>): Float32Array {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('explosion did not build a Points object');
  const attr = (pts as Points).geometry.getAttribute('position') as BufferAttribute;
  return attr.array as Float32Array;
}

describe('explosion primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(explosionPrimitive).dispose();
  });

  it('plays: a particle bursts outward then plateaus, and opacity fades', () => {
    const target = makeTarget(explosionPrimitive);
    const inst = explosionPrimitive.create(target);
    const dur = inst.duration();

    // At t=0 every emitted particle sits at the center.
    inst.seek(0);
    const pos0 = posArray(target).slice();
    const r0 = radius(pos0, 0);

    // Mid-animation: the particle has flown outward.
    inst.seek(dur * 0.35);
    const posMid = posArray(target).slice();
    const rMid = radius(posMid, 0);

    // Late: still expanded (plateaued near the same reach, not collapsed back).
    inst.seek(dur);
    const posEnd = posArray(target).slice();
    const rEnd = radius(posEnd, 0);

    // radial distance grows from ~0
    expect(rMid).toBeGreaterThan(r0 + 0.2);
    // and plateaus: the late radius is close to the mid radius (burst decelerated)
    expect(rEnd).toBeGreaterThan(rMid * 0.6);

    // opacity fades from full at the burst toward the end.
    // Reach into the rendered material via the Points object.
    let opMid = 1;
    let opEnd = 1;
    target.object.traverse((o) => {
      const m = (o as Points).material as { opacity?: number };
      if (m && typeof m.opacity === 'number') {
        // captured after the last seek(dur); re-seek to sample both points
      }
    });
    inst.seek(dur * 0.35);
    target.object.traverse((o) => {
      const m = (o as Points).material as { opacity?: number };
      if (m && typeof m.opacity === 'number') opMid = m.opacity;
    });
    inst.seek(dur);
    target.object.traverse((o) => {
      const m = (o as Points).material as { opacity?: number };
      if (m && typeof m.opacity === 'number') opEnd = m.opacity;
    });
    expect(opMid).toBeGreaterThan(opEnd + 0.1);

    inst.dispose();
  });

  it('controls change output: higher power means a larger radial reach', () => {
    const target = makeTarget(explosionPrimitive);
    const inst = explosionPrimitive.create(target);
    const dur = inst.duration();

    inst.setControl('power', 0.5);
    inst.seek(dur * 0.5);
    const small = radius(posArray(target), 0);

    inst.setControl('power', 5);
    inst.seek(dur * 0.5);
    const large = radius(posArray(target), 0);

    expect(large).toBeGreaterThan(small + 0.5);
    inst.dispose();
  });
});
