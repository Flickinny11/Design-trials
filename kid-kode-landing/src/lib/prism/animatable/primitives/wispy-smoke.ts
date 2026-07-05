// wispy-smoke — thin curling wisps of smoke that rise and dissipate, sparser and
// finer than the dense `smoke` tile. The ILLUSION of volume is built ENTIRELY
// IN-SHADER on ONE flat quad (subject:'plane', volumetric:false → no slab stack,
// so there are NO slab-edge seams / shelf banding by construction).
//
// ROUND-2 FIX (vision review of the round-1 REAL-GPU frames): the round-1 hard
// alpha gate (smoothstep 0.56→0.78 on an ISOTROPIC fbm field) carved the noise
// crests into harsh isolated BLOTCHES — torn-paper scraps with sharp bright cores —
// and the rectangular edge vignette gave the whole effect a square extent. Fixes:
//   1. SOFT gates: wide smoothstep windows (≈0.38 ramp), never a hard cut, so
//      every strand is soft-edged. The gate floor RISES with height so tendrils
//      visibly THIN OUT toward the top.
//   2. ANISOTROPIC domains: x-frequency ≫ y-frequency (front t2(x·14, y·4.2)) so
//      features are TALL AND THIN — rising tendrils, not blobs.
//   3. CURL shear: horizontal warp displacement GROWS with height, so tendrils
//      rise from the base then visibly BEND as they climb.
//   4. SILHOUETTE from the effect's own shape: a loose base COLUMN with a noise-
//      wandering centerline and noise-modulated width (widening as smoke rises)
//      replaces the uniform rectangular vignette. A thin edge guard only zeroes
//      alpha at the very quad border; it never shapes the look.
//   5. Modest brightness: peak alpha ≈0.55, highlight mix capped low (no sharp
//      bright cores, no blow-out).
// ALL noise still comes from the shared `_volume-fbm` helper: rotated-octave +
// QUINTIC (C2-continuous) + DOMAIN-WARPED value noise — no lattice, no seams.
//
// ART: two depth layers — a faint LARGE rear haze (low-warp fbmWarped) behind thin
// brighter FRONT tendrils (anisotropic fbmRot) — scrolling up at different speeds
// for parallax. `rise` scrolls the field upward AND sets the column REACH (how
// high the tendrils climb before dissipating — visible on a paused frame, per the
// heat-column precedent); `curl` shears it so the strands
// bend; `density` scales coverage; soft grey-blue tint. The noise DOMAIN is a plain
// scaled/scrolled uv — no centered `uv-0.5`/`.abs()` fold (which would mirror-seam
// the mid-quad) and no `fract`/wrap term in the envelopes (which would hard-seam).
// Load-bearing gates use the FREE-FUNCTION smoothstep/clamp/mix from 'three/tsl'
// (method-form windows extrapolate on some node chains).
//
// seek() advances uTime; onParamChange() updates live rise/curl/density/tint
// uniforms. Mirrors smoke.ts in alpha-gate / material-restore discipline.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep, clamp, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// See smoke.ts / nebula.ts: TSL's per-call generic typing is far narrower than the
// runtime node graph it builds, so fbm/value-noise helpers that pass nodes through
// functions trip the strict overloads. We compose through one permissive chainable
// node alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph is identical to
// the free-function form. (tsc strictness.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
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
// FREE-FUNCTION gates (load-bearing): method-form smoothstep windows extrapolate on
// some node chains, so the alpha path goes through these three/tsl free functions.
const ss = (lo: V, hi: V, x: V): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(lo, hi, x) as TNode;
const cl = (x: TNode, lo: number, hi: number): TNode =>
  (clamp as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(x, lo, hi) as TNode;
const mx = (a: TNode, b: TNode, t: TNode): TNode =>
  (mix as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(a, b, t) as TNode;
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.4 },
  { id: 'curl', label: 'Curl', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#b8bccb' },
] as const;

export const wispySmokePrimitive: PrimitiveDefinition = {
  name: 'wispy-smoke',
  label: 'Wispy Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — the volume is an ILLUSION built in-shader from rotated,
  // quintic, domain-warped fbm with a rotational curl-warp. NOT the 5-slab stack
  // (which read as hard horizontal shelf steps), and NOT inline value noise.
  volumetric: false,
  defaultDriver: 'time',
  description:
    'Thin curling wisps of smoke rise and dissipate, with in-shader volume: a rotational curl-warp swirls fine alpha-gated fbm tendrils that scroll upward across two depth-faded layers — sparse smooth strands, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wispy-smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#b8bccb'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 0.4));
      const uCurl = uniform(num(params.curl, 0.5));
      const uDensity = uniform(num(params.density, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can read live state.
      target.userData.wispySmoke = { uTime, uRise, uCurl, uDensity };

      const uTimeN = uTime as unknown as TNode;
      const uRiseN = uRise as unknown as TNode;
      const uCurlN = uCurl as unknown as TNode;
      const uDensityN = uDensity as unknown as TNode;

      const uvN = uv() as unknown as TNode;
      const px = uvN.x;
      const py = uvN.y; // 0 = bottom of quad, 1 = top

      // ── Rising scroll: SUBTRACT an upward drift from y so the field flows up the
      //    quad. Rise stays gentle (wisps rise slowly). A small fixed base keeps a
      //    drift even at rise=0 so the tile is never frozen. ────────────────────
      const drift = uTimeN.mul(uRiseN.mul(0.6).add(0.12));

      // ── CURL shear: a slow large-scale `fbmWarped` displacement of the plain uv
      //    domain (no centered/abs fold, no wrap term). The HORIZONTAL displacement
      //    GROWS with height, so tendrils leave the base nearly straight and BEND
      //    sideways as they climb — the classic rising-smoke curl. ───────────────
      const curlAmt = uCurlN.mul(0.3);
      const swirlDomain = t2(
        px.mul(2.6).add(uTimeN.mul(0.05)),
        py.mul(2.6).sub(drift.mul(0.4)),
      );
      const swirlX = warped(swirlDomain, 0.7, 4).sub(0.5);
      const swirlY = warped(
        t2(swirlDomain.x.add(5.2), swirlDomain.y.add(1.3)),
        0.7,
        4,
      ).sub(0.5);
      const heightLift = py.mul(0.9).add(0.35); // bend grows with height
      const curlX = px.add(swirlX.mul(curlAmt).mul(heightLift));
      const curlY = py.sub(swirlY.mul(curlAmt).mul(0.5));

      // ── FRONT layer: thin bright tendrils. ANISOTROPIC domain — x-frequency much
      //    higher than y-frequency (14 vs 4.2) — stretches every feature TALL AND
      //    THIN so the crests read as rising strands, never round blobs. Scrolls up
      //    fastest (reads as foreground). ─────────────────────────────────────────
      const frontDomain = t2(
        curlX.mul(14.0),
        curlY.mul(4.2).sub(drift.mul(1.6)),
      );
      const front = rotFbm(frontDomain, 5);

      // ── REAR layer: faint LARGE haze breathing behind the strands. Mildly
      //    anisotropic warped field at lower frequency, slower scroll, big offset =
      //    depth parallax. Never a raw low-frequency value-noise term. ───────────
      const rearDomain = t2(
        curlX.mul(7.5).add(23.7),
        curlY.mul(3.0).sub(drift.mul(0.9)).add(9.1),
      );
      const rear = warped(rearDomain, 1.0, 5);

      // ── SOFT gates (the round-1 hard cut made torn-paper blotches): wide
      //    smoothstep windows so every strand fades smoothly into transparency.
      //    The front gate FLOOR rises with height → tendrils thin out by the top. ─
      const gateLo = py.mul(0.14).add(0.4);
      const gateHi = gateLo.add(0.38);
      const frontWisp = ss(gateLo, gateHi, front); // soft thin strands
      const rearWisp = ss(0.34, 0.92, rear).mul(0.35); // faint backing haze
      const wisp = cl(frontWisp.add(rearWisp), 0, 1);

      // ── Vertical narrative: emerge softly from a low base, dissipate by the top
      //    edge. Plain non-wrapping envelopes. ────────────────────────────────────
      const bottomFade = ss(0.02, 0.22, py);

      // ── ROUND-4 FIX (advocate: 'rise' was a pure scroll SPEED — invisible on a
      //    paused frame; sweep measured changed=false). Heat-column precedent: rise
      //    ALSO sets the column REACH — a static, visible property. The dissipation
      //    window now climbs with rise: at rise=0 the fade runs 0.08→0.33 (wisps hug
      //    a low puff near the base); at rise=1.5 it runs 0.80→1.63 (tendrils climb
      //    near the top of the quad). The sqrt response + coefficients are calibrated
      //    so the DEFAULT (rise=0.4) window is ≈(0.45, 1.0) — byte-for-byte the
      //    window that passed the photoreal gate, so the default look is unchanged.
      //    Scroll speed (`drift` above) still rides rise — both behaviors are real. ─
      const riseT = cl(uRiseN.mul(1 / 1.5), 0, 1).pow(0.5);
      const reachLo = riseT.mul(0.72).add(0.08);
      const reachHi = reachLo.add(riseT.mul(0.581).add(0.25));
      const topFade = ss(reachLo, reachHi, py).oneMinus();
      // Thin top guard: alpha reaches exactly 0 at y=1 even when the rise-driven
      // window extends past the quad (reachHi>1 at high rise). Mirrors guardX —
      // it never shapes the visible silhouette below y≈0.93.
      const guardY = ss(0.93, 1.0, py).oneMinus();

      // ── Loose base COLUMN — the SILHOUETTE comes from the effect's own organic
      //    shape, not a uniform vignette. A noise-wandering centerline + a noise-
      //    modulated half-width that WIDENS as the smoke rises; the column boundary
      //    is therefore irregular on both sides (no mirror symmetry, no rectangle).
      //    Low-frequency WARPED fields are sanctioned for shape masks. ────────────
      const centerOff = warped(
        t2(py.mul(1.7).add(4.3), uTimeN.mul(0.03).add(1.0)),
        1.0,
        4,
      )
        .sub(0.5)
        .mul(0.22);
      const halfW = py
        .mul(0.2)
        .add(0.16)
        .add(
          warped(t2(py.mul(2.3).add(11.0), uTimeN.mul(0.025).add(3.0)), 1.0, 4)
            .sub(0.5)
            .mul(0.1),
        );
      const xo = px.sub(0.5).sub(centerOff); // smooth signed offset (shape mask only)
      const d2 = xo.mul(xo); // C∞ smooth — no fold seam, never fed into noise
      const halfW2 = halfW.mul(halfW);
      const colMask = ss(halfW2.mul(0.2), halfW2, d2).oneMinus();

      // ── Edge guard: guarantees alpha EXACTLY 0 at the left/right quad border.
      //    The organic column ends well inside it — the guard never shapes the
      //    visible silhouette (it is not a vignette). ─────────────────────────────
      const guardX = ss(0.0, 0.07, px).mul(ss(0.93, 1.0, px).oneMinus());

      const dens = cl(
        wisp
          .mul(bottomFade)
          .mul(topFade)
          .mul(guardY)
          .mul(colMask)
          .mul(guardX)
          .mul(uDensityN),
        0,
        1,
      );

      // ── Gentle alpha mapping: long soft ramp, PEAK alpha ≈ 0.55 (modest — wisps
      //    are translucent). No contrast-boosting re-gate (that made the blotches).
      const alpha = ss(0.005, 0.85, dens).mul(0.55);

      // ── Colour: soft grey-blue wisps with MILD internal contrast. The round-1
      //    bright cores came from a strong highlight mix on hard-gated crests; the
      //    highlight here is capped low and rides the soft density ramp. ──────────
      const tint = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      // Internal shading centred ~0: front crests brighten gently, rear dims.
      const shade = front.sub(rear.mul(0.5)).mul(0.3);
      const litTint = cl(tint.mul(f1(1).add(shade)), 0, 1);
      // Densest strands lift slightly toward a cool blue-white (max 18% mix); a
      // small cool floor keeps the faintest wisps grey-blue, never black/warm.
      const lit = mx(litTint, t3(0.84, 0.87, 0.94), ss(0.6, 1.0, dens).mul(0.18)).add(
        t3(0.05, 0.06, 0.08).mul(dens),
      );
      const colorNode = cl(lit, 0, 1);

      const opacityNode = cl(alpha, 0, 0.55);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // smoke/cloud → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously drifting wisps — runs off the time driver.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 0.4);
          uCurl.value = num(params.curl, 0.5);
          uDensity.value = num(params.density, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 0.4);
          else if (id === 'curl') uCurl.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 0.5);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wispySmoke;
          mat.dispose();
        },
      };
    },
  ),
};
