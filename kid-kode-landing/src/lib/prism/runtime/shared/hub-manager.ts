// HubManager — owns hubs as `THREE.Group`s and parents them under SceneRoot.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §12 (Hub Manager).
//
// activate(hubId)  -> sceneRoot.add(hubGroup); activatePrimitivesForHub(hubGroup)
// deactivate(hubId) -> derived from §8 cleanup contract: removes the hub
//                      group from its parent and invokes `userData.cleanup()`
//                      on each child node so geometries / materials / textures
//                      / GSAP timelines are released.
//
// Reparent-on-navigate is implicit: `Object3D.add()` removes from the prior
// parent, so calling `activate(otherHubId)` automatically detaches the
// currently-active hub.

import type { Group, Object3D, Scene } from 'three';

/** Subset of the SceneRoot surface the HubManager actually uses. Allows
 *  tests to inject a bare `THREE.Scene`. */
export interface HubManagerScene {
  scene: Scene;
}

export interface HubManagerHandle {
  /** Register a hub group. Idempotent: re-registering replaces the prior
   *  group for that id and disposes the old one if it was never activated. */
  register(hubId: string, group: Group): void;

  /** Activate a hub: parent its group under sceneRoot.scene and fire any
   *  pending 'load' / 'inview' primitives. Auto-deactivates the previously
   *  active hub. */
  activate(hubId: string): void;

  /** Deactivate a hub: detach its group and call `userData.cleanup()` on
   *  every descendant that exposes one. Re-registering is required before
   *  re-activation. */
  deactivate(hubId: string): void;

  /** Hub id of the currently mounted hub (or null). */
  getActive(): string | null;

  /** All registered hub ids, in registration order. */
  list(): string[];

  /** Dispose every registered hub group + clear internal state. */
  dispose(): void;
}

export interface CreateHubManagerOptions {
  /** Hook called when a hub becomes active. Used by primitives to fire
   *  `'inview'` triggers. Optional — primitives can also self-trigger via
   *  their own scroll/timeline observers. */
  onActivate?: (hubId: string, group: Group) => void;
  /** Hook called as part of deactivation, before cleanup. */
  onDeactivate?: (hubId: string, group: Group) => void;
}

/** Default cleanup walker: invokes `userData.cleanup()` on every descendant
 *  that exposes one. Exported for direct use by adapters/tests. */
export function disposeHubGroup(group: Object3D): void {
  group.traverse((obj) => {
    const cleanup = (obj as Object3D & { userData: { cleanup?: () => void } }).userData?.cleanup;
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        // best-effort: continue disposing siblings
      }
    }
  });
}

export function createHubManager(
  sceneRoot: HubManagerScene,
  options: CreateHubManagerOptions = {},
): HubManagerHandle {
  // Insertion-ordered map preserves registration order for `list()`.
  const hubs = new Map<string, Group>();
  let activeId: string | null = null;

  function deactivateInternal(hubId: string, fireHook: boolean): void {
    const group = hubs.get(hubId);
    if (!group) return;
    if (fireHook) options.onDeactivate?.(hubId, group);
    if (group.parent) group.parent.remove(group);
    disposeHubGroup(group);
    if (activeId === hubId) activeId = null;
  }

  function register(hubId: string, group: Group): void {
    const prior = hubs.get(hubId);
    if (prior && prior !== group) {
      // If the prior group was never activated (no parent), dispose it; if it
      // was the active hub, deactivate first.
      if (activeId === hubId) {
        deactivateInternal(hubId, true);
      } else {
        disposeHubGroup(prior);
      }
    }
    hubs.set(hubId, group);
  }

  function activate(hubId: string): void {
    const group = hubs.get(hubId);
    if (!group) {
      throw new Error(`HubManager.activate: unknown hubId "${hubId}"`);
    }
    if (activeId && activeId !== hubId) {
      // Detach the prior hub (no cleanup — reparenting is non-destructive
      // per §12). Cleanup happens on explicit deactivate.
      const prior = hubs.get(activeId);
      if (prior?.parent) prior.parent.remove(prior);
    }
    sceneRoot.scene.add(group);
    activeId = hubId;
    options.onActivate?.(hubId, group);
  }

  function deactivate(hubId: string): void {
    deactivateInternal(hubId, true);
  }

  function getActive(): string | null {
    return activeId;
  }

  function list(): string[] {
    return Array.from(hubs.keys());
  }

  function dispose(): void {
    for (const id of Array.from(hubs.keys())) {
      deactivateInternal(id, false);
    }
    hubs.clear();
    activeId = null;
  }

  return { register, activate, deactivate, getActive, list, dispose };
}
