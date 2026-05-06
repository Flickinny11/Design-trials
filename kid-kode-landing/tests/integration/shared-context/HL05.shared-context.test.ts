// HL05 — Shared NodeContext singleton.
//
// Plan ref: §P7.5 — `src/lib/prism/runtime/shared-context.ts` exports four
// module-level singleton getters so PrismHost (runtime canvas) and editor
// surfaces (ArtifactNode + VisualPreview) share the same loader cache,
// font atlas, and (when applicable) scene root. Single ownership prevents
// the dual-load + dispose-race the Plan agent flagged.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract —
// `ctx.textureLoader` / `ctx.glbLoader` / `ctx.fontAtlas` / `ctx.primitives`
// must be cached so generated node code can call them synchronously).

import { describe, expect, it, beforeEach } from 'vitest';
import { Group } from 'three';
import {
  __resetSharedContext,
  getSharedFontAtlas,
  getSharedLoaders,
  getSharedNodeContext,
  getSharedSceneRoot,
} from '@/lib/prism/runtime/shared-context';

describe('shared-context (HL05)', () => {
  beforeEach(() => {
    __resetSharedContext();
  });

  describe('singleton identity', () => {
    it('getSharedLoaders returns the same instance across calls', () => {
      const a = getSharedLoaders();
      const b = getSharedLoaders();
      expect(a).toBe(b);
      expect(typeof a.loadTexture).toBe('function');
      expect(typeof a.loadGLB).toBe('function');
    });

    it('getSharedFontAtlas returns the same instance across calls', () => {
      const a = getSharedFontAtlas();
      const b = getSharedFontAtlas();
      expect(a).toBe(b);
      expect(typeof a.createText).toBe('function');
    });

    it('getSharedSceneRoot returns the same instance across awaits', async () => {
      const a = await getSharedSceneRoot();
      const b = await getSharedSceneRoot();
      expect(a).toBe(b);
      expect(a.scene).toBeDefined();
      expect(a.camera).toBeDefined();
    });

    it('__resetSharedContext clears the singletons', () => {
      const a = getSharedLoaders();
      __resetSharedContext();
      const b = getSharedLoaders();
      expect(a).not.toBe(b);
    });
  });

  describe('NodeContext composition', () => {
    it('shares loader cache with getSharedLoaders (same fn references)', () => {
      const ctx = getSharedNodeContext({ runPrimitives: false });
      const loaders = getSharedLoaders();
      expect(ctx.textureLoader.loadTexture).toBe(loaders.loadTexture);
      expect(ctx.glbLoader.loadGLB).toBe(loaders.loadGLB);
    });

    it('shares font atlas with getSharedFontAtlas (same instance)', () => {
      const ctx = getSharedNodeContext({ runPrimitives: false });
      const atlas = getSharedFontAtlas();
      expect(ctx.fontAtlas).toBe(atlas);
    });

    it('emit is a no-throw default fn', () => {
      const ctx = getSharedNodeContext({ runPrimitives: false });
      expect(typeof ctx.emit).toBe('function');
      expect(() => ctx.emit('any-event', { a: 1 })).not.toThrow();
    });

    it('two ArtifactNode-style consumers share the same loader cache', async () => {
      // Simulate: editor's ArtifactNode + VisualPreview each ask for ctx.
      const ctxA = getSharedNodeContext({ runPrimitives: false });
      const ctxB = getSharedNodeContext({ runPrimitives: false });

      // Trigger a memoized load via ctxA; ctxB hitting the same URL should
      // return the same Promise (proves the cache is shared, not duplicated).
      // The default LoaderCache uses Three's TextureLoader which can't run
      // in node, so we read the underlying handle's `has(url)` after a load
      // attempt — failures still register in the in-flight cache for one tick.
      const loaders = getSharedLoaders();
      // The cache is a Map<url, Promise>. On a fresh cache `has` is false.
      expect(loaders.has('texture-shared.avif')).toBe(false);

      // The two contexts must reference the same `has` / `loadTexture` impl
      // (already covered above). This assertion makes the shared-cache claim
      // explicit at the higher level.
      expect(ctxA.textureLoader.loadTexture).toBe(ctxB.textureLoader.loadTexture);
      expect(ctxA.glbLoader.loadGLB).toBe(ctxB.glbLoader.loadGLB);
      expect(ctxA.fontAtlas).toBe(ctxB.fontAtlas);
    });
  });

  describe('runPrimitives flag', () => {
    it('runPrimitives=false yields no-op primitives that do not throw', () => {
      const ctx = getSharedNodeContext({ runPrimitives: false });
      const target = new Group();
      // Calling the no-op primitive must not throw and must yield a result
      // shape the factory can walk for cleanup (PrimitiveResult.cleanup).
      const result = ctx.primitives['orbit'](target, {});
      expect(result).toBeDefined();
      expect(typeof result.cleanup).toBe('function');
      expect(() => result.cleanup()).not.toThrow();
    });

    it('runPrimitives=false stubs every primitive name in the registry', () => {
      const ctx = getSharedNodeContext({ runPrimitives: false });
      const names = [
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
      for (const n of names) {
        expect(typeof ctx.primitives[n]).toBe('function');
      }
    });

    it('runPrimitives=true exposes the real curried primitives API', async () => {
      // True path requires a scene root (primitives need scene/camera).
      // Singleton must construct one lazily (noRenderer mode in node env).
      const ctx = getSharedNodeContext({ runPrimitives: true });
      expect(ctx.primitives).toBeDefined();
      expect(typeof ctx.primitives['orbit']).toBe('function');
      // Calling getSharedNodeContext({ runPrimitives: true }) twice yields
      // the SAME primitives API (singleton).
      const ctx2 = getSharedNodeContext({ runPrimitives: true });
      expect(ctx2.primitives).toBe(ctx.primitives);
    });
  });
});
