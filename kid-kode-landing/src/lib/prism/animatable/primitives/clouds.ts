// clouds — soft billowing cumulus drift slowly across a sky. HARD / VOLUMETRIC
// primitive. The host builds the preview subject as a 5-slab back-to-front quad
// stack (volumetric: true + subject: 'plane'); every vertex carries the frozen
// `aDepth` attribute (0 front → 1 rear). We swap the plane's material for a
// single MeshBasicNodeMaterial shared by all 5 slabs and read `aDepth` to:
//   1. parallax the fbm domain per slab (each slab samples a DIFFERENT slice +
//      aDepth feeds in as a real 3rd noise dimension), so the puffs sit at
//      genuinely different depths instead of 5x identical overdraw, and
//   2. depth-fade + self-shadow the rear slabs (fainter alpha, darker tint),
//      so front-to-back occlusion reads as a lit cumulus volume.
// NormalBlending + transparent + depthWrite:false → painter-style 'over'
// compositing of the far-first slab order. Domain-warped 5-octave fbm (nebula.ts
// gold standard) kills the blocky low-res value-noise of the old flat fill.
//
// Uniform handles (uTime/uSpeed/uCoverage/uScale) are published on
// target.userData so the CPU conformance test can observe a concrete .value
// change across the timeline (headless has no GPU to read pixels from).

import { Mesh, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helpers the strict overloads of
// the free TSL functions reject. Like nebula.ts, we work through one permissive
// chainable node alias (method-chaining only, which every TSL node supports) so
// the helpers compose without fighting the inferred VarNode generics. The graph
// this builds is identical to the equivalent free-function form. (tsc strictness
// — mirrors the reference's casting discipline.)
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
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
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
  volumetric: true,
  description:
    'Soft cumulus clouds drift slowly across a sky, billowing through real depth as they pass.',
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

      // Per-vertex depth across the 5-slab stack: 0 front → 1 rear.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // 3D value-noise hash → smooth value noise → fbm. Feeding aDepth as a real
      // 3rd dimension (vec3 lattice) makes each slab sample a genuinely
      // different volume slice, not the same 2D field five times over.
      const hash3 = (p: TNode): TNode =>
        p.dot(t3(127.1, 311.7, 74.7)).sin().mul(43758.5453).fract();

      const noise3 = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant f*f*(3-2f)
        const u = f.mul(f).mul(f1(3).sub(f.mul(2)));
        // trilinear blend of the 8 lattice corners
        const c000 = hash3(i);
        const c100 = hash3(i.add(t3(1, 0, 0)));
        const c010 = hash3(i.add(t3(0, 1, 0)));
        const c110 = hash3(i.add(t3(1, 1, 0)));
        const c001 = hash3(i.add(t3(0, 0, 1)));
        const c101 = hash3(i.add(t3(1, 0, 1)));
        const c011 = hash3(i.add(t3(0, 1, 1)));
        const c111 = hash3(i.add(t3(1, 1, 1)));
        const x00 = c000.mix(c100, u.x);
        const x10 = c010.mix(c110, u.x);
        const x01 = c001.mix(c101, u.x);
        const x11 = c011.mix(c111, u.x);
        const y0 = x00.mix(x10, u.y);
        const y1 = x01.mix(x11, u.y);
        const uz = (u as unknown as { z: TNode }).z;
        return y0.mix(y1, uz);
      };

      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        // 5 octaves of value noise → soft billowing structure.
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise3(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const tDrift = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);

      // Slow horizontal drift; vertical billow uses a slower offset. aDepth
      // parallax pushes each slab's sample SUBTLY along the drift axis so puffs
      // at different depths slide past each other — small offset (<=0.2) so
      // adjacent slabs share most of the field and blend into one volume
      // instead of separating into visible horizontal seams.
      const parallaxAmt = aDepth.mul(0.18);
      const base = (uv() as unknown as TNode).mul(uScale as unknown as TNode);
      const drift = t2(tDrift.mul(0.12).add(parallaxAmt), tDrift.mul(0.03).add(parallaxAmt.mul(0.4)));
      // aDepth feeds the 3rd noise dimension (z) only weakly, so neighbouring
      // slabs sample nearly the same slice → smooth continuous volume, not 5
      // distinctly different fields stacked as bands.
      const zSlice = aDepth.mul(0.45).add(tDrift.mul(0.05));
      const p = t3(base.x.add(drift.x), base.y.add(drift.y), zSlice);

      // Domain-warp the fbm by an fbm sampled at an offset point (nebula gold
      // standard) → curling, fluffy cumulus edges, no blocky lattice.
      const wx = fbm(p.add(t3(1.7, 9.2, 0.0)));
      const wy = fbm(p.add(t3(8.3, 2.8, 4.1)));
      const warped = t3(p.x.add(wx.mul(1.6)), p.y.add(wy.mul(1.6)), p.z);
      const cloud = fbm(warped).clamp(0, 1);

      // alpha = smoothstep(coverage, 1, fbm) — thresholded soft cumulus.
      const alphaBase = cloud.smoothstep(uCoverage as unknown as TNode, f1(1));

      // Depth-fade: rear slabs (aDepth→1) are slightly fainter so the stack
      // reads as a volume with front-to-back falloff — but the floor stays high
      // (>=0.55) so rear slabs NEVER approach black/murk; they stay clearly
      // sunlit cumulus, just gently receding.
      const depthFade = aDepth.oneMinus().mul(0.45).add(0.55);
      const alpha = alphaBase.mul(depthFade);

      // Soft blue sky base graded slightly lighter toward the top (uv.y).
      const skyLow = t3(0.42, 0.6, 0.86);
      const skyHigh = t3(0.62, 0.76, 0.95);
      const sky = skyLow.mix(skyHigh, (uv() as unknown as TNode).y);

      // Self-shadow: cumulus lit from above-front. Bright sunlit tops, gently
      // shaded (not dark) bottoms so the puffs read 3-dimensional while staying
      // a luminous white cumulus, not a muddy grey mass.
      const litTop = t3(1.0, 1.0, 1.0);
      const litBottom = t3(0.82, 0.85, 0.92);
      const vertical = (uv() as unknown as TNode).y.clamp(0, 1);
      const cloudShade = litBottom.mix(litTop, vertical.smoothstep(0.1, 0.85));
      // density-driven internal shading: keep clouds bright across density —
      // thin edges and dense cores both stay luminous (floor 0.8).
      const cloudCol = cloudShade.mul(cloud.mul(0.2).add(0.8));
      // rear slabs only gently dimmed for occlusion depth cue (floor >=0.84) so
      // the volume recedes without going dark.
      const depthDark = aDepth.mul(0.16).oneMinus();
      const shadedCloud = (cloudCol.mul(depthDark)) as TNode;

      const color = sky.mix(shadedCloud, alpha);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = color;
      // The SKY must read as a solid backdrop (not transparent → dark tile bg):
      // floor the opacity so the blue sky fills the tile and the white cumulus
      // sits on top, instead of cloud puffs floating on near-black.
      (mat as unknown as { opacityNode: unknown }).opacityNode = (alpha.mul(0.4).add(0.6)) as TNode;

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
