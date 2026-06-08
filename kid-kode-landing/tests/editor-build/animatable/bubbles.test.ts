import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { bubblesPrimitive } from '@/lib/prism/animatable/primitives/bubbles';
import { makeTarget, runConformance } from './_conformance';

function findPoints(target: ReturnType<typeof makeTarget>): Points {
  let pts: Points | null = null;
  target.object.traverse((o) => {
    if ((o as Points).isPoints) pts = o as Points;
  });
  if (!pts) throw new Error('bubbles did not build a THREE.Points');
  return pts;
}

describe('bubbles primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(bubblesPrimitive).dispose();
  });

  it('plays: a bubble y changes across the timeline (CPU-observable)', () => {
    const target = makeTarget(bubblesPrimitive);
    const inst = bubblesPrimitive.create(target);
    const pts = findPoints(target);
    const pos = (pts.geometry.getAttribute('position') as BufferAttribute)
      .array as Float32Array;

    inst.seek(0);
    const y0 = pos[1]; // particle 0's y

    inst.seek(0.9);
    const y1 = pos[1];

    // The first bubble's y must move between two distinct frames.
    expect(Math.abs(y1 - y0)).toBeGreaterThan(0.05);
    inst.dispose();
  });

  it('controls change output: more count means more active (sized) bubbles', () => {
    const target = makeTarget(bubblesPrimitive);
    const inst = bubblesPrimitive.create(target);
    const pts = findPoints(target);
    const sizeArr = (pts.geometry.getAttribute('size') as BufferAttribute)
      .array as Float32Array;

    const activeAt = (): number => {
      let n = 0;
      for (let i = 0; i < sizeArr.length; i++) if (sizeArr[i] > 0) n++;
      return n;
    };

    inst.setControl('count', 30);
    inst.seek(0.5);
    const few = activeAt();

    inst.setControl('count', 300);
    inst.seek(0.5);
    const many = activeAt();

    expect(many).toBeGreaterThan(few + 50);
    inst.dispose();
  });
});
