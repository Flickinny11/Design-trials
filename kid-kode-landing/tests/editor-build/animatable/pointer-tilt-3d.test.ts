import { describe, it, expect } from 'vitest';
import type { Object3D } from 'three';
import { pointerTilt3dPrimitive } from '@/lib/prism/animatable/primitives/pointer-tilt-3d';
import { makeTarget, runConformance } from './_conformance';

// Settle the smoothing lerp by seeking repeatedly (effect is stateful, so the
// rotation converges toward the pointer-derived target over several frames).
function settle(inst: { seek: (t: number) => void }, frames = 60): void {
  for (let i = 0; i < frames; i++) inst.seek(i * 0.016);
}

describe('pointer-tilt-3d primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerTilt3dPrimitive).dispose();
  });

  it('plays: pointer offset produces rotation.x / rotation.y', () => {
    const target = makeTarget(pointerTilt3dPrimitive);
    const subject = target.subject as Object3D;

    // Centered pointer → settled rotation stays at the base (no offset).
    target.userData.pointer = { x: 0.5, y: 0.5 };
    const inst = pointerTilt3dPrimitive.create(target);
    settle(inst);
    const centeredRotY = subject.rotation.y;
    const centeredRotX = subject.rotation.x;

    // Pointer to the corner → settled rotation tilts on both axes.
    target.userData.pointer = { x: 1, y: 1 };
    settle(inst);
    const tiltedRotY = subject.rotation.y;
    const tiltedRotX = subject.rotation.x;

    // offsetX = +0.5 → rotation.y positive; offsetY = +0.5 → rotation.x negative.
    expect(Math.abs(tiltedRotY - centeredRotY)).toBeGreaterThan(0.1);
    expect(Math.abs(tiltedRotX - centeredRotX)).toBeGreaterThan(0.1);
    expect(tiltedRotY).toBeGreaterThan(0); // faces toward +x pointer
    expect(tiltedRotX).toBeLessThan(0); // top tips back for +y pointer
    inst.dispose();
  });

  it('controls change output: larger maxTiltDeg means larger settled tilt', () => {
    const target = makeTarget(pointerTilt3dPrimitive);
    const subject = target.subject as Object3D;
    target.userData.pointer = { x: 1, y: 0.5 };
    const inst = pointerTilt3dPrimitive.create(target);

    inst.setControl('maxTiltDeg', 5);
    settle(inst);
    const small = Math.abs(subject.rotation.y);

    inst.setControl('maxTiltDeg', 40);
    settle(inst);
    const large = Math.abs(subject.rotation.y);

    expect(large).toBeGreaterThan(small + 0.1);

    // dispose restores the base transform.
    inst.dispose();
    expect(subject.rotation.y).toBe(0);
    expect(subject.rotation.x).toBe(0);
  });
});
