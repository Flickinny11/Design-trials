// Pure helpers for responsive breakpoint resolution (mock spec §10.15).
//
//   desktop-wide:  width  >  1440
//   desktop:       1024  <= width <= 1440
//   tablet:        768   <= width <  1024
//   mobile:        width  <   768
//
// The helpers are side-effect-free and dependency-free so they can be imported
// from both the browser runtime (boot.ts) and a plain Node test runner.

/** @typedef {'desktop-wide' | 'desktop' | 'tablet' | 'mobile'} BreakpointName */

/** @type {ReadonlyArray<BreakpointName>} */
export const BREAKPOINT_ORDER = ['desktop-wide', 'desktop', 'tablet', 'mobile'];

/**
 * Classify a viewport width into a §10.15 breakpoint.
 * @param {number} width
 * @returns {BreakpointName}
 */
export function classifyBreakpoint(width) {
  if (!Number.isFinite(width)) return 'desktop-wide';
  if (width > 1440) return 'desktop-wide';
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

/**
 * Fallback chain: if the active key is missing, narrower layouts fall back to
 * wider ones (mobile → tablet → desktop → desktop-wide → base).
 * @param {BreakpointName} active
 * @returns {BreakpointName[]}
 */
function fallbackChain(active) {
  switch (active) {
    case 'mobile':       return ['mobile', 'tablet', 'desktop', 'desktop-wide'];
    case 'tablet':       return ['tablet', 'desktop', 'desktop-wide'];
    case 'desktop':      return ['desktop', 'desktop-wide'];
    case 'desktop-wide': return ['desktop-wide', 'desktop'];
    default:             return [active];
  }
}

/**
 * Resolve the effective transform for the given active breakpoint.
 * Prefers the active-keyed override; falls back through the chain above;
 * returns the base `visual.transform` when nothing applies.
 *
 * @param {{
 *   transform: { x: number; y: number; width: number; height: number; z: number },
 *   transformByBreakpoint?: Partial<Record<BreakpointName, { x: number; y: number; width: number; height: number; z: number }>>,
 * }} visual
 * @param {BreakpointName} active
 * @returns {{ x: number; y: number; width: number; height: number; z: number }}
 */
export function resolveTransform(visual, active) {
  const overrides = visual && visual.transformByBreakpoint;
  if (overrides) {
    for (const key of fallbackChain(active)) {
      const o = overrides[key];
      if (o) return o;
    }
  }
  return visual.transform;
}

/**
 * @param {{ visibleAtBreakpoints?: ReadonlyArray<BreakpointName> }} visual
 * @param {BreakpointName} active
 * @returns {boolean}
 */
export function isVisibleAtBreakpoint(visual, active) {
  const list = visual && visual.visibleAtBreakpoints;
  if (!Array.isArray(list) || list.length === 0) return true; // unrestricted
  return list.includes(active);
}
