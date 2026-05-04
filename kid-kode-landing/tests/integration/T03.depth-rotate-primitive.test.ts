// T03 — depth-rotate primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L79-L97.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { depthRotatePrimitive } from '@/lib/prism/runtime/shared/primitives/depth-rotate';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('depth-rotate primitive', () => {
  it('default mode is continuous rotation (timeline.repeat === -1)', () => {
    const target = new THREE.Object3D();
    const r = depthRotatePrimitive(target, { period: 6 }, ctx());
    expect(r.timeline.repeat()).toBe(-1);
    r.cleanup();
  });

  it('pingPong=true uses yoyo (oscillation)', () => {
    const target = new THREE.Object3D();
    const r = depthRotatePrimitive(
      target,
      { pingPong: true, pingPongRange: 30, period: 4 },
      ctx(),
    );
    // yoyo on the timeline → oscillates rather than continuous rotation.
    expect(r.timeline.yoyo()).toBe(true);
    r.cleanup();
  });

  it('rotates around the configured axis (default Y)', () => {
    const target = new THREE.Object3D();
    const r = depthRotatePrimitive(target, { period: 1 }, ctx());
    r.timeline.progress(0.25);
    // After ~quarter rotation, target.rotation.y should be ~PI/2.
    expect(Math.abs(target.rotation.y)).toBeGreaterThan(0.5);
    r.cleanup();
  });

  it('cleanup kills the timeline', () => {
    const target = new THREE.Object3D();
    const r = depthRotatePrimitive(target, {}, ctx());
    r.cleanup();
    expect(r.timeline.paused() || (r.timeline as unknown as { _ts: number })._ts === 0).toBeTruthy();
  });
});
