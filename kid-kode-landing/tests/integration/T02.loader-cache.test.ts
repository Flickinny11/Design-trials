// T02 — LoaderCache memoizes textures + GLBs by URL.
//
// Spec: §8 — "All async loading happens inside primitives via cached loaders.
// ctx.textureLoader / ctx.glbLoader return cached resources."
//
// We inject stub TextureLoader/GLTFLoader that records call counts and
// returns deterministic stubs. The cache MUST hit the underlying loader
// at most once per URL.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createLoaderCache,
  type GLBLoaderLike,
  type GLTFLike,
  type TextureLoaderLike,
} from '@/lib/prism/runtime/shared/loaders';

function makeStubTextureLoader(): TextureLoaderLike & { calls: string[] } {
  const calls: string[] = [];
  const loader: TextureLoaderLike & { calls: string[] } = {
    calls,
    load(url, onLoad, _onProgress, _onError) {
      calls.push(url);
      const tex = new THREE.Texture();
      tex.name = url;
      // Fire async to mirror real TextureLoader semantics.
      queueMicrotask(() => onLoad?.(tex));
      return tex;
    },
  };
  return loader;
}

function makeStubGLBLoader(): GLBLoaderLike & { calls: string[] } {
  const calls: string[] = [];
  const loader: GLBLoaderLike & { calls: string[] } = {
    calls,
    load(url, onLoad) {
      calls.push(url);
      const stub: GLTFLike = { scene: new THREE.Group() };
      queueMicrotask(() => onLoad(stub));
    },
  };
  return loader;
}

describe('createLoaderCache', () => {
  it('memoizes textures by URL', async () => {
    const stub = makeStubTextureLoader();
    const cache = createLoaderCache({ textureLoader: stub });
    const t1 = await cache.loadTexture('a.png');
    const t2 = await cache.loadTexture('a.png');
    expect(t1).toBe(t2);
    expect(stub.calls).toEqual(['a.png']);
  });

  it('memoizes GLBs by URL', async () => {
    const stub = makeStubGLBLoader();
    const cache = createLoaderCache({ glbLoader: stub });
    const g1 = await cache.loadGLB('hero.glb');
    const g2 = await cache.loadGLB('hero.glb');
    expect(g1).toBe(g2);
    expect(stub.calls).toEqual(['hero.glb']);
  });

  it('reports has() and size() correctly', async () => {
    const cache = createLoaderCache({
      textureLoader: makeStubTextureLoader(),
      glbLoader: makeStubGLBLoader(),
    });
    expect(cache.size()).toBe(0);
    expect(cache.has('a.png')).toBe(false);
    await cache.loadTexture('a.png');
    expect(cache.has('a.png')).toBe(true);
    expect(cache.size()).toBe(1);
    await cache.loadGLB('hero.glb');
    expect(cache.size()).toBe(2);
  });

  it('dispose() releases textures and clears the cache', async () => {
    const stub = makeStubTextureLoader();
    const cache = createLoaderCache({ textureLoader: stub });
    const tex = await cache.loadTexture('a.png');
    let disposed = 0;
    tex.dispose = () => {
      disposed += 1;
    };
    cache.dispose();
    expect(disposed).toBe(1);
    expect(cache.has('a.png')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  it('rejects when an underlying load errors', async () => {
    const errorLoader: TextureLoaderLike = {
      load(_url, _onLoad, _onProgress, onError) {
        queueMicrotask(() => onError?.(new Error('boom')));
        return new THREE.Texture();
      },
    };
    const cache = createLoaderCache({ textureLoader: errorLoader });
    await expect(cache.loadTexture('x.png')).rejects.toThrow(/boom/);
  });
});
