'use client';

// use-fluid-font — MSDF font readiness for the /fluid-lab route, on the SAME
// proven path the production WebGPU scene uses (HubLabels): the shared text-atlas
// registry (`resolveTextAtlas`/`peekTextAtlas`) + `createTextObject`. NOT the
// `createFontAtlas`/`createText` factory (that returns geometry-less placeholder
// Groups unless a WebGPU bootstrap warms its lazy factory — which silently fails
// on this route).
//
// WebGPU-native MSDF (NodeMaterial) — no Troika, no drei <Text>, no raw
// ShaderMaterial, no DOM. Returns the loaded atlas once it resolves, else null.

import { useEffect, useState } from 'react';
import { peekTextAtlas, resolveTextAtlas } from '@/lib/prism/runtime/shared/text-atlas';
import type { LoadedFontAtlas } from '@/lib/prism/text/contract';

// Inter 400 is the core-baked weight (the legacy atlas pair the editor warms).
export const FLUID_FONT_FAMILY = 'Inter';
export const FLUID_FONT_WEIGHT = 400;

/** React hook: the loaded MSDF atlas for Inter 400 once ready, else null. Sync
 *  cache peek first (warm registry mounts labels immediately), else resolve async
 *  and flip state when it lands. Client-only; the effect never runs during SSR. */
export function useFluidFont(): LoadedFontAtlas | null {
  const [atlas, setAtlas] = useState<LoadedFontAtlas | null>(
    () => peekTextAtlas(FLUID_FONT_FAMILY, FLUID_FONT_WEIGHT) ?? null,
  );
  useEffect(() => {
    if (atlas) return;
    let cancelled = false;
    resolveTextAtlas(FLUID_FONT_FAMILY, FLUID_FONT_WEIGHT)
      .then((a) => { if (!cancelled) setAtlas(a); })
      .catch((err) => { console.warn('[useFluidFont] Inter MSDF atlas resolve failed:', (err as Error).message); });
    return () => { cancelled = true; };
  }, [atlas]);
  return atlas;
}
