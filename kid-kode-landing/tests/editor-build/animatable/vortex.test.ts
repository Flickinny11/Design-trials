import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { vortexPrimitive } from '@/lib/prism/animatable/primitives/vortex';
import { makeTarget, runConformance } from './_conformance';

/** Read the position attribute of the generated Points cloud. */
function posArray(target: ReturnType<typeof makeTarget>): Float32Array {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('vortex did not build a Points cloud');
  const attr = (pts as Points).geometry.getAttribute('position') as BufferAttribute;
  return attr.array as Float32Array;
}

describe('vortex primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(vortexPrimitive).dispose();
  });

  it('plays: a particle spirals — its position changes across the timeline', () => {
    const target = makeTarget(vortexPrimitive);
    const inst = vortexPrimitive.create(target);
    const arr = posArray(target);

    inst.seek(0);
    const x0 = arr[0];
    const z0 = arr[2];

    inst.seek(1.5);
    const xMid = arr[0];
    const zMid = arr[2];

    // The particle has visibly moved in the x/z plane between t=0 and t=1.5.
    const moved = Math.hypot(xMid - x0, zMid - z0);
    expect(moved).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('inner particles spin faster than outer ones (whirlpool shear)', () => {
    // Angular displacement over the same dt should be larger for a particle
    // currently near the eye than for one near the rim. We compare the angle
    // change of the innermost vs outermost active particle.
    const target = makeTarget(vortexPrimitive);
    const inst = vortexPrimitive.create(target);
    const arr = posArray(target);

    inst.seek(0);
    // snapshot radius + angle for every active particle
    const count = 320; // default
    const snap: { r: number; a: number; i: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3];
      const z = arr[i * 3 + 2];
      snap.push({ r: Math.hypot(x, z), a: Math.atan2(z, x), i });
    }
    snap.sort((p, q) => p.r - q.r);
    const inner = snap[0];
    const outer = snap[snap.length - 1];

    const dt = 0.05;
    inst.seek(dt);
    const angAfter = (i: number) =>
      Math.atan2(arr[i * 3 + 2], arr[i * 3]);
    const wrap = (d: number) => {
      let x = d;
      while (x > Math.PI) x -= 2 * Math.PI;
      while (x < -Math.PI) x += 2 * Math.PI;
      return Math.abs(x);
    };
    const dInner = wrap(angAfter(inner.i) - inner.a);
    const dOuter = wrap(angAfter(outer.i) - outer.a);

    expect(dInner).toBeGreaterThan(dOuter);
    inst.dispose();
  });

  it('controls change output: higher swirl produces faster angular motion', () => {
    const target = makeTarget(vortexPrimitive);
    const inst = vortexPrimitive.create(target);
    const arr = posArray(target);

    const angleOf = () => Math.atan2(arr[2], arr[0]);
    const wrap = (d: number) => {
      let x = d;
      while (x > Math.PI) x -= 2 * Math.PI;
      while (x < -Math.PI) x += 2 * Math.PI;
      return Math.abs(x);
    };

    const dt = 0.04;
    inst.setControl('swirl', 0.2);
    inst.seek(0);
    const aSlow0 = angleOf();
    inst.seek(dt);
    const slow = wrap(angleOf() - aSlow0);

    inst.setControl('swirl', 6);
    inst.seek(0);
    const aFast0 = angleOf();
    inst.seek(dt);
    const fast = wrap(angleOf() - aFast0);

    expect(fast).toBeGreaterThan(slow);
    inst.dispose();
  });
});
