// supernova — a star detonates: a blinding core flash expands into a shock
// shell of light and debris, then fades to a glowing remnant. Looping.
// HARD / GPU volumetric primitive. With volumetric:true the host builds the
// plane as a back-to-front stack of 5 coplanar slabs (per-vertex `aDepth` 0 →
// 1, front → back). We read aDepth to spread the detonation through real depth:
// a bright hot core sits on the FRONT slab, an expanding coloured shock shell
// sweeps slab-by-slab with a depth-staggered radius, and the rearmost slabs
// carry a depth-faded outer plume — so the burst reads as a true expanding
// volume (front-to-back occlusion + density falloff) instead of a flat orb.
//
// Swaps the host plane's material for a MeshBasicNodeMaterial whose
// colorNode/opacityNode are driven by a looping phase lt = fract(uTime*novaRate)
// plus aDepth, composited additively (energy). seek() advances uTime; params are
// read live so control changes apply without a rebuild.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and the radial / shell helpers pass nodes through expressions the
// strict overloads of the free TSL functions reject. Like nebula.ts /
// fireball-burst.ts cast their node assignments, we work through a single
// permissive chainable node alias (method-chaining only, which every TSL node
// supports) so the helpers compose without fighting the inferred VarNode
// generics. The graph this builds is identical to the equivalent free-function
// form. (tsc strictness — matches the references.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  cos: () => TNode;
  abs: () => TNode;
  exp: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  length: () => TNode;
  pow: (e: number) => TNode;
  oneMinus: () => TNode;
  atan: (x: TNode) => TNode;
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
  volumetric: true,
  description:
    'A star detonates — a blinding core flash expanding into a shock shell of light and debris, fading to a glowing remnant. Looping volumetric burst.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'supernova', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRate = uniform(num(params.novaRate, 0.4));
      const uMaxR = uniform(num(params.maxR, 0.7));
      const uRays = uniform(num(params.rays, 0.6));

      // Per-vertex depth: 0.0 on the front (camera-facing) slab → 1.0 on the
      // rearmost slab. Constant within each of the 5 slabs.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // Looping detonation phase 0..1.
      const lt = (uTime as unknown as TNode).mul(uRate as unknown as TNode).fract();

      // Radius + angle from the plane center.
      const u = uv() as unknown as TNode;
      const p = t2(u.x.sub(0.5), u.y.sub(0.5));
      // Per-slab parallax: rear slabs swirl the field a touch so the volume does
      // not read as 5 identical copies — a depth-staggered rotation of the field.
      const swirl = aDepth.mul(0.55);
      const pr = t2(
        p.x.mul(swirl.cos()).sub(p.y.mul(swirl.sin())),
        p.x.mul(swirl.sin()).add(p.y.mul(swirl.cos())),
      );
      const r = pr.length();
      const ang = pr.y.atan(pr.x);

      // Depth front-to-back falloff: rearmost slabs fainter (self-shadow /
      // density) and slightly cooler so the stack reads as a lit volume. Floor
      // raised to >= 0.45 so the rear of the burst isn't near-black.
      const depthFade = aDepth.oneMinus().mul(0.55).add(0.45);

      // Blinding core flash on the FRONT of the stack: a sharp exponential spike
      // that decays over the first quarter of the loop. Concentrated near the
      // front slab (aDepth→0) so the hot core sits in front of the shell.
      const frontBias = aDepth.mul(-3.2).exp(); // 1 at front, ~0.04 at back
      // Wider, brighter core spike so the burst clearly reads at tile size.
      const flashCore = r.mul(-120).exp().mul(lt.mul(4).oneMinus().max(0)).mul(1.6);
      const flash = flashCore.mul(frontBias);

      // Expanding shock shell: a thin annulus whose radius grows with lt. Each
      // slab gets a depth-staggered radius so the shell genuinely sweeps THROUGH
      // depth (rear slabs lag), giving the burst real thickness. Fades as the
      // loop progresses (1 - lt).
      const edge = f1(0.045);
      const shellW = f1(0.18);
      const slabPhase = lt.add(aDepth.mul(0.14)); // rear slabs trail in time
      const ringR = slabPhase.mul(uMaxR as unknown as TNode);
      const outer = r.smoothstep(ringR, ringR.sub(edge));
      const inner = r.smoothstep(ringR.sub(shellW), ringR);
      // Brightened so the expanding shock shell clearly reads.
      const shell = outer.mul(inner).mul(lt.oneMinus()).mul(depthFade).mul(1.7);

      // Outer plume: a soft depth-faded haze trailing the shock — strongest on
      // the rear slabs (aDepth→1), so the volume has a glowing wake behind the
      // bright shell rather than a hard edge.
      const plume = ringR
        .smoothstep(ringR.add(shellW.mul(1.6)), ringR.sub(shellW.mul(0.4)))
        .mul(r.smoothstep(uMaxR as unknown as TNode, 0.0))
        .mul(aDepth.mul(0.6).add(0.1))
        .mul(lt.oneMinus())
        .mul(0.55);

      // Anisotropic rays: cosine streaks in angle, brightest at the core, fading
      // with the loop. Scaled by the rays control. Mostly on the front slabs so
      // the spikes read crisp in front of the volume.
      const streakRaw = ang.mul(6.0).cos();
      const streak = streakRaw.mul(streakRaw.abs()).max(0);
      const rayFall = r.mul(-6.0).exp();
      const rays = streak
        .mul(rayFall)
        .mul(uRays as unknown as TNode)
        .mul(lt.oneMinus())
        .mul(frontBias.mul(0.7).add(0.3));

      // Combined emission for opacity.
      const bright = flash.max(shell).max(rays).max(plume);

      // Palette: white-hot/blue core -> orange/red shock shell -> violet plume,
      // blended by radius and loop progress so the detonation cools as it
      // expands. Rear slabs tint a touch cooler/darker for depth.
      const hotWhite = t3(1.0, 1.0, 1.0);
      const hotBlue = t3(0.55, 0.72, 1.0);
      const orange = t3(1.0, 0.46, 0.12);
      const red = t3(0.85, 0.12, 0.06);
      const violet = t3(0.45, 0.22, 0.78);

      // Core: white→blue. Shell: orange→red. Plume: violet. Mix by radius & time.
      const coolByR = r.smoothstep(0.0, uMaxR as unknown as TNode);
      const coolByT = lt;
      const cool = coolByR.max(coolByT);
      const coreCol = hotWhite.mix(hotBlue, frontBias.oneMinus());
      const shellCol = orange.mix(red, cool);
      const innerCol = coreCol.mix(shellCol, cool);
      const palette = innerCol.mix(violet, aDepth.mul(cool).smoothstep(0.4, 1.0).mul(0.6));

      // Overall energy lift so the detonation reads bright on the dark bg
      // without the rear slabs going near-black (depthFade floor handles depth).
      const colorNode = palette.mul(bright).mul(depthFade.mul(0.3).add(0.7)).mul(1.35);
      const opacityNode = bright.mul(depthFade).mul(1.2).max(0);

      // Additive blending reads as energy; slabs are emitted far-first so the
      // additive accumulation composites front-to-back correctly. depthWrite
      // off so the 5 coplanar slabs all contribute.
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
