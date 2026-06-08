import { describe, it, expect } from 'vitest';
import { Points } from 'three';
import { meteorShowerPrimitive } from '@/lib/prism/animatable/primitives/meteor-shower';
import { makeTarget, runConformance } from './_conformance';

// Layout constants mirrored from the primitive (deterministic geometry).
const STAR_COUNT = 140;
const TRAIL = 8;
const HIDDEN_Y = -1000;

function findPoints(target: ReturnType<typeof makeTarget>): Points {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('expected a THREE.Points in target.object');
  return pts;
}

/** Read the head (first trail point) X of meteor m from the position array. */
function headX(arr: ArrayLike<number>, m: number): number {
  return arr[(STAR_COUNT + m * TRAIL + 0) * 3] as number;
}

/** Count meteors whose head is NOT parked below view (live meteors). */
function liveMeteorCount(arr: ArrayLike<number>, maxMeteors: number): number {
  let n = 0;
  for (let m = 0; m < maxMeteors; m++) {
    const y = arr[(STAR_COUNT + m * TRAIL + 0) * 3 + 1] as number;
    if (y > HIDDEN_Y + 1) n++;
  }
  return n;
}

describe('meteor-shower primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(meteorShowerPrimitive).dispose();
  });

  it('plays: a meteor head streaks (position changes across two t)', () => {
    const target = makeTarget(meteorShowerPrimitive);
    const inst = meteorShowerPrimitive.create(target);
    const pts = findPoints(target);
    const arr = pts.geometry.getAttribute('position').array as ArrayLike<number>;

    inst.seek(0);
    const xEarly = headX(arr, 0);

    inst.seek(0.9);
    const xMid = headX(arr, 0);

    // The head visibly moves along the diagonal between two distinct times.
    expect(Math.abs(xMid - xEarly)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: more meteors means more live points', () => {
    const target = makeTarget(meteorShowerPrimitive);
    const inst = meteorShowerPrimitive.create(target);
    const pts = findPoints(target);
    const arr = pts.geometry.getAttribute('position').array as ArrayLike<number>;

    inst.setControl('meteors', 4);
    inst.seek(0.3);
    const few = liveMeteorCount(arr, 30);

    inst.setControl('meteors', 30);
    inst.seek(0.3);
    const many = liveMeteorCount(arr, 30);

    expect(many).toBeGreaterThan(few + 5);
    inst.dispose();
  });
});
