// _sim-core — shared deterministic simulation primitives for the Physics/Fluid
// Capability Pack. Relative-imported (NOT a package specifier → outside the dep
// allowlist; precedent: _volume-fbm.ts). No `*Primitive` export, so the barrel
// wirer (notes/catalog-wire-barrel.mjs) skips it.
//
// Every helper here is DETERMINISTIC by construction (no Math.random, no
// Date.now): given the same params and the same number of fixed steps it
// produces byte-identical state. Combined with the reset-and-replay stepper, the
// frame a primitive shows at time `t` becomes a pure function of (params, t) —
// which is exactly what the verification harness needs (it pins frozen "engaged"
// frames via repeated __catalogRig.seek(name, t), often scrubbing backward) and
// what Preview consistency requires.
//
// Stack decision: notes/PHYSICS-STACK-DECISION.md. Rigid bodies → semi-implicit
// (symplectic) Euler at a fixed dt. Soft/cloth/rope → XPBD distance constraints.
// Fluids → CPU Eulerian grid (explicit wave equation / shallow-water).

import type { AnimatableTarget } from '../contract';

// ── Deterministic seeding ──────────────────────────────────────────────────
/** Deterministic 0..1 hash from a single seed. The catalog-wide seeding idiom
 *  (matches collision-balls / fluid-sph). Stable across machines for the
 *  integer/rational seeds we feed it. */
export const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Two-argument convenience: a decorrelated 0..1 hash for (index, salt). */
export const hash2 = (i: number, salt: number): number => hash1(i * 1.61803 + salt * 7.13);

/** Deterministic signed −1..1. */
export const shash = (n: number): number => hash1(n) * 2 - 1;

// ── Small math (kept local so primitives import one module) ─────────────────
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate-independent exponential approach factor for a given per-second
 *  rate and dt: `x += (target - x) * dampExp(rate, dt)`. */
export const dampExp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

// ── Capability tier (INV-9) ─────────────────────────────────────────────────
export type SimTier = 'T0' | 'T1' | 'T2';

/** Read the runtime-supplied capability tier from the target's scratch userData.
 *  The catalog rig does not set it → default to the richest tier so previews are
 *  full-fidelity; the real runtime sets `userData.tier` so heavy sims degrade. */
export function resolveSimTier(target: AnimatableTarget): SimTier {
  const t = (target.userData as { tier?: unknown }).tier;
  return t === 'T0' || t === 'T1' || t === 'T2' ? t : 'T2';
}

/** Pick a per-tier value (e.g. grid resolution, particle count, substeps). */
export function tierPick<T>(tier: SimTier, by: { T0: T; T1: T; T2: T }): T {
  return by[tier];
}

// ── Reset-and-replay fixed-dt stepper ───────────────────────────────────────
// Holds its own integration clock. seekStep(t) advances the sim from the last
// seeked time to `t` in fixed `dt` increments; a backward seek (t < lastT) calls
// reset() and replays from 0, so any frozen frame is reproducible. The catch-up
// loop is guarded so a huge jump can never spin forever.
export interface ReplayStepper {
  /** Advance to absolute sim time `t` (seconds), replaying from 0 on rewind. */
  seekStep(t: number): void;
  /** Force a reset to the seeded initial state (clears the clock). */
  reset(): void;
  /** Current integrated time (seconds). */
  now(): number;
  /**
   * Force the NEXT seekStep to replay from 0 even if `t` has not advanced.
   * Wire a primitive's `onParamChange` to this: the verification harness sweeps
   * each control while PAUSED (it re-seeks the SAME frozen `t` every frame), so
   * a control that only affects the trajectory — gravity, stiffness, viscosity —
   * would read DEAD without this. markDirty() makes every control a standing
   * function of the engaged frame: change it, and the whole sim recomputes to
   * the same pinned `t`, so the frozen frame visibly changes.
   */
  markDirty(): void;
}

export function makeReplayStepper(opts: {
  dt: number;
  reset: () => void;
  step: (dt: number) => void;
  /** Max fixed steps per seek catch-up (default 100000). */
  maxSteps?: number;
}): ReplayStepper {
  const { dt, step } = opts;
  const maxSteps = opts.maxSteps ?? 100000;
  let lastT = 0;
  let started = false;
  let dirty = false;
  const doReset = () => {
    opts.reset();
    lastT = 0;
    started = true;
    dirty = false;
  };
  return {
    reset: doReset,
    now: () => lastT,
    markDirty: () => {
      dirty = true;
    },
    seekStep: (t: number) => {
      if (!started || dirty) doReset();
      if (t < 0) t = 0;
      if (t < lastT) doReset();
      let simT = lastT;
      let guard = 0;
      while (simT + dt <= t && guard < maxSteps) {
        step(dt);
        simT += dt;
        guard++;
      }
      lastT = simT;
    },
  };
}

// ── XPBD distance constraint (soft / cloth / rope / springs) ─────────────────
// Solve one Extended Position-Based-Dynamics distance constraint between
// particles i and j stored in flat position arrays, with per-particle inverse
// mass (0 = pinned/static). `compliance` (α) is the inverse stiffness; pass
// `alphaTilde = compliance / (dtSub*dtSub)` precomputed for the substep. Single
// Gauss-Seidel pass per substep ("small steps" XPBD, Macklin 2019) — with enough
// small substeps this converges and stays deterministic given fixed ordering.
export function solveDistanceConstraint(
  px: Float32Array,
  py: Float32Array,
  pz: Float32Array,
  invMass: Float32Array,
  i: number,
  j: number,
  rest: number,
  alphaTilde: number,
): void {
  const dx = px[i] - px[j];
  const dy = py[i] - py[j];
  const dz = pz[i] - pz[j];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-9) return;
  const wi = invMass[i];
  const wj = invMass[j];
  const w = wi + wj;
  if (w === 0) return;
  const c = len - rest;
  const dlambda = -c / (w + alphaTilde);
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  px[i] += wi * dlambda * nx;
  py[i] += wi * dlambda * ny;
  pz[i] += wi * dlambda * nz;
  px[j] -= wj * dlambda * nx;
  py[j] -= wj * dlambda * ny;
  pz[j] -= wj * dlambda * nz;
}

/** Compliance → per-substep alphaTilde. `stiffness01` is 0..1 (1 = stiff). */
export function complianceAlpha(stiffness01: number, dtSub: number): number {
  // Map 0..1 stiffness to a compliance range; stiff → tiny compliance.
  const s = clamp(stiffness01, 0, 1);
  const compliance = (1 - s) * 0.02 + 1e-6; // s=1 → ~1e-6 (rigid), s=0 → soft
  return compliance / (dtSub * dtSub);
}

// ── Eulerian fluids: explicit 2D wave-equation height-field ──────────────────
// h = surface height, v = vertical velocity, both length N*N row-major. One
// explicit step: v += c2 * laplacian(h) * dt; v *= damp; h += v * dt. Clamped
// (Neumann-ish) boundaries. Deterministic (pure neighbour reads, fixed order).
export function waveStep2D(
  h: Float32Array,
  v: Float32Array,
  N: number,
  c2: number,
  damp: number,
  dt: number,
): void {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const idx = y * N + x;
      const hl = x > 0 ? h[idx - 1] : h[idx];
      const hr = x < N - 1 ? h[idx + 1] : h[idx];
      const hu = y > 0 ? h[idx - N] : h[idx];
      const hd = y < N - 1 ? h[idx + N] : h[idx];
      const lap = hl + hr + hu + hd - 4 * h[idx];
      v[idx] = (v[idx] + c2 * lap * dt) * damp;
    }
  }
  for (let i = 0; i < h.length; i++) h[i] += v[i] * dt;
}

/** 1D variant for sloshing tanks / liquid columns (length N). */
export function waveStep1D(
  h: Float32Array,
  v: Float32Array,
  N: number,
  c2: number,
  damp: number,
  dt: number,
): void {
  for (let x = 0; x < N; x++) {
    const hl = x > 0 ? h[x - 1] : h[x];
    const hr = x < N - 1 ? h[x + 1] : h[x];
    const lap = hl + hr - 2 * h[x];
    v[x] = (v[x] + c2 * lap * dt) * damp;
  }
  for (let i = 0; i < N; i++) h[i] += v[i] * dt;
}

/** Smooth radial impulse onto a 2D height grid (a drop / poke). Deterministic. */
export function splat2D(
  h: Float32Array,
  N: number,
  cx: number,
  cy: number,
  radius: number,
  amount: number,
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(N - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(N - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const fall = 1 - d2 / r2;
      h[y * N + x] += amount * fall * fall;
    }
  }
}
