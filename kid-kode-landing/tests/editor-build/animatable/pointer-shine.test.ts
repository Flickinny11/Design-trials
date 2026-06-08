import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import { pointerShinePrimitive } from '@/lib/prism/animatable/primitives/pointer-shine';
import { makeTarget, runConformance } from './_conformance';

interface ShineUniforms {
  uPointer: { value: Vector2 };
  uTime: { value: number };
  uLength: { value: number };
  uIntensity: { value: number };
  uTwinkle: { value: number };
}

describe('pointer-shine primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(pointerShinePrimitive).dispose();
  });

  it('plays: glint time advances and centre tracks the pointer across seeks', () => {
    const target = makeTarget(pointerShinePrimitive);
    const inst = pointerShinePrimitive.create(target);
    const uni = target.userData.pointerShineUniforms as ShineUniforms;

    // Pointer at lower-left at an early frame.
    target.userData.pointer = { x: 0.2, y: 0.3 };
    inst.seek(0);
    const time0 = uni.uTime.value;
    const px0 = uni.uPointer.value.x;
    const py0 = uni.uPointer.value.y;

    // Pointer moved to upper-right at a later frame.
    target.userData.pointer = { x: 0.8, y: 0.7 };
    inst.seek(1.5);
    const timeMid = uni.uTime.value;
    const pxMid = uni.uPointer.value.x;
    const pyMid = uni.uPointer.value.y;

    // Time advanced (twinkle clock moves).
    expect(timeMid).toBeGreaterThan(time0 + 0.5);
    // Glint centre tracked the cursor in both axes.
    expect(pxMid).toBeGreaterThan(px0 + 0.3);
    expect(pyMid).toBeGreaterThan(py0 + 0.3);

    inst.dispose();
  });

  it('controls change output: intensity extremes drive uIntensity differently', () => {
    const target = makeTarget(pointerShinePrimitive);
    const inst = pointerShinePrimitive.create(target);
    const uni = target.userData.pointerShineUniforms as ShineUniforms;

    inst.setControl('intensity', 0);
    inst.seek(0.5);
    const low = uni.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(0.5);
    const high = uni.uIntensity.value;

    expect(high).toBeGreaterThan(low + 3);
    inst.dispose();
  });
});
