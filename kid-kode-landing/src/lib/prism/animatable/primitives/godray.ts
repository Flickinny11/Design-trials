// godray — warm volumetric light shafts radiating from a moving source point.
// REFERENCE-style primitive (hard / GPU / volumetric). Swaps the host plane's
// material for a MeshBasicNodeMaterial whose colorNode marches many samples
// toward a rotating light source, accumulating distinct amber god-ray beams with
// a decay weight, then adds a fbm dust shimmer that drifts along the shafts.
// When the host builds the subject as a 5-slab volumetric stack, each slab reads
// the per-vertex `aDepth` attribute to parallax its shaft field and depth-fade
// the rear slabs, so the rays read as a real lit volume rather than a flat tile.
// A time uniform rotates the source angle and pulses intensity; seek() advances
// it. Numeric controls update uniforms via onParamChange. Mirrors nebula.ts in
// fbm structure, TNode casting discipline, and material restore.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; like nebula.ts we work through a single permissive chainable node
// alias so the fbm / shaft helpers compose without fighting inferred generics.
// The graph this builds is identical to the equivalent free-function form.
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
  length: () => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
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
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.2 },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.8, max: 1, step: 0.005, default: 0.96 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 45, unit: 'deg' },
] as const;

const DEG2RAD = Math.PI / 180;
const SAMPLES = 28;

export const godrayPrimitive: PrimitiveDefinition = {
  name: 'godray',
  label: 'Volumetric godray',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  volumetric: true,
  defaultDriver: 'time',
  description:
    'Warm amber light shafts radiate from a rotating source, accumulated by marching many samples weighted by decay, with drifting dust shimmer and front-to-back volumetric depth.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'godray', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uIntensity = uniform(num(params.intensity, 1.2));
      const uDecay = uniform(num(params.decay, 0.96));
      const uDensity = uniform(num(params.density, 1));
      const uAngle = uniform(num(params.angleDeg, 45) * DEG2RAD);

      // Per-vertex depth slice: 0.0 front slab → 1.0 rearmost slab. Constant
      // within each slab, so each slab samples a parallaxed slice of the field.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // --- value-noise → fbm (nebula gold-standard), for the dust shimmer -----
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();
      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const w = f.mul(f).mul(f1(3).sub(f.mul(2))); // smooth Hermite
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, w.x);
        const cd = c.mix(d, w.x);
        return ab.mix(cd, w.y);
      };
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

      // Moving light source: orbit the base angle slowly with time on a circle
      // centered on the plane.
      const ang = (uAngle as unknown as TNode).add((uTime as unknown as TNode).mul(0.55));
      const src = t2(
        (cos(ang as unknown as ReturnType<typeof float>) as unknown as TNode).mul(0.34).add(0.5),
        (sin(ang as unknown as ReturnType<typeof float>) as unknown as TNode).mul(0.34).add(0.5),
      );

      const u = uv() as unknown as TNode;
      const density = uDensity as unknown as TNode;
      const decay = uDecay as unknown as TNode;
      const tt = uTime as unknown as TNode;

      // Parallax the sampling field per depth-slab: rear slabs sample shafts
      // offset along the source direction, so the stack reads as real depth.
      const dirToSrc = src.sub(u);
      const parallax = dirToSrc.mul(aDepth.mul(0.55)); // up to ~0.55 of the way
      const coord0 = u.add(parallax);

      // March from the (parallaxed) fragment toward the source. Step length is
      // scaled by density; each step samples a radial shaft falloff and a soft
      // angular striation so distinct beams emerge, weighted by decay^i.
      const delta = src.sub(coord0).mul(density.mul(f1(1.0 / SAMPLES)));

      let illum = f1(0);
      let shimmer = f1(0);
      let coord = coord0;
      let weight = f1(1);
      let wsum = f1(0.0001);
      for (let i = 0; i < SAMPLES; i++) {
        coord = coord.add(delta);
        // Radial brightness toward the source (a tight glow at the source core).
        const d = coord.sub(src).length();
        const radial = f1(1).sub(d.mul(1.35)).max(0);
        // Angular striation → discrete beams: a high-frequency banding around
        // the source angle gives the shaft structure rather than a flat glow.
        const rel = coord.sub(src);
        const a2 = rel.y.div(rel.x.add(0.0007)); // tan(theta), cheap angle proxy
        // Fewer, softer radial striations + a wider, softer angular floor so the
        // dense centre doesn't moiré. Near the convergence (small radius) the
        // angular term is faded toward a flat glow, killing the aliasing.
        const bandsRaw = a2.mul(5.0).sin().mul(0.5).add(0.5).pow(1.6);
        const centerSoft = d.smoothstep(0.0, 0.22); // 0 at source, 1 outside
        const bands = bandsRaw.mix(f1(1), centerSoft.oneMinus());
        const shaft = radial.mul(bands.mul(0.7).add(0.3));
        illum = illum.add(shaft.mul(weight));
        // Dust shimmer riding the shafts: drifting fbm gated by the shaft mask.
        const dust = fbm(coord.mul(9.0).add(t2(tt.mul(0.25), tt.mul(0.18))));
        shimmer = shimmer.add(dust.mul(shaft).mul(weight));
        wsum = wsum.add(weight);
        weight = weight.mul(decay);
      }
      illum = illum.div(wsum);
      shimmer = shimmer.div(wsum);

      // Pulse the overall intensity so the shafts breathe.
      const pulseNode = (sin((uTime as unknown as ReturnType<typeof float>)) as unknown as TNode)
        .mul(0.16)
        .add(0.9);

      const intensity = uIntensity as unknown as TNode;
      // Combine marched shafts + dust shimmer; raise contrast with a pow so beams
      // separate crisply against the dark bg.
      const beams = illum.clamp(0, 1).pow(1.35);
      const energy = beams
        .add(shimmer.mul(0.6))
        .mul(intensity)
        .mul(pulseNode);

      // Depth-fade: rear slabs fainter and a touch darker → front-to-back
      // occlusion / density falloff reads as a lit volume.
      const depthFade = aDepth.oneMinus().mul(0.7).add(0.3);
      const energyD = energy.mul(depthFade);

      // Warm AMBER palette (R >= G >= B throughout, no green cast): bright amber
      // core → deep orange shoulders. Rear slabs tint slightly warmer-darker for
      // self-shadow, never cooling toward green/blue.
      const warmCore = t3(1.0, 0.85, 0.5);
      const warmEdge = t3(0.78, 0.4, 0.12);
      const tint = warmEdge.mix(warmCore, energyD.clamp(0, 1));
      const depthTint = t3(1, 1, 1).mix(t3(0.74, 0.5, 0.34), aDepth);
      const colorNode = tint.mul(depthTint).mul(energyD) as unknown;

      // Per-slab alpha so the painter-style stack composites: brighter shafts
      // and front slabs are more opaque.
      const alphaNode = energyD.clamp(0, 1).pow(0.85) as unknown;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = alphaNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.godray = { uTime, uIntensity, uDecay, uDensity, uAngle };

      return {
        duration: () => 4,
        seek: (t) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'intensity') uIntensity.value = num(value, 1.2);
          else if (id === 'decay') uDecay.value = num(value, 0.96);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'angleDeg') uAngle.value = num(value, 45) * DEG2RAD;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
