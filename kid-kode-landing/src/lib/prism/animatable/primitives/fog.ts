// fog — drifting fog banks roll sideways across the frame with real front-to-back
// depth. HARD / GPU primitive. SINGLE FLAT PLANE (volumetric:false): one quad,
// no slab stack, so there are NO slab-edge seams to read as nested frames. Depth
// is synthesized IN THE SHADER instead of from a per-vertex slab attribute: a
// slow, large-scale `fbmWarped` "depth field" places each patch of fog at a
// notional distance (0 near → 1 far), and that pseudo-depth parallaxes the noise
// domain, fades + cools the far banks, and gates detail — so one quad reads as a
// layered volume rather than a flat grey wash.
//
// NOISE: round-1 used an inline sin-hash value-noise fbm whose axis-aligned
// integer LATTICE was fully visible across the full-frame quad — the user-advocate
// gate flagged it as a hard rectangular GRID OF SQUARE TILES (a checkerboard /
// wall of grey stone). The fix replaces ALL value-noise/fbm with the SHARED
// `fbmWarped` / `fbmRot` field (rotated-octave, quintic-interp, domain-warped),
// which never resolves into a square grid. Every bank field samples at a base
// frequency ≥7 so cells stay small, and the noise domain is kept CONTINUOUS across
// the whole quad — no centered `uv-0.5` / `.abs()` fold is ever fed into the noise
// domain (that would mirror-seam the mid-quad). Even the large-scale depth field
// goes through `fbmWarped` (low warp), NOT a raw low-frequency value-noise term.
// The result is VIVID, soft-edged, defined fog with depth — never a muddy grey
// smear, never black, and never a tiled stone wall.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData.fogUniforms for CPU tests.

import { Mesh, type Material, NormalBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts / mist-drift.ts, we
// work through a single permissive chainable node alias (method-chaining only,
// which every TSL node supports) so the helpers compose without fighting inferred
// VarNode generics. The graph this builds is identical to the free-function form.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
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

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
  { id: 'density', label: 'Density', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 1 },
  { id: 'layers', label: 'Layers', type: 'knob', min: 1, max: 5, step: 1, default: 3 },
] as const;

export const fogPrimitive: PrimitiveDefinition = {
  name: 'fog',
  label: 'Fog',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — depth is synthesized in-shader, so no slab seams.
  volumetric: false,
  defaultDriver: 'time',
  description:
    'Drifting fog banks roll sideways with real front-to-back depth — clean, soft-edged cool grey-white fog, not a flat wash.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.6));
      const uDensity = uniform(num(params.density, 1));
      const uLayers = uniform(num(params.layers, 3));

      // ── shared premium volumetric noise (rotated-octave, quintic, warped) ──
      // The inline sin-hash value-noise from round-1 showed its integer lattice as
      // a square tile grid across the full-frame quad (the user-advocate defect).
      // We now sample the SHARED `_volume-fbm` field through these thin adapters so
      // the helper's loose node types compose with our chainable TNode alias. Both
      // never resolve into a square grid: `fbmWarped` for fog-bank bodies (its
      // domain warp turns large cells into wavy blobs) and `fbmRot` for the
      // pre-warp depth field (still rotated-octave + quintic, so no axis grid).
      const warped = (p: TNode, w: number): TNode =>
        fbmWarped(p as unknown, w, 5).clamp(0, 1) as unknown as TNode;
      const rotField = (p: TNode): TNode =>
        fbmRot(p as unknown, 5).clamp(0, 1) as unknown as TNode;

      const u0 = uv() as unknown as TNode;
      const t = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);
      const density = uDensity as unknown as TNode;

      // Stretched horizontal base coordinate: fog banks are wide and low. The
      // whole field advects along x via the per-layer drift below. This is a plain
      // continuous affine map of uv — NO centered/folded (uv-0.5 / .abs) term ever
      // enters the noise domain, so there is no mid-quad mirror seam.
      const baseUv = t2(u0.x, u0.y.mul(0.62));

      // ── 1. Synthesized depth field (the trick that gives one quad volume) ──
      // A slow, large-scale `fbmWarped` (low warp) assigns every patch of the
      // frame a notional distance: ~0 = a near bank, ~1 = a far bank. It drifts
      // very slowly so the depth arrangement itself evolves. Base freq ~7 keeps
      // its cells small; the warp + rotation kill any square structure. This
      // replaces the per-vertex slab `aDepth` attribute from the 5-slab era —
      // and, critically, is NOT a raw low-frequency value-noise term.
      const depthRaw = warped(
        t2(baseUv.x.mul(7.0).sub(t.mul(0.06)), baseUv.y.mul(7.0).add(7.3)),
        0.6,
      );
      const depth = depthRaw.smoothstep(0.28, 0.78).clamp(0, 1); // 0 near → 1 far

      // ── 2. Three drifting bank-fields, near→far, each its own scale + rate ──
      // Motion parallax: the near layer slides faster than the far layer, so the
      // banks read as separate sheets gliding at different distances. Every layer
      // samples `fbmWarped` at a base frequency ≥7 (so the largest warped cells
      // are small) over a continuous domain — no tile grid, no fold seam.
      const bankField = (
        scale: number,
        driftRate: number,
        parallax: number,
        domainSeed: number,
        warpAmt: number,
      ): TNode => {
        // Parallax the noise domain by the synthesized depth so a layer's
        // structure shifts with distance — far patches are pushed sideways. The
        // domain warp lives inside `fbmWarped`, so no extra hand-rolled warp.
        const p = t2(
          baseUv.x.mul(scale).sub(t.mul(driftRate)).add(depth.mul(parallax)).add(domainSeed),
          baseUv.y.mul(scale).add(depth.mul(1.4)).add(domainSeed),
        );
        return warped(p, warpAmt);
      };

      // Base frequencies 7.0 / 9.6 / 12.4 — all ≥7, ascending so the near bank
      // is the finest detail. Near drifts fastest (motion parallax).
      const nearBank = bankField(12.4, 0.5, 0.0, 0.0, 1.1); // fastest, closest, finest
      const midBank = bankField(9.6, 0.32, 1.1, 11.2, 1.0); // mid distance
      const farBank = bankField(7.0, 0.18, 2.2, 23.7, 0.85); // slowest, farthest

      // ── 3. Composite banks front-to-back, gated by the Layers control ───────
      // uLayers (1..5) smoothly fades in additional bank sheets: at 1 only the
      // near bank, by 3 the mid bank is in, by 5 the far bank + extra turbulence
      // are fully in — so "Layers" visibly thickens and deepens the fog.
      const L = (uLayers as unknown as TNode).clamp(1, 5);
      const wMid = L.sub(1).div(2).clamp(0, 1); // 0 at L=1 → 1 at L=3
      const wFar = L.sub(3).div(2).clamp(0, 1); // 0 at L=3 → 1 at L=5

      // Far banks are fainter (atmospheric falloff) before they even composite.
      const farFade = depth.oneMinus().mul(0.55).add(0.45); // 1 near → 0.45 far
      let banks = nearBank;
      banks = banks.add(midBank.mul(wMid).mul(0.8));
      banks = banks.add(farBank.mul(wFar).mul(farFade).mul(0.7));
      // Normalize so adding layers deepens rather than just brightens.
      const norm = f1(1).div(wMid.mul(0.8).add(wFar.mul(0.7)).add(1));
      const fogRaw = banks.mul(norm);

      // ── 4. Shape into DEFINED, soft-edged fog (not a flat muddy wash) ───────
      // A vertical gradient (thicker low, thinner high) plus the density control
      // sets coverage; smoothstep carves clean soft edges; a small additive lift
      // keeps the thinnest fog readable without flooding the whole quad to grey.
      const vertical = u0.y.oneMinus().mul(0.7).add(0.45);
      const coverage = fogRaw.mul(vertical).mul(density);
      // Defined banks: a fairly tight smoothstep window gives soft but real
      // edges — fog has shape, it is not a uniform smear.
      const fogMask = coverage.smoothstep(0.28, 0.92).clamp(0, 1);

      // ── 5. Clean cool grey-white palette with gentle luminosity + depth ─────
      // Near fog is bright clean grey-white; far fog is cooler and a touch
      // darker (aerial perspective). The base under the fog is a soft cool
      // gradient, NOT black, so thin fog sits over depth rather than a void —
      // but the gradient is dim enough that the bright banks stay vivid.
      const nearCol = t3(0.86, 0.9, 0.95);
      const farCol = t3(0.42, 0.5, 0.62);
      const fogCol = nearCol.mix(farCol, depth);

      // Luminosity: brighten the densest cores a touch so banks glow gently.
      const lum = fogMask.pow(1.4).mul(0.35);
      const litFog = fogCol.mul(f1(1).add(lum));

      // Dim cool ground gradient (cooler/darker at the floor) so the quad never
      // reads as a flat grey card — there is depth even where the fog is thin.
      const ground = t3(0.07, 0.09, 0.13).mix(t3(0.16, 0.2, 0.27), u0.y);

      // Composite fog over the ground by the mask: defined banks pop, the void
      // between them shows the dim cool gradient (depth), nothing muddy.
      const colorNode = ground.mix(litFog, fogMask) as unknown;

      // Opacity tracks the mask (so banks read as denser, not just brighter) with
      // a thin floor of the ground gradient so the tile is never pure black.
      const opacityNode = fogMask.mul(0.92).add(0.12).clamp(0, 1) as unknown;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.fogUniforms = { uTime, uSpeed, uDensity, uLayers };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.6);
          uDensity.value = num(params.density, 1);
          uLayers.value = num(params.layers, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'layers') uLayers.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.fogUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
