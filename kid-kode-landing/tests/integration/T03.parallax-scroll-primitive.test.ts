// T03 — parallax-scroll primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L144-L162.

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { parallaxScrollPrimitive } from '@/lib/prism/runtime/shared/primitives/parallax-scroll';
import type {
  PrimitiveContext,
  ScrollSource,
} from '@/lib/prism/runtime/shared/primitives/types';

function makeScrollSource(): ScrollSource & { setProgress(p: number): void } {
  let progress = 0;
  const subs = new Set<(p: number) => void>();
  return {
    get progress() {
      return progress;
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    setProgress(p: number) {
      progress = p;
      for (const cb of subs) cb(p);
    },
  };
}

function ctx(scroll?: ScrollSource): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
    scroll,
  };
}

describe('parallax-scroll primitive', () => {
  it('subscribes to the ctx.scroll source and moves target on the configured axis', () => {
    const target = new THREE.Object3D();
    const scroll = makeScrollSource();
    const r = parallaxScrollPrimitive(target, { axis: 'y', intensity: 0.5 }, ctx(scroll));
    scroll.setProgress(1);
    expect(target.position.y).toBeCloseTo(0.5, 2);
    r.cleanup();
  });

  it('respects negative intensity (parallax in opposite direction)', () => {
    const target = new THREE.Object3D();
    const scroll = makeScrollSource();
    const r = parallaxScrollPrimitive(target, { axis: 'y', intensity: -1 }, ctx(scroll));
    scroll.setProgress(1);
    expect(target.position.y).toBeLessThan(0);
    r.cleanup();
  });

  it('cleanup unsubscribes from the scroll source', () => {
    const target = new THREE.Object3D();
    const scroll = makeScrollSource();
    const unsubscribeSpy = vi.spyOn(scroll, 'subscribe');
    const r = parallaxScrollPrimitive(target, { axis: 'y' }, ctx(scroll));
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    const unsubFn = unsubscribeSpy.mock.results[0].value as () => void;
    expect(typeof unsubFn).toBe('function');
    r.cleanup();
    // After cleanup, setting progress should NOT move target.
    target.position.set(0, 0, 0);
    scroll.setProgress(1);
    expect(target.position.y).toBe(0);
  });

  it('no-ops gracefully when ctx.scroll is undefined (node test env)', () => {
    const target = new THREE.Object3D();
    const r = parallaxScrollPrimitive(target, { axis: 'y', intensity: 1 }, ctx(undefined));
    expect(r.timeline).toBeTruthy();
    expect(typeof r.cleanup).toBe('function');
    r.cleanup();
  });
});
