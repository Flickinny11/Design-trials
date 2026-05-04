// T03 — particle-emerge primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L187-L205.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { particleEmergePrimitive } from '@/lib/prism/runtime/shared/primitives/particle-emerge';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('particle-emerge primitive', () => {
  it('attaches a Points object to target with the requested particle count', () => {
    const target = new THREE.Group();
    const r = particleEmergePrimitive(target, { particleCount: 600 }, ctx());
    const points = target.children.find((c) => (c as THREE.Points).isPoints);
    expect(points).toBeTruthy();
    const positionAttr = (points as THREE.Points).geometry.getAttribute('position');
    expect(positionAttr.count).toBe(600);
    r.cleanup();
  });

  it('clamps particleCount into [256, 2048]', () => {
    const ctxL = ctx();
    const ctxH = ctx();
    const targetL = new THREE.Group();
    const targetH = new THREE.Group();
    const rL = particleEmergePrimitive(targetL, { particleCount: 50 }, ctxL);
    const rH = particleEmergePrimitive(targetH, { particleCount: 99999 }, ctxH);
    const ptsL = targetL.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points;
    const ptsH = targetH.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points;
    expect(ptsL.geometry.getAttribute('position').count).toBe(256);
    expect(ptsH.geometry.getAttribute('position').count).toBe(2048);
    rL.cleanup();
    rH.cleanup();
  });

  it('cleanup removes the Points object and disposes its geometry', () => {
    const target = new THREE.Group();
    const r = particleEmergePrimitive(target, { particleCount: 300 }, ctx());
    const points = target.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points;
    expect(points).toBeTruthy();
    r.cleanup();
    expect(target.children.find((c) => (c as THREE.Points).isPoints)).toBeUndefined();
  });

  it('default particleCount is 512', () => {
    const target = new THREE.Group();
    const r = particleEmergePrimitive(target, {}, ctx());
    const points = target.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points;
    expect(points.geometry.getAttribute('position').count).toBe(512);
    r.cleanup();
  });
});
