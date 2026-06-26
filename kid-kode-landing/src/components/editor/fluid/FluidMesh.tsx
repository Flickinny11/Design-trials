'use client';

// FluidMesh — dispatches a realized fluid NODE to its renderer by kind (spec §3.1):
//   surface → FluidSurface (liquid glass; the verified-everywhere ping-pong core).
//   volume  → FluidVolume  (MLS-MPM particle fluid on real WebGPU; gracefully falls
//             back to a thick surface slab on the WebGL2 backend).

import { FluidSurface } from './FluidSurface';
import { FluidVolume } from './FluidVolume';
import type { FluidSchema } from './fluid-schema';

export function FluidMesh({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  if (schema.kind === 'volume') {
    return <FluidVolume schema={schema} selected={selected} onSelect={onSelect} />;
  }
  return <FluidSurface schema={schema} selected={selected} onSelect={onSelect} />;
}
