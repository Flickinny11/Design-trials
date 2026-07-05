// DOM-side HTMLVideoElement factory for the runtime LoaderCache video lane.
//
// FIDELITY-2 W3 / audit item 3. This module deliberately lives OUTSIDE
// `src/lib/prism/runtime/**` (and outside `src/components/prism-player/**`):
// runtime/node modules forbid `document.*` / `window.*` access (INV-15,
// anti-drift FP-05), and creating a <video> element is the one DOM operation
// the video-texture lane cannot avoid — THREE.VideoTexture takes an element;
// three itself creates nothing (unlike TextureLoader, which creates its own
// Image internally). Isolating the single `document.createElement` call here
// keeps the runtime document-free: `shared/loaders.ts` lazy-imports this
// factory only when a video is actually requested (browser-only by
// construction, mirroring its `defaultGLBLoader` lazy-import pattern), and
// tests inject a stub via `CreateLoaderCacheOptions.createVideoElement`.
//
// Element configuration (muted / loop / autoplay / playsInline / crossOrigin)
// happens in the loader lane itself — those are plain element property writes
// that need no DOM-global access.

export function createVideoElement(): HTMLVideoElement {
  return document.createElement('video');
}
