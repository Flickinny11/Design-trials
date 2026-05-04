// T03 — dissolve-morph primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L100-L119.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dissolveMorphPrimitive } from '@/lib/prism/runtime/shared/primitives/dissolve-morph';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('dissolve-morph primitive', () => {
  it('animates a `progress` value from 0 to 1 over the configured duration', () => {
    const target = new THREE.Object3D();
    const r = dissolveMorphPrimitive(
      target,
      { duration: 1.2, noiseScale: 8 },
      ctx(),
    );
    expect(r.timeline).toBeTruthy();
    expect(r.timeline.duration()).toBeCloseTo(1.2, 1);
    r.cleanup();
  });

  it('exposes the progress uniform on userData for shader binding', () => {
    const target = new THREE.Object3D();
    const r = dissolveMorphPrimitive(target, {}, ctx());
    // Implementation must surface the controllable uniform so node code or
    // tests can inspect it. Could be userData or the timeline's tween targets.
    const { progress } = (target.userData?.dissolveMorph ?? {}) as {
      progress?: { value: number };
    };
    expect(progress).toBeTruthy();
    expect(progress!.value).toBeGreaterThanOrEqual(0);
    r.cleanup();
  });

  it('cleanup kills the timeline', () => {
    const target = new THREE.Object3D();
    const r = dissolveMorphPrimitive(target, {}, ctx());
    r.cleanup();
    expect(r.timeline.paused() || (r.timeline as unknown as { _ts: number })._ts === 0).toBeTruthy();
  });
});
