import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import { spotlightFollowPrimitive } from '@/lib/prism/animatable/primitives/spotlight-follow';
import { makeTarget, runConformance } from './_conformance';

interface SpotlightUniforms {
  uPointer: { value: Vector2 };
  uIntensity: { value: number };
  uRadius: { value: number };
}

describe('spotlight-follow primitive', () => {
  it('conforms to the Animatable contract', () => {
    runConformance(spotlightFollowPrimitive).dispose();
  });

  it('plays: the hotspot centre tracks the pointer across the surface', () => {
    const target = makeTarget(spotlightFollowPrimitive);
    const inst = spotlightFollowPrimitive.create(target);
    const u = target.userData.spotlightUniforms as SpotlightUniforms;

    // Pointer in the lower-left, sampled early.
    (target.userData.pointer as { x: number; y: number }) = { x: 0.15, y: 0.2 };
    inst.seek(0);
    const early = (u.uPointer.value as Vector2).clone();

    // Pointer moves to the upper-right, sampled mid-timeline.
    (target.userData.pointer as { x: number; y: number }) = { x: 0.85, y: 0.9 };
    inst.seek(1.3);
    const mid = (u.uPointer.value as Vector2).clone();

    // The hotspot centre has visibly tracked across the surface.
    expect(mid.x).toBeGreaterThan(early.x + 0.4);
    expect(mid.y).toBeGreaterThan(early.y + 0.4);

    // And even with a fixed pointer the idle drift makes a later frame differ
    // from t=0 — never fully static.
    (target.userData.pointer as { x: number; y: number }) = { x: 0.5, y: 0.5 };
    inst.seek(0);
    const drift0 = (u.uPointer.value as Vector2).clone();
    inst.seek(0.9);
    const drift1 = (u.uPointer.value as Vector2).clone();
    expect(drift0.distanceTo(drift1)).toBeGreaterThan(0.01);

    inst.dispose();
  });

  it('controls change output: intensity extremes drive different emissive strength', () => {
    const target = makeTarget(spotlightFollowPrimitive);
    const inst = spotlightFollowPrimitive.create(target);
    const u = target.userData.spotlightUniforms as SpotlightUniforms;

    inst.setControl('intensity', 0);
    inst.seek(0.5);
    const low = u.uIntensity.value;

    inst.setControl('intensity', 4);
    inst.seek(0.5);
    const high = u.uIntensity.value;

    expect(high).toBeGreaterThan(low + 3);
    inst.dispose();
  });
});
