'use client';

// FluidVolume — the VOLUMETRIC fluid node (spec §3.1, MLS-MPM particle path).
//
// Real WebGPU compute (compute()/StorageBuffer MLS-MPM) is WebGPU-ONLY — it cannot
// run on the WebGL2 fallback (no compute shaders). So this component FEATURE-GATES
// on `renderer.backend.isWebGPUBackend`:
//   • real WebGPU (the founder's Metal GPU) → an MLS-MPM particle fluid volume.
//   • WebGL2 fallback (headless verify / no-WebGPU clients) → a thick liquid-glass
//     SURFACE slab stands in (the verified-everywhere core), so the node always
//     renders and is never dark. This is the ANTI-STUCK alternative made explicit.
//
// Either way the node is a genuine backing node (Node Law) carrying the same
// userData the surface path uses.

import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { FluidSurface } from './FluidSurface';
import { FluidParticleVolume } from './FluidParticleVolume';
import type { FluidSchema } from './fluid-schema';

export function FluidVolume({
  schema,
  selected,
  onSelect,
}: {
  schema: FluidSchema;
  selected: boolean;
  onSelect: (nodeId: string | null) => void;
}) {
  const gl = useThree((s) => s.gl);
  const probed = useRef(false);
  const [isWebGPU, setIsWebGPU] = useState(false);

  useEffect(() => {
    if (probed.current) return;
    probed.current = true;
    const backend = (gl as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    setIsWebGPU(!!backend?.isWebGPUBackend);
  }, [gl]);

  if (isWebGPU) {
    return <FluidParticleVolume schema={schema} selected={selected} onSelect={onSelect} />;
  }
  // WebGL2 fallback — the liquid-glass surface stands in (verified-everywhere core).
  return <FluidSurface schema={schema} selected={selected} onSelect={onSelect} />;
}
