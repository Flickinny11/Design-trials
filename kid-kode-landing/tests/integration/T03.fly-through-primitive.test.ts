// T03 — fly-through primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L209-L226.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { flyThroughPrimitive } from '@/lib/prism/runtime/shared/primitives/fly-through';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('fly-through primitive', () => {
  it('animates ctx.camera position (target stays put)', () => {
    const c = ctx();
    const startCam = c.camera.position.clone();
    const target = new THREE.Object3D();
    target.position.set(0, 0, -5);
    const startTarget = target.position.clone();

    const r = flyThroughPrimitive(target, { duration: 1, direction: 'forward' }, c);
    r.timeline.progress(1);

    // Target unchanged.
    expect(target.position.equals(startTarget)).toBe(true);
    // Camera moved (direction:forward → toward target).
    expect(c.camera.position.equals(startCam)).toBe(false);
    r.cleanup();
  });

  it('default duration is 1.0s', () => {
    const target = new THREE.Object3D();
    const r = flyThroughPrimitive(target, {}, ctx());
    expect(r.timeline.duration()).toBeCloseTo(1, 1);
    r.cleanup();
  });

  it('cleanup kills the timeline and restores camera tween', () => {
    const c = ctx();
    const target = new THREE.Object3D();
    const r = flyThroughPrimitive(target, { duration: 1 }, c);
    r.cleanup();
    expect(r.timeline.paused() || (r.timeline as unknown as { _ts: number })._ts === 0).toBeTruthy();
  });

  it("direction='backward' moves camera away from target", () => {
    const c = ctx();
    c.camera.position.set(0, 0, 10);
    const target = new THREE.Object3D();
    target.position.set(0, 0, 0);
    const startDist = c.camera.position.distanceTo(target.position);

    const r = flyThroughPrimitive(target, { duration: 1, direction: 'backward' }, c);
    r.timeline.progress(1);
    const endDist = c.camera.position.distanceTo(target.position);
    expect(endDist).toBeGreaterThan(startDist);
    r.cleanup();
  });
});
