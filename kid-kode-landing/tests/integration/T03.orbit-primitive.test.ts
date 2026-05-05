// T03 — orbit primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L57-L76 (params, behavior).

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { orbitPrimitive } from '@/lib/prism/runtime/shared/primitives/orbit';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('orbit primitive', () => {
  it('returns a PrimitiveResult with a repeating timeline', () => {
    const target = new THREE.Object3D();
    const r = orbitPrimitive(target, { radius: 2, period: 4 }, ctx());
    expect(r.timeline).toBeTruthy();
    // CPL L72: "gsap.timeline({ repeat: -1 })" — repeats indefinitely.
    expect(r.timeline.repeat()).toBe(-1);
    expect(typeof r.cleanup).toBe('function');
    r.cleanup();
  });

  it('accepts default params and parametrically positions target on the orbit', () => {
    const target = new THREE.Object3D();
    const r = orbitPrimitive(target, {}, ctx());
    // After construction (timeline @t=0), target should sit on the orbit
    // around centerXYZ default (0,0,0) at the default radius (2).
    // Distance to origin (0,0,0) ≈ radius.
    const dist = target.position.length();
    expect(dist).toBeCloseTo(2, 1);
    r.cleanup();
  });

  it('cleanup kills the timeline (it cannot resume after)', () => {
    const target = new THREE.Object3D();
    const r = orbitPrimitive(target, { period: 1 }, ctx());
    expect(r.timeline.isActive() || !r.timeline.paused()).toBeTruthy();
    r.cleanup();
    // GSAP killed timelines have totalTime irrelevant; the marker is that
    // they are no longer in the global ticker.
    expect((r.timeline as unknown as { _ts: number })._ts === 0 || r.timeline.paused()).toBeTruthy();
  });

  it('respects faceCenter=true by orienting target toward orbit center', () => {
    const target = new THREE.Object3D();
    const r = orbitPrimitive(
      target,
      { centerX: 0, centerY: 0, centerZ: 0, radius: 3, faceCenter: true },
      ctx(),
    );
    // After construction the target is on the orbit ring; lookAt(center) should
    // have set its quaternion so that the local -Z faces center.
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(target.quaternion);
    const toCenter = new THREE.Vector3().sub(target.position).normalize();
    expect(fwd.dot(toCenter)).toBeGreaterThan(0.9);
    r.cleanup();
  });
});
