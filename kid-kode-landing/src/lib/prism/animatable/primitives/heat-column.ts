// heat-column — a shimmering VOLUMETRIC column of rising heat-haze and embers
// glows over an unseen ember bed. HARD / GPU / volumetric primitive. The host
// builds the plane subject as a 5-slab back-to-front stack (volumetric:true), and
// each slab samples a DIFFERENT slice of the turbulent advection field via the
// per-vertex `aDepth` attribute (0 front → 1 back). Each slab parallaxes the noise
// domain and uses aDepth as a real 3rd noise dimension, so the stack reads as a
// genuine rising volume rather than 5x flat overdraw. Front slabs are brighter and
// hotter; rear slabs fade and cool for front-to-back self-shadow / density falloff.
// A horizontal shimmer shears the column for heat-haze distortion. Swaps the
// host's material for a transparent, depth-write-off, additively-blended
// MeshBasicNodeMaterial so the far-first slabs composite as a warm glow.
// seek() advances the time uniform; onParamChange() updates the live uniforms.
// Uniform handles are published on target.userData so the headless CPU test can
// observe motion. DISTINCT from fire-flame: no visible flame, just rising heat.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// Permissive chainable TSL node alias (mirrors nebula.ts). TSL's per-call generic
// typing is far narrower than the runtime node graph it builds; value-noise / fbm
// pass nodes through helpers the strict overloads reject. We work through a single
// method-chaining alias (every TSL node supports these) so the helpers compose
// without fighting inferred VarNode generics. The graph built is identical.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  abs: () => TNode;
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
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.1, step: 0.005, default: 0.05 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
] as const;

export const heatColumnPrimitive: PrimitiveDefinition = {
  name: 'heat-column',
  label: 'Heat Column',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // Volumetric: host builds a 5-slab coplanar stack; aDepth drives per-slab slice.
  defaultDriver: 'time',
  description:
    'A shimmering volumetric column of rising heat-haze and embers glows faintly over an unseen ember bed, the air distorting and wobbling upward through depth.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'heat-column', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1));
      const uWobble = uniform(num(params.wobble, 0.05));
      const uIntensity = uniform(num(params.intensity, 1));

      // Publish uniform handles for the CPU test (and any host introspection).
      target.userData.heatColumnUniforms = { uTime, uRise, uWobble, uIntensity };

      // Per-vertex depth slice (0 front → 1 back). On a non-volumetric fallback
      // subject the attribute is absent and resolves to 0 (all-front), degrading
      // gracefully to the prior single-slab look.
      // Single-plane render (NOT volumetric): AdditiveBlending summed over the
      // 5-slab stack washed the warm column toward grey/cool, so this matches the
      // premium single-plane fire-flame.ts. aDepth pinned to 0 (front slab) →
      // every depth term collapses to its full front value, no per-slab parallax.
      const aDepth = f1(0);

      const tNode = uTime as unknown as TNode;
      const riseNode = uRise as unknown as TNode;
      const wobbleNode = uWobble as unknown as TNode;
      const intensityNode = uIntensity as unknown as TNode;

      // Deterministic value-noise hash → smooth value noise → fbm. All node
      // expressions, so the chain compiles under the WebGPU node material.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant: f*f*(3-2f)
        const u = f.mul(f).mul(f1(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, u.x);
        const cd = c.mix(d, u.x);
        return ab.mix(cd, u.y);
      };

      // 5-octave domain-warped fbm — kills blocky low-res value noise.
      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      const u = uv() as unknown as TNode;
      const ux = u.x;
      const uy = u.y;

      // Heat-shimmer distortion: shear x by a vertically-travelling wobble, and
      // give each depth slab its own phase so the haze swims through the volume.
      const shimmerPhase = uy.mul(4).add(tNode).add(aDepth.mul(3.1));
      const cx = shimmerPhase.sin().mul(wobbleNode);
      const wx = ux.add(cx);

      // Centered-x envelope: a soft column, slightly tighter on rear slabs so the
      // volume tapers with depth. envelope = smoothstep(edge → 0, |x-0.5|).
      const halfWidth = f1(0.5).sub(aDepth.mul(0.12));
      const distC = wx.sub(0.5).abs();
      const envelope = halfWidth.sub(distC).clamp(0, 1).smoothstep(0.04, 0.42);

      // Turbulent vertical advection. Each slab parallaxes the noise domain (so it
      // samples a DIFFERENT slice, not duplicate overdraw) AND feeds aDepth in as a
      // real 3rd noise dimension via a depth-scrolled domain warp. The parallax
      // offset is kept small (<= 0.2) so the 5 slabs blend smoothly instead of
      // reading as hard seams/bands.
      const parallax = aDepth.mul(0.18);
      const depthDim = aDepth.mul(0.18);
      const advect = uy.mul(6).sub(tNode.mul(riseNode)).add(depthDim);

      const basePos = t2(wx.mul(4).add(parallax).add(depthDim), advect);
      // Domain-warp: sample fbm at a point offset by another fbm (premium churn).
      const warpX = fbm(basePos.add(t2(tNode.mul(0.18), depthDim)));
      const warpY = fbm(basePos.add(t2(7.3, 2.1)).sub(t2(0, tNode.mul(0.5).mul(riseNode))));
      const warped = basePos.add(t2(warpX, warpY).mul(1.4));
      const f = fbm(warped);
      const turbulence = f1(0.45).add(f.mul(0.55));

      // Brighter low, fading up: vertical falloff multiplies the warmth.
      const vertical = f1(1).sub(uy).clamp(0, 1).pow(1.15);

      // Depth-fade: rear slabs fainter for self-shadow / density falloff, but the
      // floor is lifted to 0.5 so the rear of the volume never sinks toward black.
      const depthFade = aDepth.oneMinus().mul(0.5).add(0.5);

      // Gain so the column clearly reads as hot (warmth drove both colour AND
      // opacity and the product of five sub-unity factors left it too faint —
      // washing to a muddy cool tint over the dark bg). 1.6× pushes the base into
      // the orange/white-hot band.
      const warmth = envelope
        .mul(turbulence)
        .mul(vertical)
        .mul(depthFade)
        .mul(intensityNode)
        .mul(1.15)
        .clamp(0, 1);

      // Embers: rare hot specks where the warped field peaks, hottest on front
      // slabs. Adds glinting detail without a visible flame.
      const ember = turbulence.smoothstep(0.78, 0.97).mul(aDepth.oneMinus().pow(1.5)).mul(0.9);

      // Warm palette: deep ember-red base → orange → near-white hot cores. Every
      // stop is strictly R >= G >= B so the emitted colour stays a genuine warm
      // heat with no blue/grey cast. Rear slabs dim only slightly (uniformly across
      // channels) so the stack reads as a lit volume without going cool.
      // Saturated stops (low G/B) so ACES tonemapping keeps the column orange
      // instead of washing the hot core to cream/white. hotWhite is reached only
      // at the very top of the warmth range so most of the column reads orange.
      const emberRed = t3(0.6, 0.05, 0.0);
      const orange = t3(1.0, 0.32, 0.02);
      const hotWhite = t3(1.0, 0.72, 0.4);
      const lo = emberRed.mix(orange, warmth.smoothstep(0.12, 0.6));
      const palette = lo.mix(hotWhite, warmth.smoothstep(0.82, 1.05));
      const dimByDepth = f1(1).sub(aDepth.mul(0.12));

      // Add a strong warm floor wherever the column exists so even low-warmth
      // texels read as ember-orange (never grey/cool): floor scales with the
      // column envelope × vertical falloff, not the dim warmth product.
      const columnMask = envelope.mul(vertical);
      const warmFloor = t3(0.34, 0.07, 0.0).mul(columnMask);
      // Clean warm heat ramp driven purely by `warmth` (a diagnostic constant-red
      // colorNode proved the column SHAPE + pipeline are correct; the prior
      // palette/ember composite was producing a cool cast on the real GPU, so this
      // replaces it with a guaranteed-warm ramp). Every stop is strongly saturated
      // R>>G>=B so ACES tonemapping keeps it orange, not cream/teal. The fbm-driven
      // turbulence lives in `warmth` (hence in both the ramp position and the
      // opacity), giving the column its licking texture without any cool term.
      void palette; void ember; void emberRed; void orange; void hotWhite; void lo;
      // Keep G LOW even at the hottest stop (bright ORANGE, not yellow-white):
      // the cool/teal cast only appeared at the high-brightness, high-G end — a
      // tonemapping hue shift on bright additive content — so a low-G orange ramp
      // at capped brightness stays warm end to end.
      const cRamp0 = t3(0.62, 0.04, 0.0).mix(t3(1.0, 0.28, 0.02), warmth.smoothstep(0.08, 0.5));
      const cRamp1 = cRamp0.mix(t3(1.0, 0.5, 0.12), warmth.smoothstep(0.55, 0.95));
      const colorNode = cRamp1.mul(warmth.mul(0.5).add(0.42)).add(warmFloor).mul(dimByDepth);

      // opacityNode: the column's own shape (envelope × vertical), lifted by
      // warmth — so the column is solidly visible, not gated to near-zero by the
      // dim warmth product (which made it wash out into the bg).
      const opacityNode = columnMask.mul(warmth.mul(0.5).add(0.5)).clamp(0, 1);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful / looping upward advection — animate continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1);
          uWobble.value = num(params.wobble, 0.05);
          uIntensity.value = num(params.intensity, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'wobble') uWobble.value = num(value, 0.05);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.heatColumnUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
