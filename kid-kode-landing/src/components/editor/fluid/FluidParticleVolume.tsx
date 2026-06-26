'use client';

// FluidParticleVolume — the MLS-MPM particle fluid (spec §3.1), WebGPU-ONLY.
// Mounted by FluidVolume only when renderer.backend.isWebGPUBackend is true.
//
// (w-fluid scaffold: renders the liquid-glass surface so the volume node is never
//  empty; the real compute()-based MLS-MPM particle sim lands in w-liquidglass.)

import { FluidSurface } from './FluidSurface';
import type { FluidSchema } from './fluid-schema';

export function FluidParticleVolume({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  return <FluidSurface schema={schema} selected={selected} onSelect={onSelect} />;
}
