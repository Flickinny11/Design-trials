// Prebuilt element-cluster registry — the single source the library browser
// (Phase 1) and any AI authoring draw from (mirrors the Animatable primitive
// registry pattern, §13 + §8.3). Element definitions self-register on import;
// `src/lib/editor/elements/catalog/index.ts` imports every definition and
// registers it, exactly like animatable/primitives/index.ts.

import type { ElementCategory, ElementClusterDefinition } from './contract';

const REGISTRY = new Map<string, ElementClusterDefinition>();

/** Register a cluster definition. Last write wins (idempotent re-register is
 *  allowed so HMR / repeated imports never throw). */
export function registerElement(def: ElementClusterDefinition): void {
  REGISTRY.set(def.id, def);
}

export function getElement(id: string): ElementClusterDefinition | undefined {
  return REGISTRY.get(id);
}

/** All registered clusters, featured-first then label-sorted (stable browser
 *  order, no Math.random / Date). */
export function listElements(): ElementClusterDefinition[] {
  return [...REGISTRY.values()].sort((a, b) => {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function listElementsByCategory(cat: ElementCategory): ElementClusterDefinition[] {
  return listElements().filter((d) => d.category === cat);
}

/** Categories that actually have at least one registered element, in
 *  ELEMENT_CATEGORIES order (browser section headers). */
export function listPopulatedCategories(): ElementCategory[] {
  const present = new Set(listElements().map((d) => d.category));
  return [...present];
}

export function elementCount(): number {
  return REGISTRY.size;
}

/** Clear — test-only. */
export function __clearElementRegistry(): void {
  REGISTRY.clear();
}
