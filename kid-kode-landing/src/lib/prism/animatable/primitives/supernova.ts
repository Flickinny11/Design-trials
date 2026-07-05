// supernova — a star DETONATES, looping: a blinding warm-white core flash blows
// out into a turbulent expanding shock SHELL of light and debris, then fades to a
// glowing remnant with embers. The illusion of a real detonating VOLUME is built
// ENTIRELY IN-SHADER on ONE flat quad (subject:'plane', volumetric:false → no slab
// stack, so there are NO stacked-quad shelves / Minecraft banding by construction).
//
// ROUND-2 FIX (user-advocate gate): the round-1 build used volumetric:true — a
// 5-slab stacked-quad depth mechanism whose `aDepth`-staggered shell read as a flat
// dim PURPLE ring with a cheap 6-spoke asterisk: blocky/stacked, no blinding core,
// no turbulent shell, wrong (cool) palette for a claimed blinding flash. The fix is
// the proven six-tile recipe — a single quad with all structure synthesised from the
// shared premium noise (`_volume-fbm`: rotated-octave + QUINTIC + DOMAIN-WARPED):
//   • PHASE 1 — a blinding white-hot core flash (in-gamut: white→yellow→orange halo,
//     fireball-burst flame-ramp discipline) spikes at the start of each loop.
//   • PHASE 2 — an expanding shock SHELL whose rim is BROKEN UP by fbmWarped into a
//     turbulent filamentary edge (never a clean perfect circle), with radial debris
//     STREAKS: fbmRot sampled over the polar angle EMBEDDED as a continuous 2D point
//     (cos/sin circle — never raw atan, never mirrored / abs'd), flung outward and
//     fading. `maxR` sets shell reach, `rays` sets streak strength.
//
// ROUND-2 SEAM FIX (vision review of the round-1 REAL-GPU frames): the round-1
// streak field fed the RAW atan(y,x) angle into fbm. atan is discontinuous at ±π
// (the left horizontal), which printed a hard rectangular brightness step at the
// 9-o'clock position. The angle is now embedded as fbm(cos(a)·k+…, sin(a)·k+…) so
// the field is exactly periodic — seamless — in angle. The core flash was also
// warmed (the near-neutral white stop read slightly grey) and brightened so the
// core alpha saturates during the flash.
//   • PHASE 3 — a fading glowing remnant + embers. A persistent soft glowing core
//     burns at ALL loop phases, so any static capture reads as an explosion (the
//     fireball-burst "dim phase" lesson).
// Intensity is carried in ALPHA against AdditiveBlending with an in-gamut colour
// ramp (colour never > 1; composite capped) so ACES never clips warm→flat-white.
//
// seek() advances uTime; onParamChange() updates the live novaRate/maxR/rays
// uniforms. Material swap/restore mirrors fireball-burst / smoke discipline.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  atan,
  length,
  smoothstep,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; fbm helpers + radial expressions trip the strict overloads. Like
// smoke.ts / nebula.ts / fireball-burst.ts we compose through one permissive
// chainable node alias (method-chaining only, which every TSL node supports) so the
// helpers compose without fighting the inferred VarNode generics. The built graph
// is identical to the free-function form. (tsc strictness — matches references.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  sin: () => TNode;
  cos: () => TNode;
  abs: () => TNode;
  exp: () => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  fract: () => TNode;
  pow: (e: number) => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
// All noise sourced from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;
// Free-function helpers (NOT method-form) for the load-bearing radial math: some
// node chains extrapolate wrongly through method-form .smoothstep/.mix — the free
// functions clamp/interpolate correctly. (six-tile GPU gotcha.)
const ss = (e0: V, e1: V, x: V): TNode =>
  (smoothstep as unknown as (a: V, b: V, c: V) => TNode)(e0, e1, x);
const mx = (a: TNode, b: V, t: V): TNode =>
  (mix as unknown as (a: TNode, b: V, t: V) => TNode)(a, b, t);

const SCHEMA = [
  { id: 'novaRate', label: 'Nova Rate', type: 'knob', min: 0.05, max: 1.5, step: 0.01, default: 0.4 },
  { id: 'maxR', label: 'Shell Size', type: 'knob', min: 0.3, max: 1.2, step: 0.01, default: 0.7 },
  { id: 'rays', label: 'Rays', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const supernovaPrimitive: PrimitiveDefinition = {
  name: 'supernova',
  label: 'Supernova',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  // Single flat quad — the detonating volume is an ILLUSION built in-shader from
  // rotated/quintic/domain-warped fbm. NOT the 5-slab stack (which read as a flat
  // blocky purple ring) and NOT inline value noise (which reads as a brick grid).
  volumetric: false,
  description:
    'A star detonates — a blinding white-hot core flash blows out into a turbulent filamentary shock shell with radial debris streaks, fading to a glowing ember remnant. The volume is built in-shader from domain-warped fbm — a smooth premium burst, no slab seams. Looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'supernova', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRate = uniform(num(params.novaRate, 0.4));
      const uMaxR = uniform(num(params.maxR, 0.7));
      const uRays = uniform(num(params.rays, 0.6));

      // ── Looping detonation phase lt ∈ [0,1): flash → shell → remnant → reset. ──
      const lt = (uTime as unknown as TNode).mul(uRate as unknown as TNode).fract();
      const tFlow = (uTime as unknown as TNode).mul(0.25); // slow continuous churn

      // ── Radial / polar coordinate from the quad center. (Plain centered uv used
      // ONLY for the radius/angle geometry — the noise DOMAINS below are fed plain
      // scaled coords + the polar pair, never a mirrored abs() term.) ──
      const u = uv() as unknown as TNode;
      const p = t2(u.x.sub(0.5), u.y.sub(0.5));
      const r = (length as unknown as (v: TNode) => TNode)(p); // [0 .. ~0.7]
      const ang = (atan as unknown as (y: V, x: V) => TNode)(p.y, p.x); // [-π .. π]

      const maxR = uMaxR as unknown as TNode;

      // ── Turbulent field that BREAKS UP every hard edge. Domain-warped fbm over a
      // continuous high-frequency domain (base freq ≥ 7) gives organic filaments
      // with no axis-aligned lattice and no mirror seam. Slowly churns. ──
      const turbDomain = t2(
        u.x.mul(8.5).add(tFlow.mul(0.6)),
        u.y.mul(8.5).sub(tFlow.mul(0.4)),
      );
      const turb = warped(turbDomain, 0.9, 5); // ~[0,1]
      // A second, finer warped field for the shell-rim filaments.
      const rimDomain = t2(
        u.x.mul(13.0).add(21.3),
        u.y.mul(13.0).sub(tFlow.mul(0.9)).add(7.1),
      );
      const rimTurb = warped(rimDomain, 1.15, 5); // ~[0,1]

      // ── PHASE 1: blinding core FLASH. A sharp exponential radial spike that decays
      // over the first ~quarter of the loop. White-hot, very bright. ──
      const flashEnv = lt.mul(4.0).oneMinus().max(0); // 1 → 0 over first quarter
      const flashCore = r.mul(-26.0).exp().mul(flashEnv).mul(3.0);

      // ── Persistent glowing CORE (all phases). Soft, always lit, breathes gently —
      // guarantees any static capture reads as an explosion (fireball "dim phase"
      // lesson). Turbulence ruffles it so it isn't a sterile disc. ──
      const corePulse = lt.mul(6.2831).sin().mul(0.5).add(0.5).mul(0.18).add(0.82);
      const coreGlow = r.mul(-9.0).exp().mul(corePulse).mul(1.15);
      const coreRuffle = f1(1).add(turb.sub(0.5).mul(0.5));
      const core = coreGlow.mul(coreRuffle);

      // ── PHASE 2: expanding shock SHELL. A growing annulus whose radius sweeps from
      // ~0 to maxR across the loop. The rim is BROKEN UP by rimTurb so it is a
      // turbulent filamentary edge, never a clean perfect circle. Fades as lt→1. ──
      const ringR = ss(0.0, 1.0, lt).mul(maxR); // eased growth, 0 → maxR
      // Wobble the effective sampling radius by the turbulent field so the shell rim
      // is ragged (the displacement is what kills the "clean ring" defect).
      const rWob = r.add(rimTurb.sub(0.5).mul(0.16));
      const shellW = f1(0.13);
      const shellBand = ss(ringR.sub(shellW), ringR, rWob).mul(
        ss(ringR.add(shellW.mul(0.5)), ringR, rWob),
      );
      const shellFade = lt.oneMinus().pow(1.4); // bright early, gone by loop end
      // Texture the shell body with turbulence so it reads as churning plasma.
      const shellTex = turb.mul(0.6).add(0.4);
      const shell = shellBand.mul(shellFade).mul(shellTex).mul(1.9);

      // Soft outer PLUME/haze trailing just behind the shell — a glowing wake.
      const plumeBand = ss(ringR.add(shellW.mul(1.8)), ringR.sub(shellW.mul(0.3)), rWob);
      const plume = plumeBand.mul(ss(maxR.mul(1.05), 0.0, r)).mul(shellFade).mul(turb).mul(0.6);

      // ── Radial debris STREAKS. The polar angle is embedded as a CONTINUOUS 2D
      // point on a circle — fbm(cos(a)·k + r·m, sin(a)·k + r·m′) — so the streak
      // field is exactly periodic in angle with NO wrap seam at ±π. (Round-1 fed the
      // raw atan angle into fbm, which printed a hard horizontal brightness step at
      // the 9-o'clock position — the polar-wrap MUST-FIX.) The circle rotates slowly
      // (tFlow) for churn and the radial term scrolls with the loop so streaks still
      // fly outward and fade; strength scaled by the `rays` control. ──
      const spun = ang.add(tFlow.mul(0.5));
      const angDomain = t2(
        spun.cos().mul(2.6).add(r.mul(0.8)),
        spun.sin().mul(2.6).add(r.mul(1.4)).sub(lt.mul(3.0)),
      );
      const streakField = rotFbm(angDomain, 4); // ~[0,1], filamentary in angle, seamless
      const streaks = ss(0.62, 0.92, streakField); // sparse bright filaments
      // Streaks live in the shell→outer region, brightest along the growing front.
      const streakReach = ss(0.05, ringR.add(0.06), r).mul(ss(maxR.mul(1.1), ringR.sub(0.04), r));
      const rays = streaks
        .mul(streakReach)
        .mul(uRays as unknown as TNode)
        .mul(shellFade)
        .mul(1.4);

      // ── PHASE 3: fading EMBERS in the remnant tail (late loop), sparse hot points
      // from the fine turbulent field, drifting in the inner region. ──
      const emberMask = ss(0.45, 1.0, lt); // only in the tail
      const embers = ss(0.78, 0.97, rimTurb).mul(ss(maxR.mul(0.8), 0.0, r)).mul(emberMask).mul(0.7);

      // ── Composite emission (alpha-carried intensity). ──
      const bright = core.max(flashCore).max(shell).max(plume).max(rays).max(embers);

      // ── Soft edge gate: alpha falls to 0 BEFORE the quad edges so the burst reads
      // as a round explosion against a transparent (black) background — never a hard
      // rectangular clip. (six-tile alpha-gate discipline.) ──
      const edgeGate = ss(0.5, 0.34, r); // 1 inside → 0 toward the quad corners
      const alpha = bright.clamp(0, 1).mul(edgeGate).clamp(0, 1);

      // ── Colour ramp, IN GAMUT (every stop ≤ 1), fire-flame discipline: white-hot
      // core → yellow → orange → deep-red flame at the cooling rim, with a faint
      // ember-orange remnant. Brightness lives in ALPHA, colour is NEVER multiplied
      // past 1, and the composite is capped so additive accumulation cannot clip to
      // flat white (ACES+additive hue-shift lesson). The hot stop is a WARM white
      // (round-1's near-neutral 0.97/0.88 stop read slightly grey on real GPU). ──
      const white = t3(1.0, 0.95, 0.8);
      const yellow = t3(1.0, 0.83, 0.32);
      const orange = t3(1.0, 0.45, 0.12);
      const deepRed = t3(0.82, 0.12, 0.04);

      // Cooling factor: 0 at the hot center / early loop, 1 at the rim / late loop.
      const coolByR = ss(0.0, maxR, r);
      const cool = coolByR.max(lt.mul(0.7)).clamp(0, 1);
      const ramp1 = mx(white, yellow, ss(0.0, 0.35, cool));
      const ramp2 = mx(ramp1, orange, ss(0.3, 0.65, cool));
      const ramp3 = mx(ramp2, deepRed, ss(0.62, 1.0, cool));
      // Keep the very core white-hot regardless of cooling so the flash/core stay
      // blinding rather than tinting toward orange.
      const coreHeat = core.max(flashCore).clamp(0, 1);
      const palette = mx(ramp3, white, coreHeat.mul(0.92)).clamp(0, 1);

      // Cap composite brightness so additive accumulation can't blow to flat white.
      const colorNode = palette.clamp(0, 1);
      const opacityNode = alpha.clamp(0, 1);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on the shared scratch space so the host
      // (and conformance harness) can observe the driven state without a GPU.
      target.userData.supernova = { uTime, uRate, uMaxR, uRays };

      return {
        // Stateful / looping — animate continuously.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRate.value = num(params.novaRate, 0.4);
          uMaxR.value = num(params.maxR, 0.7);
          uRays.value = num(params.rays, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'novaRate') uRate.value = num(value, 0.4);
          else if (id === 'maxR') uMaxR.value = num(value, 0.7);
          else if (id === 'rays') uRays.value = num(value, 0.6);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
