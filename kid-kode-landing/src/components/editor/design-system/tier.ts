'use client';

// PRISM EDITOR DESIGN SYSTEM — chrome capability tier (INV-9).
//
// Mirrors the runtime's ceiling logic (runtime/shared/capability-tier.ts) at
// the DOM edge, where reading navigator IS allowed: WebGPU desktop → t2,
// WebGPU mobile / WebGL2 → t1, neither → t0. The result is stamped on
// <html data-ds-tier> (an inline boot script in layout.tsx stamps it
// pre-hydration so glass never flashes from the wrong tier) and materials.css
// gates frost/refraction off it. Full glass on capable devices; the SAME
// palette + geometry with lighter physics below — never a broken look.

export type ChromeTier = 't0' | 't1' | 't2';

export function detectChromeTier(): ChromeTier {
  if (typeof navigator === 'undefined') return 't1';
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const hasWebGPU = 'gpu' in navigator && !!navigator.gpu;
  if (hasWebGPU && !coarse) return 't2';
  if (hasWebGPU || typeof WebGL2RenderingContext !== 'undefined') return 't1';
  return 't0';
}

/** Idempotent: stamp <html data-ds-tier>. Safe to call from any client island. */
export function ensureChromeTier(): ChromeTier {
  const tier = detectChromeTier();
  if (typeof document !== 'undefined') {
    const el = document.documentElement;
    if (el.dataset.dsTier !== tier) el.dataset.dsTier = tier;
  }
  return tier;
}

/**
 * The inline boot script source for layout.tsx (<head>), so the tier attribute
 * exists before first paint. Keep in lockstep with detectChromeTier().
 */
export const DS_TIER_BOOT_SCRIPT = `(function(){try{var c=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;var g='gpu' in navigator&&!!navigator.gpu;var t=g&&!c?'t2':(g||typeof WebGL2RenderingContext!=='undefined')?'t1':'t0';document.documentElement.setAttribute('data-ds-tier',t);}catch(e){document.documentElement.setAttribute('data-ds-tier','t1');}})();`;
