// Shared NodeContext singleton — Plan §P7.5.
//
// Module-level singletons so PrismHost (runtime canvas) and editor surfaces
// (ArtifactNode + VisualPreview) reference the SAME loader cache, font atlas,
// and (when applicable) scene root. Single ownership prevents the dual-load
// + dispose-race the Plan agent flagged.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract — async
// loading happens inside primitives via cached loaders; same URL yields the
// same Promise).
//
// Public API:
//   getSharedLoaders(): LoaderCacheHandle
//   getSharedFontAtlas(): FontAtlasHandle
//   getSharedSceneRoot(): Promise<SceneRootHandle>
//   getSharedNodeContext({ runPrimitives }): NodeContext
//   __resetSharedContext(): void  // test-only escape hatch.
//
// runPrimitives flag:
//   - false → primitives is a no-op stub (every primitive name returns a
//     PrimitiveResult with a no-op cleanup). Used by editor surfaces where
//     motion is not desired (ArtifactNode renders static factory output).
//   - true  → primitives is wired to the shared scene root via
//     `makePrimitivesAPI`. Used by PrismHost.
//
// Disposal: the singleton owns disposal. Callers MUST NOT dispose() the
// returned handles directly — call `__resetSharedContext()` (tests only)
// or rely on process exit.

import * as THREE from 'three';
import { PerspectiveCamera, Scene } from 'three';
import {
  createLoaderCache,
  type LoaderCacheHandle,
} from './shared/loaders';
import {
  createFontAtlas,
  type FontAtlasHandle,
} from './shared/text';
import {
  createSceneRoot,
  type SceneRootHandle,
} from './shared/scene-root';
import { makePrimitivesAPI } from './shared/primitives';
import type {
  CinematicPrimitivesAPI,
  PrimitiveResult,
} from './shared/primitives/types';
import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';
import type { NodeContext } from './shared/adapter';

interface SharedRegistry {
  loaders: LoaderCacheHandle | null;
  fontAtlas: FontAtlasHandle | null;
  sceneRoot: SceneRootHandle | null;
  sceneRootPromise: Promise<SceneRootHandle> | null;
  primitivesNoop: CinematicPrimitivesAPI | null;
  primitivesReal: CinematicPrimitivesAPI | null;
}

const registry: SharedRegistry = {
  loaders: null,
  fontAtlas: null,
  sceneRoot: null,
  sceneRootPromise: null,
  primitivesNoop: null,
  primitivesReal: null,
};

const PRIMITIVE_NAMES: readonly CinematicPrimitiveName[] = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
];

/** Build a no-op primitives API. Every primitive returns a PrimitiveResult
 *  whose `cleanup` is a no-op and whose `timeline` is a stub. The editor
 *  uses this when `runPrimitives: false` so the factory's primitive-loop
 *  walks without animating anything. */
function buildNoopPrimitivesAPI(): CinematicPrimitivesAPI {
  const out = {} as CinematicPrimitivesAPI;
  for (const name of PRIMITIVE_NAMES) {
    out[name] = (_target, _params): PrimitiveResult => ({
      // gsap.core.Timeline is structural; the factory only needs `kill()`
      // to be callable on the cleanup path.
      timeline: { kill: () => {} } as unknown as PrimitiveResult['timeline'],
      cleanup: () => {},
    });
  }
  return out;
}

export function getSharedLoaders(): LoaderCacheHandle {
  if (!registry.loaders) {
    registry.loaders = createLoaderCache();
  }
  return registry.loaders;
}

export function getSharedFontAtlas(): FontAtlasHandle {
  if (!registry.fontAtlas) {
    registry.fontAtlas = createFontAtlas();
  }
  return registry.fontAtlas;
}

/** Lazy singleton scene root. In a node test env the renderer is skipped
 *  (`noRenderer: true`) — scene/camera/lights are still constructed so
 *  primitives can target them. Production callers (PrismHost) can pre-warm
 *  this with their own canvas via the runtime mount path; on subsequent
 *  calls the same handle is returned. */
export function getSharedSceneRoot(): Promise<SceneRootHandle> {
  if (registry.sceneRoot) return Promise.resolve(registry.sceneRoot);
  if (!registry.sceneRootPromise) {
    registry.sceneRootPromise = createSceneRoot({ noRenderer: true }).then((h) => {
      registry.sceneRoot = h;
      return h;
    });
  }
  return registry.sceneRootPromise;
}

/** Build the shared NodeContext. Synchronous — when `runPrimitives: true`
 *  and no scene root exists yet, primitives are wired to a fallback
 *  scene/camera Group/PerspectiveCamera proxy that PrismHost replaces on
 *  mount via the live-bind path. The first concrete scene root resolved
 *  via `getSharedSceneRoot()` becomes the canonical primitives target. */
export function getSharedNodeContext(opts: {
  runPrimitives: boolean;
}): NodeContext {
  const loaders = getSharedLoaders();
  const fontAtlas = getSharedFontAtlas();

  let primitives: CinematicPrimitivesAPI;
  if (opts.runPrimitives) {
    if (!registry.primitivesReal) {
      // Real primitives need scene/camera. If the scene root has been
      // resolved (host called `getSharedSceneRoot()` already), bind to it.
      // Otherwise bind to a placeholder context — primitives invoked before
      // scene-root resolution will operate on the placeholder, which is
      // fine for unit tests and is replaced by the host's mount.
      if (registry.sceneRoot) {
        registry.primitivesReal = makePrimitivesAPI({
          scene: registry.sceneRoot.scene,
          camera: registry.sceneRoot.camera,
          renderer: registry.sceneRoot.renderer,
        });
      } else {
        // Lazy placeholder: bare Scene + default camera so the primitives'
        // typing stays satisfied. PrismHost's mount path can re-derive
        // primitives from a real scene root once the canvas is bound.
        registry.primitivesReal = makePrimitivesAPI({
          scene: new Scene(),
          camera: new PerspectiveCamera(),
          renderer: null,
        });
      }
    }
    primitives = registry.primitivesReal;
  } else {
    if (!registry.primitivesNoop) {
      registry.primitivesNoop = buildNoopPrimitivesAPI();
    }
    primitives = registry.primitivesNoop;
  }

  return {
    // RT-SC-02 / INV-R1 — the single bundled `three`. codeRef modules read
    // their THREE classes from here so a native import() of a codeRef module
    // can never pull a second `three` from a CDN import-map.
    THREE,
    textureLoader: { loadTexture: loaders.loadTexture },
    glbLoader: { loadGLB: loaders.loadGLB },
    fontAtlas,
    primitives,
    emit: () => {},
  };
}

/** Test-only: clear the registry so each test starts with fresh singletons.
 *  Disposes any constructed handles to avoid leaks across test files. */
export function __resetSharedContext(): void {
  if (registry.loaders) {
    try { registry.loaders.dispose(); } catch { /* ignore */ }
  }
  if (registry.fontAtlas) {
    try { registry.fontAtlas.dispose(); } catch { /* ignore */ }
  }
  if (registry.sceneRoot) {
    try { registry.sceneRoot.dispose(); } catch { /* ignore */ }
  }
  registry.loaders = null;
  registry.fontAtlas = null;
  registry.sceneRoot = null;
  registry.sceneRootPromise = null;
  registry.primitivesNoop = null;
  registry.primitivesReal = null;
}
