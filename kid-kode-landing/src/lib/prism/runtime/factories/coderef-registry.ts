// Bundled codeRef factory registry (FIX2 / G1 — the FIRST real use of codeRef).
//
// `resolveCodeRef` (coderef-factory.ts) does a runtime `import(url)`, which a
// Next/webpack bundle CANNOT resolve to a bundled TS module from a literal string
// URL. So bundled factories register here under a stable `codeRef` key, and
// `resolveCodeRef` consults this map BEFORE attempting a dynamic URL import. A
// node whose `codeRef` is a registry key (e.g. 'builtin:atelier-watch') mounts
// its bundled factory; a node whose `codeRef` is a real ESM URL still falls
// through to dynamic import. Keys are namespaced `builtin:*` to never collide
// with a real URL.
//
// This file is DOM-free (FP-05) — it only wires factory references.

import type { CreateNodeFn } from '../shared/adapter';
import createWatchNode from '@/lib/prism/atelier/watch-node-factory';

const REGISTRY = new Map<string, CreateNodeFn>([
  // ORRERY No.7 atelier watch — the hero artifact, now a graph node.
  ['builtin:atelier-watch', createWatchNode as unknown as CreateNodeFn],
]);

/** Resolve a bundled codeRef factory by its registry key, or undefined when the
 *  `codeRef` is not a builtin (a real URL → caller falls back to dynamic import). */
export function getRegisteredCodeRef(key: string): CreateNodeFn | undefined {
  return REGISTRY.get(key);
}

/** Register (or override) a bundled codeRef factory. Test/extension hook. */
export function registerCodeRef(key: string, fn: CreateNodeFn): void {
  REGISTRY.set(key, fn);
}
