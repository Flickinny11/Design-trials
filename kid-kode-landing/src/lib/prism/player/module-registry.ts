// Dynamically import node createNode() modules from in-memory source strings.
// Each module is materialized as a blob URL and imported.
//
// The import map for the module (THREE, gsap, atlas, …) is NOT resolved by
// the module itself — node modules follow the ctx-injection pattern and
// receive dependencies via the `ctx` argument to `createNode(config, ctx)`.
// That keeps the node modules as pure ES modules with zero external import
// statements.
//
// Phase 5: PIXI no longer exists in the bundle (spec §15 L504-L509). The
// authoritative `NodeContext` lives at
// `src/lib/prism/runtime/shared/adapter.ts` and is what generated nodes
// receive at runtime. This file provides only the dynamic-import surface.

import type { Object3D } from 'three';

/** Result of invoking a generated `createNode(config, ctx)`. */
export interface NodeInstance {
  /** Returned `THREE.Object3D` (typically a `THREE.Group`). */
  object: Object3D;
  /** Composed cleanup: dispose geometries/materials/textures, kill timelines. */
  teardown: () => void;
}

/** Spec §8 createNode shape. The first argument is the node config; the
 *  second is the ctx supplied by the runtime. */
export type CreateNode = (config: unknown, ctx: unknown) => Object3D;

// dynamicImport avoids webpack static analysis — Next.js / Turbopack will
// otherwise try to resolve the blob URL at build time and fail. The Function
// constructor creates the import expression at runtime.
const dynamicImport: (url: string) => Promise<Record<string, unknown>> =
  typeof globalThis.Function === 'function'
    ? (new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>)
    : ((u: string) => import(/* webpackIgnore: true */ u) as Promise<Record<string, unknown>>);

export async function loadNodeModule(source: string): Promise<{ createNode: CreateNode }> {
  const blob = new Blob([source], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const mod = await dynamicImport(url);
    const createNode = (mod.createNode ?? mod.default) as unknown;
    if (typeof createNode !== 'function') {
      throw new Error('node module missing createNode() / default export');
    }
    return { createNode: createNode as CreateNode };
  } finally {
    URL.revokeObjectURL(url);
  }
}
