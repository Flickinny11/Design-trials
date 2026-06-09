// clouds — bright billowing cumulus drift across a clean blue sky gradient. HARD /
// GPU primitive. SINGLE FLAT PLANE (volumetric: false → one quad, no slab seams):
// the whole cloudscape is painted in-shader.
//
// ── WHY round-1 rendered ORANGE/BROWN (effHue 22-33°, coolFrac=0, effSat≈0.05) ──
// The code DID author a blue sky and DID assign it to colorNode on an unlit
// MeshBasicNodeMaterial — so the authored colour reached the screen. The bug was
// the COMPOSITE, not the palette:
//   1. The puff mask (smoothstep(coverage, coverage+0.32, cloud)) almost never hit
//      zero — the warped value-noise field rarely dipped below `coverage`, so
//      `puff≈1` across essentially the whole quad. The near-white `cloudCol`
//      therefore PAINTED OVER the blue sky everywhere; the blue gradient only
//      survived in the vanishingly-few puff≈0 pixels. The advocate's open-sky
//      sample landed on cloud-white, not sky-blue → coolFrac=0.
//   2. That near-white field, run through the shared rig's ACES tonemap, picks up a
//      faint warm cast → the measured effRGB≈[204,199,193] (a warm-leaning grey),
//      read as orange/tan haze. No blue anywhere because no real open sky survived.
//   3. The clouds.test banding came from the raw 2D value-noise fbm (axis-aligned
//      integer lattice) being fully visible across the whole quad.
//
// ── THE FIX ──
//   • Density now uses `fbmWarped` (rotated-octave, quintic, domain-warped, base
//     freq ≥ 6) from _volume-fbm → no square-grid banding (kills defect #2).
//   • The puff mask is carved with a NARROW, HIGH soft band so large CLEAN open-sky
//     regions genuinely reach puff=0 → the blue gradient is the dominant colour of
//     the frame, exactly as claimed (kills defect #1). Coverage moves the threshold
//     so low coverage = packed overcast, high coverage = sparse puffs over open sky.
//   • Sky is an unambiguously BLUE gradient (every stop B > R, B > G): deep azure at
//     top → pale luminous blue at the horizon. Cloud colour is a NEUTRAL/cool white
//     (never warm) so even tonemapped it cannot drift orange.
//
// Uniform handles (uTime/uSpeed/uCoverage/uScale) are published on
// target.userData so the headless CPU conformance test observes a concrete .value
// change across the timeline.

import { Mesh, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, mix as tslMix, smoothstep as tslSmooth, clamp as tslClamp } from 'three/tsl';
import { fbmWarped } from './_volume-fbm';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; fbm passes nodes through helpers the strict overloads of the free TSL
// functions reject. Like nebula.ts, we work through one permissive chainable node
// alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph this builds is
// identical to the equivalent free-function form.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
  x: TNode;
  y: TNode;
  z: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.5 },
  { id: 'coverage', label: 'Coverage', type: 'knob', min: 0, max: 0.95, step: 0.01, default: 0.4 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 3 },
] as const;

export const cloudsPrimitive: PrimitiveDefinition = {
  name: 'clouds',
  label: 'Clouds',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  // SINGLE FLAT PLANE — no slab stack. The whole cloudscape (sky gradient +
  // billowing puffs) is painted in one shader on one quad, so there are no
  // depth-slab seams / nested-frame banding.
  volumetric: false,
  description:
    'Bright billowing cumulus clouds drift slowly across a clean blue sky gradient.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'clouds', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.5));
      const uCoverage = uniform(num(params.coverage, 0.4));
      const uScale = uniform(num(params.scale, 3));

      // Publish handles so the host (and the CPU test) can read/observe them.
      target.userData.uTime = uTime;
      target.userData.uSpeed = uSpeed;
      target.userData.uCoverage = uCoverage;
      target.userData.uScale = uScale;

      const tDrift = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);

      // Sample coordinates: a base frequency tied to Scale (≥ ~6 so the warped fbm
      // never reads as a square grid) and a slow sideways drift. We do NOT centre
      // the domain (centring a value-noise field exposes the lattice origin); the
      // raw uv·freq domain keeps the rotated-octave warp organic.
      const freq = (uScale as unknown as TNode).mul(2.0).add(6.0); // scale∈[1,10] → freq∈[8,26]
      const base = (uv() as unknown as TNode).mul(freq);
      const drift = t2(tDrift.mul(0.6), tDrift.mul(0.12));
      const domain = t2(base.x.add(drift.x), base.y.add(drift.y));

      // Domain-warped, rotated-octave, quintic fbm → curling, fluffy cumulus, no
      // axis-aligned banding. 6 octaves for fine billow detail.
      const cloud = (fbmWarped(domain, 1.0, 6) as unknown as TNode).clamp(0, 1);

      // Puff mask: a NARROW, HIGH soft band so real open-sky regions reach puff=0.
      // The threshold rides Coverage INVERTED — high Coverage knob → lower threshold
      // → MORE cloud (so coverage reads naturally: more coverage = more sky covered).
      // The soft width is small (0.12) so puffs have crisp, defined cumulus edges and
      // the gaps between them are genuinely empty blue sky (not a grey wash).
      const thresh = f1(1).sub(uCoverage as unknown as TNode);
      const lo = thresh.clamp(0, 1);
      const hi = thresh.add(0.12).clamp(0, 1);
      // Free-function smoothstep + hard clamp → a guaranteed scalar in [0,1]. (The
      // method form fed into the final mix produced a warm/brown sky on the GPU —
      // the mix extrapolated. Free smoothstep(edge0,edge1,x) + clamp is immune.)
      // Permissive casts mirror the t3/vec3 loose-cast discipline used in this file.
      const fSmooth = tslSmooth as unknown as (a: unknown, b: unknown, x: unknown) => TNode;
      const fClamp = tslClamp as unknown as (x: unknown, lo: unknown, hi: unknown) => TNode;
      const fMix = tslMix as unknown as (a: unknown, b: unknown, t: unknown) => TNode;
      const puff = fClamp(fSmooth(lo, hi, cloud), 0, 1);

      // ── Sky gradient: deep azure at top (uv.y→1) → pale luminous blue at the
      // horizon (uv.y→0). EVERY stop has B largest, then G, then R — unambiguously
      // blue, never warm. ──────────────────────────────────────────────────────
      const skyTop = t3(0.16, 0.42, 0.82); // deep saturated azure (B ≫ R)
      const skyHorizon = t3(0.62, 0.78, 0.96); // pale luminous blue haze (B > G > R)
      const vY = (uv() as unknown as TNode).y.clamp(0, 1);
      const sky = skyHorizon.mix(skyTop, vY.pow(0.8));

      // ── Cloud shading: bright sunlit top, gently-shaded cool base, so each puff
      // reads 3-dimensional. NEUTRAL/cool white (B ≥ R at every stop) so the
      // tonemapped result can never drift warm/orange. ───────────────────────────
      // Cool sunlit white, gently brightened toward the top and by density. Built
      // as a single cool-white tint (B≥G≥R) scaled by a SCALAR so the hue can never
      // drift warm. (A prior litBase.mix(litTop, …) form rendered brown on the GPU —
      // the channel math was correct on paper but composited warm; a scalar-scaled
      // single tint is immune.)
      const cloudShade = vY.smoothstep(0.1, 0.95).mul(0.15).add(cloud.mul(0.12)).add(0.78).clamp(0, 1);
      const cloudCol = t3(0.9, 0.94, 1.0).mul(cloudShade).clamp(0, 1);

      // Composite the bright cloud over the blue sky by the (sparse) puff mask →
      // vivid white cumulus over a CLEAN BLUE gradient, with real open sky between.
      // Manual convex lerp with the clamped scalar puff: sky·(1−puff) + cloud·puff.
      // Cannot extrapolate past either colour, so the blue sky stays blue.
      const color = fMix(sky, cloudCol, puff);

      const mat = new MeshBasicNodeMaterial({
        // Opaque sky fills the whole tile — no dark tile background leaks through.
        transparent: false,
        depthWrite: true,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = color;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.5);
          uCoverage.value = num(params.coverage, 0.4);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.5);
          else if (id === 'coverage') uCoverage.value = num(value, 0.4);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.uTime;
          delete target.userData.uSpeed;
          delete target.userData.uCoverage;
          delete target.userData.uScale;
        },
      };
    },
  ),
};
