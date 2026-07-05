// will-o-wisp — a glowing ghost-light. HARD / GPU primitive. SINGLE-PLANE
// (volumetric:false): one flat quad, no slab seams. The "floating light in a
// soft volume" illusion is built ENTIRELY in-shader:
//
//   • The drifting haze / wispy TENDRILS come from the SHARED _volume-fbm helper
//     (fbmWarped): rotated-octave + quintic + domain-warped value noise, base
//     frequency >= 7. That helper exists precisely to kill the axis-aligned
//     square-cell grid that the user-advocate gate flagged on round 1 — so the
//     background haze never reads as tiled. The haze noise domain is CONTINUOUS
//     (uv-based, not a single re-centered domain), so there is no seam.
//   • The wisp LIGHTS are a set of discrete soft radial cores at spread-out
//     positions. More `wisps` => more DISTINCT glowing blobs lit (not one blob
//     scaled up). Each is an eerie cyan/green ember.
//   • Brightness is CAPPED below pure white so the glow keeps its colour /
//     saturation — only a tiny white-hot pip at each core's centre is allowed to
//     approach white. Soft exponential radial falloff => no hard edges, soft halo.
//
// Additive blend + depthWrite:false composites the glow. seek() advances uTime;
// controls (wisps, driftSpeed, glowSize) read live, no rebuild.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmWarped } from './_volume-fbm';

const MAX_WISPS = 6;

// Deterministic per-wisp parameters from an index hash — no Math.random.
const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// TSL's per-call generics are narrower than the node graph they build; fbm/noise
// pass nodes through helpers that the strict overloads reject. Like fire-flame.ts
// we work through one permissive chainable alias (method-chaining only, supported
// by every TSL node) so the helpers compose without fighting inferred generics.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  cos: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  pow: (e: number) => TNode;
  length: () => TNode;
  negate: () => TNode;
  exp: () => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
  abs: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;

const SCHEMA = [
  { id: 'wisps', label: 'Wisps', type: 'knob', min: 2, max: 6, step: 1, default: 4 },
  { id: 'driftSpeed', label: 'Drift Speed', type: 'knob', min: 0.1, max: 2.5, step: 0.05, default: 0.8 },
  { id: 'glowSize', label: 'Glow Size', type: 'knob', min: 0.05, max: 0.3, step: 0.01, default: 0.16 },
] as const;

export const willOWispPrimitive: PrimitiveDefinition = {
  name: 'will-o-wisp',
  label: "Will-o'-Wisp",
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // SINGLE-PLANE: no slab stack -> no slab-seam banding. The volume illusion is
  // synthesized in-shader (shared domain-warped fbm haze + radial wisp cores).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A glowing ghost-light — a soft luminous core wreathed in wispy tendrils that drift and bob, its halo melting into a soft volume like a marsh spirit.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'will-o-wisp', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.driftSpeed, 0.8));
      const uGlow = uniform(num(params.glowSize, 0.16));
      // uCount gates each orb's contribution (1 active / 0 off) so the wisp count
      // is a live uniform with no rebuild.
      const uCount = uniform(num(params.wisps, 4));

      const u = uv() as unknown as TNode;
      // Larger glowSize -> softer/wider orbs (smaller falloff exponent).
      const falloff = (f1(1).div(uGlow as unknown as TNode)) as unknown as TNode;
      const driftT = (uTime as unknown as TNode).mul(uDrift as unknown as TNode);

      // Centered coords (-0.5..0.5) so wisp positions are symmetric about centre.
      const p = u.sub(0.5);

      // --- drifting wispy haze / tendrils (SHARED _volume-fbm) ----------------
      // fbmWarped = rotated-octave + quintic + domain-warped value noise. The
      // domain is the CONTINUOUS uv field (scaled, slowly translated by drift) —
      // NOT a single re-centered global domain — so the background haze noise has
      // no seam and never reads as a square-cell grid. Base freq 7.5 (>= ~7) keeps
      // the largest cells small; warp carves long soft tendrils.
      const hazeDomain = t2(
        u.x.mul(7.5).add(driftT.mul(0.10)),
        u.y.mul(7.5).sub(driftT.mul(0.07)),
      );
      const hazeRaw = fbmWarped(hazeDomain, 1.1, 5) as unknown as TNode;
      // Bias toward wisps: keep the upper band of the field, soft-shoulder it.
      const haze = hazeRaw.smoothstep(0.42, 0.92);

      // A second, larger-scale warped field forms the soft ambient veil the wisp
      // sits in (gives the "melting into a soft volume" read). Continuous domain.
      const veilDomain = t2(
        u.x.mul(3.4).sub(driftT.mul(0.05)),
        u.y.mul(3.4).add(driftT.mul(0.06)),
      );
      const veil = (fbmWarped(veilDomain, 0.9, 4) as unknown as TNode).smoothstep(0.4, 0.95);

      // --- discrete luminous wisp lights (radial cores) ------------------------
      // Spread across the whole frame (NOT clustered at centre) so raising `wisps`
      // lights up MORE distinct blobs at different positions instead of fattening
      // one central blob. Each orb wanders gently and pulses.
      let glow: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any
      let tendril: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let k = 0; k < MAX_WISPS; k++) {
        // Home positions spread across most of the frame (-0.38..0.38).
        const bx = -0.38 + hash(k * 3 + 1) * 0.76;
        const by = -0.38 + hash(k * 3 + 2) * 0.76;
        const wsx = 0.5 + hash(k * 7 + 3) * 1.5;
        const wsy = 0.5 + hash(k * 7 + 5) * 1.5;
        const range = 0.06 + hash(k * 11 + 7) * 0.10;
        const pulse = 1.0 + hash(k * 13 + 9) * 2.5;
        // Per-wisp size variation so they don't read as identical dots.
        const sizeJitter = 0.78 + hash(k * 17 + 4) * 0.5;

        // gentle per-orb wander (bob + drift).
        const cx = f1(bx).add(driftT.mul(wsx).sin().mul(range));
        const cy = f1(by).add(driftT.mul(wsy).cos().mul(range));

        const dx = p.x.sub(cx);
        const dy = p.y.sub(cy);
        const d = t2(dx, dy).length();
        // Pulse 0.45..1.0 — flickering ghost-light, never fully dark.
        const bob = float(0.7).add(sin(uTime.mul(pulse)).mul(0.3)) as unknown as TNode;
        // Soft exponential radial falloff -> soft halo, NO hard edge.
        const orb = d.mul(falloff.mul(sizeJitter)).negate().exp().mul(bob);
        // gate: orb k contributes only while uCount > k (so more wisps = more lights).
        const active = (uCount as unknown as TNode).sub(f1(k + 0.5)).clamp(0, 1);

        glow = glow.add(orb.mul(active));
        // Each lit wisp also seeds tendrils nearby: its falloff modulates the haze
        // so tendrils visibly emanate from THAT wisp, not from a global centre.
        const near = d.mul(falloff.mul(0.5)).negate().exp();
        tendril = tendril.add(near.mul(active));
      }

      // Tendrils = haze carved by proximity to lit wisps. Continuous-domain haze
      // times per-wisp proximity => wispy filaments reaching off each core.
      const tendrils = (tendril as TNode).clamp(0, 1.4).mul(haze);

      // --- composite the field -------------------------------------------------
      // cores: the bright glowing wisp bodies.   tendrils: filaments off them.
      // veil: faint ambient volume the whole thing melts into.
      const cores = (glow as TNode).clamp(0, 2.0);
      const field = cores
        .add(tendrils.mul(0.7))
        .add(veil.mul(0.10))
        .add((veil as TNode).mul(haze).mul(0.06));

      // --- pseudo-depth fade (soft volume, no geometry) ------------------------
      // Smooth radial vignette so the light reads as embedded in a soft volume
      // that recedes toward the edges — continuous gradient, no seams.
      const vignette = p.length().mul(1.5).smoothstep(1.2, 0.0).add(0.22);
      const lit = (field.mul(vignette) as TNode).max(f1(0));

      // --- OPACITY: capped so glow keeps colour (no blown-out white) -----------
      // Additive blending already brightens overlaps; cap alpha < 1 so the core
      // body never clips to pure white. Only the very centre of each core (where
      // `lit` is highest) gets a small near-white pip via the colour mix below.
      const opacity = lit.mul(0.85).clamp(0, 0.92);

      // --- COLOUR: eerie cyan/green that SURVIVES the brightness ----------------
      // Body stays a saturated cyan-green; a small white-hot centre only at the
      // hottest pixels (litHot). We DO NOT push the whole body toward white.
      const haloCol = t3(0.10, 0.62, 0.40);  // deep eerie green halo (saturated)
      const coreCol = t3(0.40, 0.95, 0.74);  // bright cyan-green core (still coloured)
      const whiteHot = t3(0.85, 1.0, 0.92);  // near-white, NOT pure white

      // Mix halo -> core by a SOFT (sub-unity) measure of brightness so most of
      // the body sits at the coloured core, not white.
      const litN = lit.clamp(0, 1);
      const body = haloCol.mix(coreCol, litN.smoothstep(0.0, 0.7));
      // White-hot pip ONLY where lit is very high (centre of a core). gateHot is 0
      // across the body and ramps to ~1 only at the brightest core pixels, so
      // saturation survives everywhere except a tiny central pip.
      const gateHot = (lit as TNode).smoothstep(1.15, 1.9).mul(0.5);
      const tint = body.mix(whiteHot, gateHot);

      // Final colour: tint scaled by a CAPPED brightness so additive compositing
      // does not march RGB to 255. The cap (1.0) plus the 0.92 alpha cap keeps the
      // effective on-screen colour saturated.
      const bright = lit.clamp(0, 1).add(0.35).min(1.0);
      const colorNode = tint.mul(bright);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacity;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the shared scratch space (host can drive
      // them; tests observe the advancing clock without reaching into pixels).
      target.userData.wispUniforms = { uTime, uDrift, uGlow, uCount };

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.driftSpeed, 0.8);
          uGlow.value = clamp(num(params.glowSize, 0.16), 0.05, 0.3);
          uCount.value = clamp(num(params.wisps, 4), 2, MAX_WISPS);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'driftSpeed') uDrift.value = num(value, 0.8);
          else if (id === 'glowSize') uGlow.value = clamp(num(value, 0.16), 0.05, 0.3);
          else if (id === 'wisps') uCount.value = clamp(num(value, 4), 2, MAX_WISPS);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wispUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
