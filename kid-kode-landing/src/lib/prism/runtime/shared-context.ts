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
import { createDriverHub, type DriverHub } from './shared/drivers';
import { makeNodeDrivers, type NodeDrivers } from './shared/driver-dispatch';

interface SharedRegistry {
  loaders: LoaderCacheHandle | null;
  fontAtlas: FontAtlasHandle | null;
  sceneRoot: SceneRootHandle | null;
  sceneRootPromise: Promise<SceneRootHandle> | null;
  primitivesNoop: CinematicPrimitivesAPI | null;
  primitivesReal: CinematicPrimitivesAPI | null;
  // STEP7 — the singleton DriverHub (scroll / pointer / state / event sources +
  // frame ticker) and the bound NodeDrivers surface the factory consumes.
  driverHub: DriverHub | null;
  nodeDrivers: NodeDrivers | null;
}

const registry: SharedRegistry = {
  loaders: null,
  fontAtlas: null,
  sceneRoot: null,
  sceneRootPromise: null,
  primitivesNoop: null,
  primitivesReal: null,
  driverHub: null,
  nodeDrivers: null,
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

/** Singleton DriverHub. Shared by the curried primitives (which read
 *  `pointer` / `scroll` from it) and the host (GraphScene's SceneDriverHost,
 *  which pushes real pointer / scroll / state / event input and ticks the
 *  frame driver). One instance ⇒ the same scroll/pointer a primitive
 *  subscribes to is the one the host drives. */
export function getSharedDriverHub(): DriverHub {
  if (!registry.driverHub) {
    registry.driverHub = createDriverHub();
  }
  return registry.driverHub;
}

function getSharedNodeDrivers(): NodeDrivers {
  if (!registry.nodeDrivers) {
    registry.nodeDrivers = makeNodeDrivers(getSharedDriverHub());
  }
  return registry.nodeDrivers;
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
      // STEP7 — bind the curried primitives to the singleton DriverHub's
      // pointer / scroll sources + event emitter so node-declared interactive
      // animations (parallax-scroll, magnetic-cursor, …) receive real input
      // in the built view. Scene/camera come from the resolved scene root when
      // present, else a placeholder; the driver sources are the hub's either
      // way (the same instances the host drives).
      const hub = getSharedDriverHub();
      const driverCtx = {
        pointer: hub.pointer,
        scroll: hub.scroll,
        emit: (event: string, payload: unknown) => hub.events.fire(event, payload),
      };
      if (registry.sceneRoot) {
        registry.primitivesReal = makePrimitivesAPI({
          scene: registry.sceneRoot.scene,
          camera: registry.sceneRoot.camera,
          renderer: registry.sceneRoot.renderer,
          ...driverCtx,
        });
      } else {
        // Lazy placeholder: bare Scene + default camera so the primitives'
        // typing stays satisfied. PrismHost's mount path can re-derive
        // primitives from a real scene root once the canvas is bound.
        registry.primitivesReal = makePrimitivesAPI({
          scene: new Scene(),
          camera: new PerspectiveCamera(),
          renderer: null,
          ...driverCtx,
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
    // FIDELITY-2 W3 — the video lane rides the SAME shared loader cache, so
    // the same URL yields the same VideoTexture across every surface.
    videoLoader: { loadVideo: loaders.loadVideo },
    fontAtlas,
    primitives,
    // STEP7 — when running primitives (the built-state surface), route `emit`
    // through the hub's event bus and expose the `drivers` surface so the
    // factory can wire each node-declared animation to its declared driver.
    // The no-op editor context (runPrimitives:false) keeps the inert defaults.
    emit: opts.runPrimitives
      ? (event, payload) => getSharedDriverHub().events.fire(event, payload)
      : () => {},
    drivers: opts.runPrimitives ? getSharedNodeDrivers() : undefined,
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
  if (registry.driverHub) {
    try { registry.driverHub.reset(); } catch { /* ignore */ }
  }
  registry.loaders = null;
  registry.fontAtlas = null;
  registry.sceneRoot = null;
  registry.sceneRootPromise = null;
  registry.primitivesNoop = null;
  registry.primitivesReal = null;
  registry.driverHub = null;
  registry.nodeDrivers = null;
}
