// T03 — kinetic-text primitive.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L230-L248.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { kineticTextPrimitive } from '@/lib/prism/runtime/shared/primitives/kinetic-text';
import type { PrimitiveContext } from '@/lib/prism/runtime/shared/primitives/types';

function ctx(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

/** Build a fake MSDF text Group whose children are per-glyph meshes. */
function makeFakeText(content: string): THREE.Group {
  const g = new THREE.Group();
  for (const ch of content) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    m.name = `glyph:${ch}`;
    g.add(m);
  }
  return g;
}

describe('kinetic-text primitive', () => {
  it('staggers timeline entries — duration grows with the number of glyphs', () => {
    const target = makeFakeText('AB');
    const target2 = makeFakeText('ABCDEFGH');
    const r1 = kineticTextPrimitive(target, { stagger: 0.05, duration: 0.5 }, ctx());
    const r2 = kineticTextPrimitive(target2, { stagger: 0.05, duration: 0.5 }, ctx());
    expect(r2.timeline.duration()).toBeGreaterThan(r1.timeline.duration());
    r1.cleanup();
    r2.cleanup();
  });

  it("'slide-up' effect translates each glyph in y", () => {
    const target = makeFakeText('AB');
    const r = kineticTextPrimitive(
      target,
      { effect: 'slide-up', stagger: 0.05, duration: 0.5 },
      ctx(),
    );
    // At t=0 (before tween starts), glyphs should be displaced down (entering).
    r.timeline.progress(0);
    for (const child of target.children) {
      expect(child.position.y).not.toBe(0);
    }
    r.timeline.progress(1);
    // At t=1, glyphs should resolve to their final position (y == 0).
    for (const child of target.children) {
      expect(child.position.y).toBeCloseTo(0, 5);
    }
    r.cleanup();
  });

  it('cleanup kills the timeline', () => {
    const target = makeFakeText('XY');
    const r = kineticTextPrimitive(target, {}, ctx());
    r.cleanup();
    expect(r.timeline.paused() || (r.timeline as unknown as { _ts: number })._ts === 0).toBeTruthy();
  });

  it('handles empty target (no children) without throwing', () => {
    const empty = new THREE.Group();
    const r = kineticTextPrimitive(empty, {}, ctx());
    expect(r.timeline).toBeTruthy();
    r.cleanup();
  });
});
