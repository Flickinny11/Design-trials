// Capability tiers — picks the lighting/shadow tier the device can hold and
// degrades gracefully (PRISM-CANVAS-EDITOR-SPEC §10/§17, INV-9 / runtime INV-R14).
//
// Heavy effects (screen-space GI/AO, SSR) are NEVER the default path: they are
// gated behind this detector. `'auto'` resolves to the highest tier the backend
// + form factor support; an explicit tier preference is clamped to what the
// device can actually run (you cannot force T2 onto a WebGL2 / mobile context).
//
// DOM-free (INV-R12): the backend comes from the injected renderer; the mobile
// hint is passed in by the caller (the only surface that may read navigator/UA).
// Framerate is sampled per-frame as a delta ring — NO module/global fps is
// stored (canvas §19 forbids a stashed global framerate).

import type { LightingTier, LightingTierPreference } from '../../../prism-graph/types';

export type DetectedBackend = 'webgpu' | 'webgl2' | 'stub' | null;

export interface CapabilityProfile {
  /** The tier the runtime should actually use. */
  tier: LightingTier;
  /** Backend detected from the renderer. */
  backend: DetectedBackend;
  /** Whether the device was classified as mobile/low-power. */
  isMobile: boolean;
  /** Soft shadows available (T1+). */
  shadows: boolean;
  /** Screen-space GI/AO/SSR post pipeline available (T2 only). */
  screenSpaceGI: boolean;
  /** Max dynamic lights the tier budgets. */
  maxDynamicLights: number;
  /** Why this tier was chosen (diagnostics / verification evidence). */
  reason: string;
}

export interface DetectTierOptions {
  /** Author/hub preference; `'auto'` lets this detector choose. */
  preference?: LightingTierPreference;
  /** Caller-supplied mobile/low-power hint (read from UA at the app edge). */
  isMobile?: boolean;
  /** Device pixel ratio (already clamped). High DPR on mobile → stay conservative. */
  pixelRatio?: number;
}

/** Read the backend off a renderer the same way SceneRoot.detectBackend does. */
export function detectBackend(renderer: unknown): DetectedBackend {
  if (!renderer || typeof renderer !== 'object') return null;
  const r = renderer as {
    backend?: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean; constructor?: { name?: string } };
    isWebGPURenderer?: boolean;
  };
  if (r.backend?.isWebGPUBackend) return 'webgpu';
  if (r.backend?.isWebGLBackend) return 'webgl2';
  const name = (r.backend?.constructor?.name || '').toLowerCase();
  if (name.includes('webgpu')) return 'webgpu';
  if (name.includes('webgl')) return 'webgl2';
  if (r.isWebGPURenderer) return 'webgpu';
  return null;
}

const TIER_ORDER: Record<LightingTier, number> = { T0: 0, T1: 1, T2: 2 };

/** The ceiling tier a given backend + form factor can run. */
function ceilingTier(backend: DetectedBackend, isMobile: boolean): LightingTier {
  // T2 (screen-space GI/AO/SSR) is WebGPU-desktop only — it is the heavy path.
  if (backend === 'webgpu' && !isMobile) return 'T2';
  // WebGPU mobile or WebGL2 desktop → dynamic lights + soft shadows (T1).
  if (backend === 'webgpu' || backend === 'webgl2') return 'T1';
  // Unknown/stub backend → IBL + ambient only (T0), the universal floor.
  return 'T0';
}

/**
 * Resolve the effective capability profile. Pure + deterministic given inputs,
 * so it is trivially unit-testable (criterion 18 evidence).
 */
export function detectCapabilityTier(
  renderer: unknown,
  options: DetectTierOptions = {},
): CapabilityProfile {
  const backend = detectBackend(renderer);
  const isMobile = Boolean(options.isMobile);
  const ceiling = ceilingTier(backend, isMobile);
  const pref = options.preference ?? 'auto';

  let tier: LightingTier;
  let reason: string;
  if (pref === 'auto') {
    tier = ceiling;
    reason = `auto → ceiling ${ceiling} (backend=${backend ?? 'none'}, mobile=${isMobile})`;
  } else {
    // Clamp an explicit preference down to the ceiling — never up. You cannot
    // force the heavy path onto a device that cannot hold it (INV-9).
    tier = TIER_ORDER[pref] <= TIER_ORDER[ceiling] ? pref : ceiling;
    reason =
      tier === pref
        ? `explicit ${pref} (within ceiling ${ceiling})`
        : `requested ${pref} clamped to ceiling ${ceiling} (backend=${backend ?? 'none'}, mobile=${isMobile})`;
  }

  return {
    tier,
    backend,
    isMobile,
    shadows: TIER_ORDER[tier] >= TIER_ORDER.T1,
    screenSpaceGI: tier === 'T2',
    maxDynamicLights: tier === 'T0' ? 0 : tier === 'T1' ? 6 : 10,
    reason,
  };
}

/**
 * Rolling framerate watchdog → graceful runtime downgrade (INV-9 / §17). Feed it
 * per-frame deltas; if the sampled rate sits below `floorRate` for a full window
 * of frames it recommends the next tier down. Holds only a short delta ring — no
 * stored global framerate (canvas §19).
 */
export function createTierWatchdog(opts: {
  initialTier: LightingTier;
  floorRate?: number;
  window?: number;
  onDowngrade?: (next: LightingTier, sampledRate: number) => void;
}): {
  sample(deltaSeconds: number): void;
  tier(): LightingTier;
  reset(tier: LightingTier): void;
} {
  const floorRate = opts.floorRate ?? 30;
  const win = Math.max(8, opts.window ?? 60);
  let tier = opts.initialTier;
  const deltas: number[] = [];
  let belowStreak = 0;

  function sample(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || !Number.isFinite(deltaSeconds)) return;
    deltas.push(deltaSeconds);
    if (deltas.length > win) deltas.shift();
    if (deltas.length < win) return;
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sampledRate = 1 / avg;
    if (sampledRate < floorRate) {
      belowStreak += 1;
      if (belowStreak >= win && TIER_ORDER[tier] > 0) {
        const next: LightingTier = tier === 'T2' ? 'T1' : 'T0';
        tier = next;
        belowStreak = 0;
        deltas.length = 0;
        opts.onDowngrade?.(next, sampledRate);
      }
    } else {
      belowStreak = 0;
    }
  }

  return {
    sample,
    tier: () => tier,
    reset(t: LightingTier) {
      tier = t;
      belowStreak = 0;
      deltas.length = 0;
    },
  };
}
