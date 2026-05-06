// codeRef factory dispatch — Plan §P9.
//
// Per spec §8 (createNode contract), every node that ships a hand-authored
// or codegen-emitted module exposes a default-exported `createNode(config,
// ctx) -> THREE.Object3D`. The runtime resolves the module by URL,
// caches the resolved factory, and dispatches per-node:
//
//   - if `node.codeRef` is set → dynamic-import the module, invoke its
//     default export. The wrapper returns a placeholder Group synchronously
//     (sync createNode contract) and grafts the imported factory's output
//     under it once the import resolves.
//   - if `node.codeRef` is unset → fall back to the supplied default factory
//     (typically `defaultRenderModeFactory`).
//   - if the import REJECTS → fall back to the default factory and graft
//     its output (keep the node visible rather than tearing the scene).
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §8 (createNode contract — sync
//     return, userData.cleanup walk).
//   - PRISM-RENDERER-MIGRATION-SPEC.md §10 (verifier — codeRef modules must
//     default-export a function).

import { Group, type Object3D } from 'three';
import type {
  CreateNodeFn,
  NodeContext,
} from '../shared/adapter';
import { applyScenePosition } from '../shared/adapter';
import type { PrismNode } from '@/lib/prism-graph/types';

const cache = new Map<string, Promise<CreateNodeFn>>();

/** Dynamic-import a codeRef module and return its default-exported factory.
 *  Cached by URL: same URL ⇒ same Promise across the session. The cache
 *  retains the rejected promise too so a broken module isn't re-fetched on
 *  every render tick. */
export function resolveCodeRef(url: string): Promise<CreateNodeFn> {
  const existing = cache.get(url);
  if (existing) return existing;
  const p = import(/* @vite-ignore */ url).then((mod: unknown) => {
    const fn = (mod as { default?: unknown })?.default;
    if (typeof fn !== 'function') {
      throw new Error(`coderef-factory: ${url} did not default-export a function`);
    }
    return fn as CreateNodeFn;
  });
  cache.set(url, p);
  return p;
}

/** Test-only escape hatch. Drops the in-memory cache and (optionally)
 *  preseeds it with synchronous factories or rejection sentinels keyed by
 *  URL. The string `'__reject__'` is treated as a rejecting promise. */
export function __resetCodeRefCache(
  preseed?: Record<string, CreateNodeFn | '__reject__'>,
): void {
  cache.clear();
  if (!preseed) return;
  for (const [url, value] of Object.entries(preseed)) {
    if (value === '__reject__') {
      const rejecting = Promise.reject<CreateNodeFn>(
        new Error(`coderef-factory: preseeded rejection for ${url}`),
      );
      // Swallow the unhandled-rejection warning for this side-channel.
      rejecting.catch(() => {});
      cache.set(url, rejecting);
    } else {
      cache.set(url, Promise.resolve(value));
    }
  }
}

/** Wrap the default factory so callers can pass a single `createNode` to
 *  the adapter and have per-node codeRef dispatch happen internally. */
export function buildPerNodeFactory(defaultFactory: CreateNodeFn): CreateNodeFn {
  return function perNodeFactory(node: PrismNode, ctx: NodeContext): Object3D {
    if (!node.codeRef) {
      return defaultFactory(node, ctx);
    }

    // Sync placeholder Group — kept identity-stable so the live-bind layer's
    // upsertNode / scene graph references remain valid even before the
    // module resolves.
    const placeholder = new Group();
    placeholder.name = `node:${node.nodeId}`;
    placeholder.userData.nodeId = node.nodeId;
    placeholder.userData.handlers = {};
    let cleaned = false;
    let graftedCleanup: (() => void) | null = null;
    placeholder.userData.cleanup = () => {
      cleaned = true;
      if (graftedCleanup) {
        try { graftedCleanup(); } catch { /* ignore */ }
        graftedCleanup = null;
      }
    };

    // Apply scenePosition eagerly on the placeholder. The grafted child
    // owns its own internal transform; we keep the parent at the spec
    // location so transitions look correct even mid-load.
    applyScenePosition(placeholder, node.scenePosition);

    void resolveCodeRef(node.codeRef)
      .then((factory) => {
        if (cleaned) return;
        const child = factory(node, ctx);
        graftAs(placeholder, child);
        graftedCleanup = pickCleanup(child);
      })
      .catch(() => {
        if (cleaned) return;
        // Keep the node visible: graft the default factory's output so the
        // editor doesn't end up with an empty Group for a broken codeRef.
        try {
          const fallback = defaultFactory(node, ctx);
          graftAs(placeholder, fallback);
          graftedCleanup = pickCleanup(fallback);
        } catch {
          /* default factory itself failed — nothing more we can do */
        }
      });

    return placeholder;
  };
}

function graftAs(parent: Group, child: Object3D): void {
  // The codeRef module typically returns a Group already named
  // `node:<nodeId>`. We graft as a child so the placeholder retains the
  // top-level identity the live-bind layer holds in `adapterResult.nodes`.
  // Reset child transform — the placeholder already carries the
  // scenePosition. (codeRef modules also apply it internally; double-apply
  // would compound. Authored modules use their own transform on the inner
  // mesh, not the returned root.)
  if (parent.children.length === 0) {
    parent.add(child);
  } else {
    // Replace any prior grafted child (e.g., previous failed graft).
    const prior = parent.children[0];
    parent.remove(prior);
    const cleanup = (prior.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
    parent.add(child);
  }
}

function pickCleanup(obj: Object3D): (() => void) | null {
  const fn = (obj.userData as { cleanup?: () => void }).cleanup;
  return typeof fn === 'function' ? fn : null;
}
