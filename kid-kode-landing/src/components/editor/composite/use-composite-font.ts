'use client';

// use-composite-font — MSDF font readiness for /composite-lab, on the SAME proven
// path the production WebGPU scene uses (HubLabels / FluidEngravedText): the shared
// text-atlas registry (resolveTextAtlas / peekTextAtlas) + createTextObject. Inter
// 400 is the core-baked weight the editor warms. Returns the atlas once ready, else
// null. WebGPU-native — no Troika, no drei <Text>, no DOM.

import { useEffect, useState } from 'react';
import { peekTextAtlas, resolveTextAtlas } from '@/lib/prism/runtime/shared/text-atlas';
import type { LoadedFontAtlas } from '@/lib/prism/text/contract';

export const COMPOSITE_FONT_FAMILY = 'Inter';
export const COMPOSITE_FONT_WEIGHT = 400;

export function useCompositeFont(): LoadedFontAtlas | null {
  const [atlas, setAtlas] = useState<LoadedFontAtlas | null>(
    () => peekTextAtlas(COMPOSITE_FONT_FAMILY, COMPOSITE_FONT_WEIGHT) ?? null,
  );
  useEffect(() => {
    if (atlas) return;
    let cancelled = false;
    resolveTextAtlas(COMPOSITE_FONT_FAMILY, COMPOSITE_FONT_WEIGHT)
      .then((a) => { if (!cancelled) setAtlas(a); })
      .catch((err) => { console.warn('[useCompositeFont] Inter MSDF atlas resolve failed:', (err as Error).message); });
    return () => { cancelled = true; };
  }, [atlas]);
  return atlas;
}
