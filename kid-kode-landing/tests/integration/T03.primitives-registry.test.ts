// T03 — Primitives registry contract.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L37-L51 (registry shape) +
// L12-L34 (PrimitiveFn / PrimitiveResult / PrimitiveContext) +
// PRISM-RENDERER-MIGRATION-SPEC.md §11 L407-L416 (file paths) +
// §7 L201 (codegen references primitives by name; never authors scene
// animation from prompt context).
//
// The registry exports exactly the 9 named primitives. Each value is a
// function with the (target, params, ctx) → PrimitiveResult signature.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { primitives, makePrimitivesAPI } from '@/lib/prism/runtime/shared/primitives';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '@/lib/prism/runtime/shared/primitives/types';

const ALL_NAMES = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
] as const;

function ctxStub(): PrimitiveContext {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(50, 1, 0.1, 100),
    renderer: null,
    emit: () => {},
  };
}

describe('primitives registry', () => {
  it('exports a registry with all 9 named primitives', () => {
    for (const name of ALL_NAMES) {
      expect(primitives).toHaveProperty(name);
      expect(typeof primitives[name]).toBe('function');
    }
    expect(Object.keys(primitives).sort()).toEqual([...ALL_NAMES].sort());
  });

  it('every primitive returns a PrimitiveResult with timeline + cleanup', () => {
    const target = new THREE.Object3D();
    const ctx = ctxStub();
    for (const name of ALL_NAMES) {
      const result = primitives[name](target, {}, ctx) as PrimitiveResult;
      expect(result, `primitive ${name} returned falsy`).toBeTruthy();
      expect(result.timeline, `primitive ${name} missing timeline`).toBeTruthy();
      expect(typeof result.cleanup).toBe('function');
      // Smoke-test that cleanup is callable without throwing.
      result.cleanup();
    }
  });

  it('makePrimitivesAPI returns a curried (target, params) API', () => {
    const ctx = ctxStub();
    const api = makePrimitivesAPI(ctx);
    for (const name of ALL_NAMES) {
      expect(typeof api[name]).toBe('function');
      // Curried API takes only (target, params).
      expect(api[name].length).toBeLessThanOrEqual(2);
    }
    // Sanity: invoking api['orbit'](target, params) returns a PrimitiveResult.
    const r = api['orbit'](new THREE.Object3D(), {}) as PrimitiveResult;
    expect(r.timeline).toBeTruthy();
    expect(typeof r.cleanup).toBe('function');
    r.cleanup();
  });
});
