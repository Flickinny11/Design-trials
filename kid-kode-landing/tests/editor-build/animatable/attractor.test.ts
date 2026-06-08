import { describe, it, expect } from 'vitest';
import { Points, type BufferAttribute } from 'three';
import { attractorPrimitive } from '@/lib/prism/animatable/primitives/attractor';
import { makeTarget, runConformance } from './_conformance';

describe('attractor primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(attractorPrimitive).dispose();
  });

  it('plays: the point cloud revolves over time (rotation + transformed point change)', () => {
    const target = makeTarget(attractorPrimitive);
    const inst = attractorPrimitive.create(target);
    const points = target.object.getObjectByName('attractor') as Points;
    const pos = points.geometry.getAttribute('position') as BufferAttribute;

    inst.seek(0);
    const rotY0 = points.rotation.y;
    const px0 = pos.getX(50);
    const pz0 = pos.getZ(50);

    inst.seek(3.5);
    const rotYMid = points.rotation.y;
    const pxMid = pos.getX(50);
    const pzMid = pos.getZ(50);

    // The whole cloud has revolved: object rotation advanced...
    expect(Math.abs(rotYMid - rotY0)).toBeGreaterThan(0.5);
    // ...and a baked point moved as a result of that rotation.
    expect(Math.hypot(pxMid - px0, pzMid - pz0)).toBeGreaterThan(0.1);
    inst.dispose();
  });

  it('controls change output: higher speed means more rotation at the same time', () => {
    const target = makeTarget(attractorPrimitive);
    const inst = attractorPrimitive.create(target);
    const points = target.object.getObjectByName('attractor') as Points;

    inst.setControl('speed', 0);
    inst.seek(2);
    const slow = points.rotation.y;

    inst.setControl('speed', 2);
    inst.seek(2);
    const fast = points.rotation.y;

    expect(fast).toBeGreaterThan(slow + 0.5);
    inst.dispose();
  });
});
