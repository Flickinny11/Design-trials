// THREE-D-BACKGROUNDS — device capability tier map + resolver (D4 / INV-10).
//
// The 3D background library never runs its heavy path by default (FP-4). A
// device tier T0/T1/T2 is resolved from real capability signals and drives a
// per-tier BUDGET that the procedural layer components read:
//   - T2 (desktop / WebGPU backend) — full raymarch + GPU-compute particles
//     + Gaussian splat allowed.
//   - T1 (mid / WebGPU backend, constrained viewport) — reduced raymarch steps
//     + compute particles, no splat.
//   - T0 (mobile / WebGL2 backend) — low-step billboard nebula + instanced CPU
//     Points, splat dropped.
//
// Pure data + a pure resolver here (no React, no DOM) so it is unit-testable and
// importable anywhere. The React hook lives in the R3F component layer.

import type { LightingTier } from '../../prism-graph/types';

export type DeviceTier = LightingTier; // 'T0' | 'T1' | 'T2'

export interface TierBudget {
  /** Raymarch step count for the volumetric nebula (cost ∝ steps). */
  raymarchSteps: number;
  /** Light-march steps for self-shadowing (0 = skip self-shadow on T0). */
  lightMarchSteps: number;
  /** Target particle count for the depth-scattered field. */
  particleCount: number;
  /** Whether the WebGPU compute path may be used for particles. */
  compute: boolean;
  /** Whether a Gaussian-splat layer may mount. */
  splat: boolean;
  /** Device-pixel-ratio cap applied to heavy offscreen passes. */
  dprCap: number;
}

// particleCount is the per-tier TOTAL the field scales by variant countScale +
// the density slider. Billboard sprites are area-heavy (each a soft quad), so a
// tasteful starfield is thousands, not tens of thousands (the latter reads as a
// blizzard / additive white-out).
export const TIER_BUDGET: Readonly<Record<DeviceTier, TierBudget>> = Object.freeze({
  T2: { raymarchSteps: 28, lightMarchSteps: 3, particleCount: 16000, compute: true, splat: true, dprCap: 2 },
  T1: { raymarchSteps: 18, lightMarchSteps: 2, particleCount: 8000, compute: true, splat: false, dprCap: 2 },
  T0: { raymarchSteps: 8, lightMarchSteps: 0, particleCount: 2800, compute: false, splat: false, dprCap: 1.5 },
});

export const TIER_ORDER: Readonly<Record<DeviceTier, number>> = Object.freeze({ T0: 0, T1: 1, T2: 2 });

/** Is `tier` at least `floor`? Used to gate `minTier` layers (e.g. splat → T2). */
export function tierMeets(tier: DeviceTier, floor: DeviceTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[floor];
}

export interface TierSignals {
  /** True when the live renderer backend is WebGPU (vs the WebGL2 fallback). */
  isWebGPU: boolean;
  /** Editor device-mode preview ('desktop' | 'tablet' | 'constrained' | 'mobile'). */
  deviceMode?: string;
  /** Backing-store width in px (the real drawing-buffer width). */
  viewportWidth?: number;
  /** navigator.hardwareConcurrency when known (0/undefined = unknown). */
  cores?: number;
}

// Device-mode coarse ceiling: a phone-sized preview never gets T2 even on a
// WebGPU laptop, so mobile/constrained verification reflects the shipped tier.
const DEVICE_MODE_CEIL: Record<string, DeviceTier> = {
  mobile: 'T0',
  constrained: 'T1',
  tablet: 'T1',
  desktop: 'T2',
};

/**
 * Resolve the device tier from capability signals. Conservative by design: the
 * heavy path only unlocks on a WebGPU backend AND a desktop-class surface.
 */
export function resolveBackgroundTier(signals: TierSignals): DeviceTier {
  const { isWebGPU, deviceMode, viewportWidth, cores } = signals;
  // WebGL2 fallback is always T0 — no compute, low raymarch.
  if (!isWebGPU) return 'T0';

  // Start from the device-mode ceiling, then clamp by raw width/cores.
  let tier: DeviceTier = (deviceMode && DEVICE_MODE_CEIL[deviceMode]) || 'T2';

  if (typeof viewportWidth === 'number' && viewportWidth > 0) {
    // Backing-store width (DPR-multiplied) thresholds: phones land < ~1100.
    if (viewportWidth < 1100) tier = lower(tier, 'T0');
    else if (viewportWidth < 1700) tier = lower(tier, 'T1');
  }
  if (typeof cores === 'number' && cores > 0 && cores <= 4) {
    tier = lower(tier, 'T1');
  }
  return tier;
}

function lower(a: DeviceTier, b: DeviceTier): DeviceTier {
  return TIER_ORDER[a] <= TIER_ORDER[b] ? a : b;
}
