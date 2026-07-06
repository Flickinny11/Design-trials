// PRISM SHELL-W10 — generative adapter REGISTRY (D1 swap seam). Server-only.
//
// The single place that assembles the generative adapters. Route handlers import
// THIS; client components never import an adapter (INV-NEV2-4). Adding or swapping
// a vendor is one entry here + one adapter file — zero UI rework. Live-vs-stub is
// each adapter's own concern (key present → live; absent → demo-safe / stub).
import 'server-only';
import type { GenerativeCapabilityAdapter, GenerativeCapabilityDescriptor } from '../../../lib/capabilities/generative';
import { GENERATIVE_BY_ID } from '../../../lib/capabilities/generative-catalog';
import { TripoAdapter } from './tripo-adapter';
import { ReplicateAdapter } from './replicate-adapter';
import { FluxMaterialAdapter } from './flux-material-adapter';
import { MarbleAdapter, MeshyAdapter, MeshOpsAdapter } from './stub-adapters';

let cached: GenerativeCapabilityAdapter[] | null = null;

export function getGenerativeAdapters(): GenerativeCapabilityAdapter[] {
  if (cached) return cached;
  cached = [
    new TripoAdapter(),
    new ReplicateAdapter(),
    new FluxMaterialAdapter(),
    new MarbleAdapter(),
    new MeshyAdapter(),
    new MeshOpsAdapter(),
  ];
  return cached;
}

export function getAdapterById(id: string): GenerativeCapabilityAdapter | undefined {
  return getGenerativeAdapters().find((a) => a.id === id);
}

export function getAdapterForCapability(capabilityId: string): GenerativeCapabilityAdapter | undefined {
  const desc = GENERATIVE_BY_ID[capabilityId];
  if (!desc) return undefined;
  return getAdapterById(desc.adapterId);
}

/** All capability descriptors with their adapter's live flag stamped (for tiles). */
export function listAllCapabilities(): GenerativeCapabilityDescriptor[] {
  return getGenerativeAdapters().flatMap((a) => a.listCapabilities());
}

export function __resetGenerativeRegistry(): void { cached = null; }
