'use client';

// use-fluid-font — module-singleton MSDF font loader for the /fluid-lab route.
//
// WHY: the /fluid-lab scene renders on a `three/webgpu` WebGPURenderer, where the
// chassis `EngravedText` (drei <Text> / Troika, a raw ShaderMaterial) is
// INCOMPATIBLE ("THREE.NodeBuilder: Material ShaderMaterial is not compatible")
// and silently fails to render. This loader warms a single WebGPU-native MSDF
// `FontAtlasHandle` (from runtime/shared/text.ts → `three-msdf-text-webgpu`,
// a NodeMaterial) so `FluidEngravedText` can draw crisp labels with no DOM,
// no Troika, no raw ShaderMaterial.
//
// It loads the SAME core Inter atlas pair the editor already warms
// (/prism-assets/font-inter.msdf.{png,json}) the SAME way GraphScene does:
// `load()` then `warmupDefaultFactory()` (load() alone returns a placeholder
// Group from createText — the factory must be warmed for real glyphs).

import { useEffect, useState } from 'react';
import { createFontAtlas, type FontAtlasHandle } from '@/lib/prism/runtime/shared/text';

const ATLAS_PNG = '/prism-assets/font-inter.msdf.png';
const ATLAS_JSON = '/prism-assets/font-inter.msdf.json';

// World-unit ↔ atlas scale.
//
// The BMFont json carries `info.size = 64` (the px size the atlas was baked at).
// In `three-msdf-text-webgpu`, the glyph layout scale is `l = fontSize / info.size`
// (see dist: `t.fontCssStyles.fontSize / o.info?.size`), so passing
// `fontSize: ATLAS_EM_PX` (= info.size) to createText() lays glyphs out at raw
// atlas px — i.e. one em ≈ `ATLAS_EM_PX` geometry units. Troika's `fontSize`
// (what EngravedText callers pass, e.g. 0.2) is the em height in WORLD units.
// So to let callers keep passing EngravedText-style world-unit fontSizes, the
// returned text group is scaled by `fontSizeProp / ATLAS_EM_PX`. With em=64 a
// 0.2 fontSize → group.scale 0.2/64 = 0.003125, giving a cap height
// (~55px for 'A') of 55 * 0.003125 ≈ 0.17 world units — on par with Troika's
// 0.2-em cap (~0.14). FluidEngravedText applies this scale per instance.
export const ATLAS_EM_PX = 64;

// Single shared handle for the whole app (module singleton). StrictMode double-
// invoke and repeated component mounts all converge on this one warm.
let sharedHandle: FontAtlasHandle | null = null;
let warmPromise: Promise<FontAtlasHandle> | null = null;

/** Idempotent: returns the same warm promise on every call (StrictMode-safe,
 *  never throws during SSR — guarded by the 'use client' hook below). */
function warmFluidFont(): Promise<FontAtlasHandle> {
  if (warmPromise) return warmPromise;
  const handle = createFontAtlas();
  sharedHandle = handle;
  warmPromise = (async () => {
    await handle.load(ATLAS_PNG, ATLAS_JSON);
    // load() alone is not enough: createText() without a warmed factory returns
    // a placeholder Group. /fluid-lab runs under WebGPURenderer (the WebGL2
    // fallback also compiles the package's node material), so warming the
    // default factory is safe here — mirrors GraphScene's warmup path.
    await handle.warmupDefaultFactory?.();
    return handle;
  })();
  return warmPromise;
}

/** React hook: returns the shared FontAtlasHandle once it is loaded + warmed,
 *  else null. Re-renders the caller when the handle becomes ready. Client-only;
 *  the effect never runs during SSR so this is safe to import in server trees. */
export function useFluidFont(): FontAtlasHandle | null {
  // Seed from the singleton so a component mounting AFTER the warm already
  // resolved gets the handle on its first render (no extra paint).
  const [handle, setHandle] = useState<FontAtlasHandle | null>(() =>
    sharedHandle && sharedHandle.ready ? sharedHandle : null,
  );

  useEffect(() => {
    let cancelled = false;
    warmFluidFont()
      .then((h) => {
        if (!cancelled) setHandle(h);
      })
      .catch((err) => {
        // Never throw out of the effect — labels just stay un-rendered.
        console.warn('[useFluidFont] MSDF atlas warm failed:', (err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return handle;
}
