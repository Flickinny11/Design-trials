// LoaderCache — wraps Three's TextureLoader + GLTFLoader with URL-keyed
// caches so codegen-emitted node modules can request assets synchronously
// from inside `createNode` (the contract requires sync return — async I/O
// happens via these cached loaders).
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract: "All async
// loading happens inside primitives via cached loaders") and §11 (Bundle
// Assembly: shared/loaders.js wraps TextureLoader + GLTFLoader cache).
//
// Cache semantics: same URL returns the same Promise<Texture> / Promise<GLTF>.
// Underlying loader is hit at most once per URL until `dispose()`.

import { TextureLoader, type Texture } from 'three';

/** Minimal GLTF result shape — full type lives in `three/addons/loaders/GLTFLoader.js`.
 *  Kept structural so tests can supply lightweight stubs. */
export interface GLTFLike {
  scene: import('three').Object3D;
  scenes?: import('three').Object3D[];
  animations?: import('three').AnimationClip[];
  asset?: { version?: string; generator?: string };
  [key: string]: unknown;
}

/** Underlying loader interfaces. The browser default uses Three's actual
 *  `TextureLoader` and `GLTFLoader`; tests inject stubs. */
export interface TextureLoaderLike {
  load(
    url: string,
    onLoad?: (texture: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): Texture;
}

export interface GLBLoaderLike {
  load(
    url: string,
    onLoad: (gltf: GLTFLike) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void;
}

export interface CreateLoaderCacheOptions {
  /** Inject a custom TextureLoader (e.g. for tests, or a draco-decoded one). */
  textureLoader?: TextureLoaderLike;
  /** Inject a custom GLTFLoader. */
  glbLoader?: GLBLoaderLike;
}

export interface LoaderCacheHandle {
  /** Load a texture; same URL is memoized. */
  loadTexture(url: string): Promise<Texture>;
  /** Load a GLB; same URL is memoized. */
  loadGLB(url: string): Promise<GLTFLike>;
  /** True iff a URL has been requested (cached or in flight). */
  has(url: string): boolean;
  /** Number of cached entries (textures + GLBs). For diagnostics. */
  size(): number;
  /** Dispose of every cached texture and clear all caches. */
  dispose(): void;
}

/** Lazy-load a GLTFLoader from `three/addons` only when needed and only when
 *  no explicit loader was injected. Avoids a hard runtime dependency on the
 *  addon path during tests / unit-only environments. */
async function defaultGLBLoader(): Promise<GLBLoaderLike> {
  const mod = await import('three/addons/loaders/GLTFLoader.js');
  return new mod.GLTFLoader() as unknown as GLBLoaderLike;
}

export function createLoaderCache(
  options: CreateLoaderCacheOptions = {},
): LoaderCacheHandle {
  const textureLoader: TextureLoaderLike =
    options.textureLoader ?? (new TextureLoader() as unknown as TextureLoaderLike);

  // GLB loader resolution is deferred: only constructed when first GLB is
  // requested, and only if no injected loader was provided.
  let glbLoaderPromise: Promise<GLBLoaderLike> | null = null;
  function resolveGLBLoader(): Promise<GLBLoaderLike> {
    if (options.glbLoader) return Promise.resolve(options.glbLoader);
    if (!glbLoaderPromise) glbLoaderPromise = defaultGLBLoader();
    return glbLoaderPromise;
  }

  const textureCache = new Map<string, Promise<Texture>>();
  const resolvedTextures = new Map<string, Texture>();
  const glbCache = new Map<string, Promise<GLTFLike>>();

  function loadTexture(url: string): Promise<Texture> {
    const hit = textureCache.get(url);
    if (hit) return hit;
    const p = new Promise<Texture>((resolve, reject) => {
      try {
        textureLoader.load(
          url,
          (tex) => {
            resolvedTextures.set(url, tex);
            resolve(tex);
          },
          undefined,
          (err) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    textureCache.set(url, p);
    // If the load fails, drop the cache entry so a retry isn't poisoned.
    p.catch(() => {
      textureCache.delete(url);
      resolvedTextures.delete(url);
    });
    return p;
  }

  function loadGLB(url: string): Promise<GLTFLike> {
    const hit = glbCache.get(url);
    if (hit) return hit;
    const p = (async () => {
      const loader = await resolveGLBLoader();
      return new Promise<GLTFLike>((resolve, reject) => {
        loader.load(
          url,
          (g) => resolve(g),
          undefined,
          (err) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      });
    })();
    glbCache.set(url, p);
    p.catch(() => glbCache.delete(url));
    return p;
  }

  function has(url: string): boolean {
    return textureCache.has(url) || glbCache.has(url);
  }

  function size(): number {
    return textureCache.size + glbCache.size;
  }

  function dispose(): void {
    for (const tex of resolvedTextures.values()) {
      try {
        tex.dispose();
      } catch {
        // ignore — best effort
      }
    }
    resolvedTextures.clear();
    textureCache.clear();
    glbCache.clear();
  }

  return { loadTexture, loadGLB, has, size, dispose };
}
