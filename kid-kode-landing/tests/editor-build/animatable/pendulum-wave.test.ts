import { describe, it, expect } from 'vitest';
import { Points, type BufferGeometry } from 'three';
import { pendulumWavePrimitive } from '@/lib/prism/animatable/primitives/pendulum-wave';
import { makeTarget, runConformance } from './_conformance';

/** Read the position attribute of the THREE.Points the primitive builds. */
function posArray(target: ReturnType<typeof makeTarget>): Float32Array {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  expect(pts, 'primitive built a THREE.Points').not.toBeNull();
  const geo = (pts as unknown as Points).geometry as BufferGeometry;
  return geo.getAttribute('position').array as Float32Array;
}

describe('pendulum-wave primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pendulumWavePrimitive).dispose();
  });

  it('plays: a bob moves across time and bobs are out of phase', () => {
    const target = makeTarget(pendulumWavePrimitive);
    const inst = pendulumWavePrimitive.create(target);
    const arr = posArray(target);

    // bob #0 x at two distinct times (looping → pick two t values).
    inst.seek(0);
    const x0_a = arr[0];
    inst.seek(1.7);
    const x0_b = arr[0];

    // A bob's position changes across two t.
    expect(Math.abs(x0_b - x0_a)).toBeGreaterThan(0.01);

    // Different bobs are out of phase: at a fixed t, bob #0 and a later bob
    // sit at different swing positions (distinct local x offset from pivot).
    inst.seek(0.9);
    const x0 = arr[0];
    const x5 = arr[5 * 3];
    // their pivots differ by design; check the *swing offset* (x - pivotX)
    // differs, which only happens if they are at different phases.
    const pivot0 = -3.2 / 2; // ROW_WIDTH/2, count default 18 → pivot of i=0
    const pivot5 = -3.2 / 2 + (5 / (18 - 1)) * 3.2;
    const swing0 = x0 - pivot0;
    const swing5 = x5 - pivot5;
    expect(Math.abs(swing0 - swing5)).toBeGreaterThan(0.001);

    inst.dispose();
  });

  it('controls change output: larger speed advances the swing further per unit time', () => {
    const target = makeTarget(pendulumWavePrimitive);
    const inst = pendulumWavePrimitive.create(target);
    const arr = posArray(target);

    // At slow speed, bob #0 has barely moved by a small t.
    inst.setControl('speed', 0.1);
    inst.seek(0);
    const baseY = arr[1];
    inst.seek(0.4);
    const slowDelta = Math.abs(arr[1] - baseY);

    // At fast speed, the same small t advances the swing much further.
    inst.setControl('speed', 3);
    inst.seek(0);
    const baseY2 = arr[1];
    inst.seek(0.4);
    const fastDelta = Math.abs(arr[1] - baseY2);

    expect(fastDelta).toBeGreaterThan(slowDelta + 0.001);
    inst.dispose();
  });
});
