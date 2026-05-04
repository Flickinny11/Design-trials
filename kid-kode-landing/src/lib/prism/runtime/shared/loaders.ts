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

import type { Texture } from 'three';

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

export function createLoaderCache(
  _options?: CreateLoaderCacheOptions,
): LoaderCacheHandle {
  throw new Error('createLoaderCache: not implemented (T02)');
}
