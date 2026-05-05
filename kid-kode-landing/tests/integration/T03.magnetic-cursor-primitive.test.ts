// T03 — magnetic-cursor primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L166-L183.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { magneticCursorPrimitive } from '@/lib/prism/runtime/shared/primitives/magnetic-cursor';
import type {
  PointerSource,
  PrimitiveContext,
} from '@/lib/prism/runtime/shared/primitives/types';

function makePointer(): PointerSource & { setNDC(x: number, y: number): void } {
  let ndc = { x: 0, y: 0 };
  const subs = new Set<(p: { x: number; y: number }) => void>();
  return {
    get ndc() {
      return ndc;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    setNDC(x, y) {
      ndc = { x, y };
      for (const cb of subs) cb(ndc);
    },
  };
}

function ctx(pointer?: PointerSource): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
    pointer,
  };
}

describe('magnetic-cursor primitive', () => {
  it('sets needsTick=true and supplies an onTick (per-frame lerp)', () => {
    const target = new THREE.Object3D();
    const r = magneticCursorPrimitive(target, {}, ctx(makePointer()));
    expect(r.needsTick).toBe(true);
    expect(typeof r.onTick).toBe('function');
    r.cleanup();
  });

  it('lerps the target offset toward cursor position over multiple ticks', () => {
    const target = new THREE.Object3D();
    const pointer = makePointer();
    const r = magneticCursorPrimitive(
      target,
      { radius: 1, intensity: 1, damping: 0.5 },
      ctx(pointer),
    );
    pointer.setNDC(1, 0);
    // Drive several ticks to integrate damping.
    for (let i = 0; i < 30; i++) r.onTick!(1 / 60);
    expect(target.position.x).toBeGreaterThan(0);
    r.cleanup();
  });

  it('cleanup unsubscribes from pointer source', () => {
    const target = new THREE.Object3D();
    const pointer = makePointer();
    const r = magneticCursorPrimitive(target, {}, ctx(pointer));
    r.cleanup();
    target.position.set(0, 0, 0);
    pointer.setNDC(1, 0);
    for (let i = 0; i < 30; i++) {
      // After cleanup, calling onTick must not move the target.
      r.onTick?.(1 / 60);
    }
    expect(target.position.length()).toBe(0);
  });

  it('no-ops gracefully when ctx.pointer is undefined', () => {
    const target = new THREE.Object3D();
    const r = magneticCursorPrimitive(target, {}, ctx(undefined));
    expect(r.timeline).toBeTruthy();
    r.cleanup();
  });
});
