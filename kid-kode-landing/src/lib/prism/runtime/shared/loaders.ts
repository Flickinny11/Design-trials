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

import { SRGBColorSpace, TextureLoader, VideoTexture, type Texture } from 'three';

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
  /** FIDELITY-2 W3 — inject the HTMLVideoElement factory (tests, or a host
   *  that owns element creation). When omitted, the lane lazy-imports the
   *  DOM-side default from `src/lib/prism/video-element.ts`, which lives
   *  OUTSIDE the runtime scope so this file stays `document`-free
   *  (INV-15 / anti-drift FP-05) — the same lazy-import shape as
   *  `defaultGLBLoader` below. */
  createVideoElement?: () => HTMLVideoElement;
}

export interface LoaderCacheHandle {
  /** Load a texture; same URL is memoized. */
  loadTexture(url: string): Promise<Texture>;
  /** Load a GLB; same URL is memoized. */
  loadGLB(url: string): Promise<GLTFLike>;
  /** FIDELITY-2 W3 — load a video as a `THREE.VideoTexture` (colorSpace
   *  SRGB). The backing element is muted, looping, autoplaying, playsInline,
   *  crossOrigin='anonymous'. Same URL is memoized; resolves once the first
   *  frame is decodable (HAVE_CURRENT_DATA). The cache owns the element and
   *  texture: `dispose()` pauses the video, clears its src, and disposes the
   *  texture — node cleanup must NOT dispose it (Amendment 0002 §A.2). */
  loadVideo(url: string): Promise<Texture>;
  /** True iff a URL has been requested (cached or in flight). */
  has(url: string): boolean;
  /** Number of cached entries (textures + GLBs + videos). For diagnostics. */
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

/** FIDELITY-2 W3 — lazy-load the DOM-side <video> element factory only when
 *  a video is actually requested and no factory was injected. The factory
 *  module holds the single DOM createElement('video') call OUTSIDE the
 *  runtime scope (INV-15 / FP-05); see its header for the rationale. */
async function defaultVideoElementFactory(): Promise<() => HTMLVideoElement> {
  const mod = await import('../../video-element');
  return mod.createVideoElement;
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
  // FIDELITY-2 W3 — video lane. Resolved entries keep both the texture and
  // the backing element so dispose() can pause + clear src + dispose.
  const videoCache = new Map<string, Promise<Texture>>();
  const resolvedVideos = new Map<string, { texture: Texture; video: HTMLVideoElement }>();

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

  // FIDELITY-2 W3 — mirror of loadTexture for video. Same memoization +
  // poisoned-retry semantics; the element is configured for autonomous
  // playback (muted/loop/autoplay/playsInline) so the resulting VideoTexture
  // animates without any host wiring. Resolves once the first frame is
  // decodable (readyState >= HAVE_CURRENT_DATA) so consumers never map a
  // black texture over their image placeholder.
  function loadVideo(url: string): Promise<Texture> {
    const hit = videoCache.get(url);
    if (hit) return hit;
    const p = (async () => {
      const makeVideoElement =
        options.createVideoElement ?? (await defaultVideoElementFactory());
      const video = makeVideoElement();
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        // HAVE_CURRENT_DATA (2) — at least one frame is decodable.
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        const detach = () => {
          video.removeEventListener('loadeddata', onReady);
          video.removeEventListener('error', onError);
        };
        const onReady = () => {
          detach();
          resolve();
        };
        const onError = () => {
          detach();
          reject(new Error(`loadVideo: failed to load ${url}`));
        };
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('error', onError);
        video.load();
      });
      // Muted autoplay is universally permitted; .play() can still reject on
      // exotic policies — the texture simply shows the first frame then.
      void video.play().catch(() => { /* best effort */ });
      const texture = new VideoTexture(video);
      texture.colorSpace = SRGBColorSpace;
      resolvedVideos.set(url, { texture, video });
      return texture as Texture;
    })();
    videoCache.set(url, p);
    // If the load fails, drop the cache entry so a retry isn't poisoned.
    p.catch(() => {
      videoCache.delete(url);
      resolvedVideos.delete(url);
    });
    return p;
  }

  function has(url: string): boolean {
    return textureCache.has(url) || glbCache.has(url) || videoCache.has(url);
  }

  function size(): number {
    return textureCache.size + glbCache.size + videoCache.size;
  }

  function dispose(): void {
    for (const tex of resolvedTextures.values()) {
      try {
        tex.dispose();
      } catch {
        // ignore — best effort
      }
    }
    // FIDELITY-2 W3 — video teardown: pause playback, clear the src (and
    // call load() so the decoder/network resources are released), then
    // dispose the GPU texture. Best-effort per entry.
    for (const { texture, video } of resolvedVideos.values()) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore — best effort
      }
      try {
        texture.dispose();
      } catch {
        // ignore — best effort
      }
    }
    resolvedVideos.clear();
    resolvedTextures.clear();
    textureCache.clear();
    glbCache.clear();
    videoCache.clear();
  }

  return { loadTexture, loadGLB, loadVideo, has, size, dispose };
}
