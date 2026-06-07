// Animatable primitive registry — the single source both the picker and
// (future) AI authoring draw from (spec §8.3 "Both draw from the same
// Animatable registry"). Separate from the closed 9-name cinematic union.

import type { PrimitiveCategory, PrimitiveDefinition } from './contract';

const REGISTRY = new Map<string, PrimitiveDefinition>();

/** Register a primitive definition. Last write wins (idempotent re-register
 *  is allowed so HMR / repeated imports don't throw). */
export function registerPrimitive(def: PrimitiveDefinition): void {
  REGISTRY.set(def.name, def);
}

export function getPrimitive(name: string): PrimitiveDefinition | undefined {
  return REGISTRY.get(name);
}

export function listPrimitives(): PrimitiveDefinition[] {
  return [...REGISTRY.values()];
}

export function listByCategory(cat: PrimitiveCategory): PrimitiveDefinition[] {
  return listPrimitives().filter((d) => d.category === cat);
}

export function primitiveCount(): number {
  return REGISTRY.size;
}

/** Clear — test-only. */
export function __clearRegistry(): void {
  REGISTRY.clear();
}
