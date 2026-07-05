import { describe, it, expect } from 'vitest';
import { Mesh } from 'three';
import { repelPrimitive } from '@/lib/prism/animatable/primitives/repel';
import { makeTarget, runConformance } from './_conformance';

describe('repel primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(repelPrimitive).dispose();
  });

  it('plays: subject pushes away from the pointer position', () => {
    const target = makeTarget(repelPrimitive);
    const inst = repelPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseX = mesh.position.x;
    const baseY = mesh.position.y;

    // Pointer toward the lower-left of the plane → card pushed up-right.
    target.userData.pointer = { x: 0.2, y: 0.2 };
    inst.seek(0.5);
    const offX1 = mesh.position.x - baseX;
    const offY1 = mesh.position.y - baseY;
    const mag1 = Math.hypot(offX1, offY1);

    // A push actually happened (concrete numeric displacement off base).
    expect(mag1).toBeGreaterThan(0.05);
    // Pointer is down-left of center → push direction is up-right (positive).
    expect(offX1).toBeGreaterThan(0);
    expect(offY1).toBeGreaterThan(0);

    // Move the pointer to the upper-right → push flips to down-left.
    target.userData.pointer = { x: 0.8, y: 0.8 };
    inst.seek(1.0);
    const offX2 = mesh.position.x - baseX;
    const offY2 = mesh.position.y - baseY;

    // Direction reversed: this frame differs concretely from the first.
    expect(offX2).toBeLessThan(0);
    expect(offY2).toBeLessThan(0);
    expect(Math.abs(offX2 - offX1)).toBeGreaterThan(0.05);

    inst.dispose();
    // restore on dispose
    expect(mesh.position.x).toBeCloseTo(baseX, 6);
    expect(mesh.position.y).toBeCloseTo(baseY, 6);
  });

  it('controls change output: larger maxPush means a larger push', () => {
    const target = makeTarget(repelPrimitive);
    const inst = repelPrimitive.create(target);
    const mesh = target.subject as Mesh;
    const baseX = mesh.position.x;
    const baseY = mesh.position.y;

    // Pointer close to center so strength/(dist+eps) is large and maxPush clamps.
    target.userData.pointer = { x: 0.45, y: 0.45 };

    inst.setControl('maxPush', 0.2);
    inst.seek(0.5);
    const small = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);

    inst.setControl('maxPush', 2.5);
    inst.seek(0.5);
    const large = Math.hypot(mesh.position.x - baseX, mesh.position.y - baseY);

    expect(large).toBeGreaterThan(small + 0.1);
    inst.dispose();
  });
});
