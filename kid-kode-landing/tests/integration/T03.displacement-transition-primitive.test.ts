// T03 — displacement-transition primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L122-L140.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { displacementTransitionPrimitive } from '@/lib/prism/runtime/shared/primitives/displacement-transition';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('displacement-transition primitive', () => {
  it('animates the intensity uniform over the configured duration', () => {
    const target = new THREE.Object3D();
    const r = displacementTransitionPrimitive(
      target,
      { duration: 1.5, intensity: 0.5 },
      ctx(),
    );
    expect(r.timeline.duration()).toBeCloseTo(1.5, 1);
    r.cleanup();
  });

  it('exposes the intensity uniform on userData', () => {
    const target = new THREE.Object3D();
    const r = displacementTransitionPrimitive(target, {}, ctx());
    const { intensity } = (target.userData?.displacementTransition ?? {}) as {
      intensity?: { value: number };
    };
    expect(intensity).toBeTruthy();
    r.cleanup();
  });

  it('cleanup kills the timeline', () => {
    const target = new THREE.Object3D();
    const r = displacementTransitionPrimitive(target, {}, ctx());
    r.cleanup();
    expect(r.timeline.paused() || (r.timeline as unknown as { _ts: number })._ts === 0).toBeTruthy();
  });
});
