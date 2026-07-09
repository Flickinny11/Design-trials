// THREE-D-BACKGROUNDS — React hook: resolve the live device tier for the 3D
// background library. Wraps the pure `resolveBackgroundTier` with real runtime
// signals (renderer backend, editor device-mode, backing-store width, cores).
//
// Lives in the R3F component layer (uses `useThree` + the editor store), so the
// pure tier module stays React/DOM-free and unit-testable.

import { useThree } from "@react-three/fiber";
import { useGraphEditorStore } from "@/stores/useGraphEditorStore";
import {
  resolveBackgroundTier,
  type DeviceTier,
  type TierBudget,
  TIER_BUDGET,
} from "@/lib/editor/backgrounds/tier";

/** Detect whether the live renderer is the WebGPU backend (vs WebGL2 fallback). */
function rendererIsWebGPU(gl: unknown): boolean {
  const r = gl as {
    isWebGPURenderer?: boolean;
    backend?: { isWebGPUBackend?: boolean };
  } | null;
  if (!r) return false;
  if (r.backend?.isWebGPUBackend) return true;
  // Before/without a resolved backend, fall back to the renderer flag.
  return !!r.isWebGPURenderer && r.backend?.isWebGPUBackend !== false;
}

export interface BackgroundTierInfo {
  tier: DeviceTier;
  budget: TierBudget;
  isWebGPU: boolean;
}

export function useBackgroundTier(
  forceTier?: DeviceTier | null,
): BackgroundTierInfo {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const deviceMode = useGraphEditorStore((s) => s.deviceMode);

  const isWebGPU = rendererIsWebGPU(gl);
  // Backing-store width = CSS width × DPR (the real drawing-buffer width).
  const viewportWidth = Math.round(size.width * (dpr || 1));
  const cores =
    typeof navigator !== "undefined" &&
    typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : undefined;

  // forceTier (verification only) pins the tier so the harness can capture the
  // SAME preset at T0 and T2 (C4). Otherwise resolve from real signals (D4).
  const tier =
    forceTier ??
    resolveBackgroundTier({ isWebGPU, deviceMode, viewportWidth, cores });
  return { tier, budget: TIER_BUDGET[tier], isWebGPU };
}
