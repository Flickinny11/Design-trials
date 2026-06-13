import { describe, it, expect } from 'vitest';
import { Sprite } from 'three';
import type { InstancedBufferAttribute } from 'three';
import { ropeDangleSimPrimitive } from '@/lib/prism/animatable/primitives/rope-dangle-sim';
import { makeTarget, runConformance } from './_conformance';

// The rope renders as an instanced THREE.Sprite (catalog-proven node-material
// path) named 'rope-dangle-sim' whose 'instancePosition' attribute holds the
// per-bead centres sampled along the live XPBD cord. These helpers read those
// bead centres — they track exactly where the rope hangs/swings, the same signal
// the old tube-vertex helpers measured. (Render representation changed; the
// physics assertions below are UNCHANGED.)

/** Pull the live per-bead instancePosition attribute from the rope Sprite. */
function beadPosOf(object: { children: unknown[] }): InstancedBufferAttribute {
  const sprite = (object.children as Sprite[]).find(
    (c) => c instanceof Sprite && c.name === 'rope-dangle-sim',
  );
  if (!sprite) throw new Error('rope-dangle-sim did not build its bead Sprite');
  const attr = sprite.geometry.getAttribute('instancePosition') as InstancedBufferAttribute;
  if (!attr) throw new Error('rope-dangle-sim Sprite has no instancePosition attribute');
  return attr;
}

/** The mean (centroid) x of the cord beads — tracks where the rope hangs. */
function centroidX(attr: InstancedBufferAttribute): number {
  const arr = attr.array as ArrayLike<number>;
  let sum = 0;
  const n = arr.length / 3;
  for (let i = 0; i < arr.length; i += 3) sum += arr[i];
  return sum / n;
}

/** The minimum y of the cord beads — the free (hanging) end. */
function minY(attr: InstancedBufferAttribute): number {
  const arr = attr.array as ArrayLike<number>;
  let lo = Infinity;
  for (let i = 1; i < arr.length; i += 3) lo = Math.min(lo, arr[i]);
  return lo;
}

describe('rope-dangle-sim primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(ropeDangleSimPrimitive).dispose();
  });

  it('plays: the rope hangs under gravity and swings with momentum (centroid sweeps)', () => {
    const target = makeTarget(ropeDangleSimPrimitive);
    const inst = ropeDangleSimPrimitive.create(target);

    inst.seek(0);
    const geo0 = beadPosOf(target.object as unknown as { children: unknown[] });
    const startMinY = minY(geo0);

    // Sample the centroid x across the timeline; a real swing means the rope's
    // horizontal centre travels back and forth (sign changes in the per-frame
    // delta), not a monotone drift — momentum carries it past centre.
    const dt = 1 / 60;
    let prevCx = centroidX(beadPosOf(target.object as unknown as { children: unknown[] }));
    let prevDelta = 0;
    let reversals = 0;
    let maxCx = -Infinity;
    let minCx = Infinity;
    let lowestY = startMinY;
    for (let k = 1; k <= 200; k++) {
      inst.seek(k * dt);
      const geo = beadPosOf(target.object as unknown as { children: unknown[] });
      const cx = centroidX(geo);
      lowestY = Math.min(lowestY, minY(geo));
      const delta = cx - prevCx;
      maxCx = Math.max(maxCx, cx);
      minCx = Math.min(minCx, cx);
      if (k > 2 && Math.sign(delta) !== Math.sign(prevDelta) && Math.abs(delta) > 1e-5) {
        reversals++;
      }
      if (Math.abs(delta) > 1e-5) prevDelta = delta;
      prevCx = cx;
    }

    // It actually hangs: the free end is well below the anchor (~1.15) — gravity
    // pulled the chain down.
    expect(lowestY).toBeLessThan(0.4);
    // It actually swings across a real horizontal span (not a static drape).
    expect(maxCx - minCx).toBeGreaterThan(0.2);
    // Momentum: the centre reverses direction multiple times (swings back and
    // forth), which a kinematic one-way drift would never do.
    expect(reversals).toBeGreaterThan(2);

    inst.dispose();
  });

  it('control live at frozen pin: gravity reshapes the pinned frame (markDirty works)', () => {
    const target = makeTarget(ropeDangleSimPrimitive);
    const inst = ropeDangleSimPrimitive.create(target);

    // Pin a representative engaged frame mid-swing (phase ~0.45 of 3.0s).
    const PIN = 1.35;

    // Low gravity: the rope hangs slacker / swings differently than high gravity.
    inst.setControl('gravity', 3);
    inst.seek(PIN);
    const lowG = minY(beadPosOf(target.object as unknown as { children: unknown[] }));

    inst.setControl('gravity', 22);
    inst.seek(PIN);
    const highG = minY(beadPosOf(target.object as unknown as { children: unknown[] }));

    // Same pinned t, different gravity → the frozen frame visibly differs (the
    // reset-replay + markDirty makes every control a standing function of the pin).
    expect(Math.abs(highG - lowG)).toBeGreaterThan(1e-3);

    // Stiffness is likewise live at the pin (swings the rope into a different
    // shape — centroid shifts).
    inst.setControl('stiffness', 0.25);
    inst.seek(PIN);
    const soft = centroidX(beadPosOf(target.object as unknown as { children: unknown[] }));
    inst.setControl('stiffness', 1);
    inst.seek(PIN);
    const stiff = centroidX(beadPosOf(target.object as unknown as { children: unknown[] }));
    expect(Math.abs(stiff - soft)).toBeGreaterThan(1e-3);

    inst.dispose();
  });
});
