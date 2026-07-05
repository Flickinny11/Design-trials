// liquefy-reveal — the card forms out of a gooey liquefied blob: a metaball
// coverage field of several fixed centers coalesces from melted droplets into
// the solid shape. HARD / GPU primitive (displacement category). Swaps the host
// card panel's material for a MeshStandardNodeMaterial whose opacityNode is a
// summed-metaball goo:
//   d_k = length(uv - center_k); field = Σ (radius / (d_k + eps))  (metaball sum)
//   wobble = sin(uv*scale + uTime) * wobbleAmp * (1 - uProgress)    (liquid feel)
//   goo = smoothstep(threshold, threshold+soft, field + wobble + uProgress*coverGain)
// As uProgress 0->1 the gooey blobs merge to full coverage; the wobble fades to
// zero as the surface settles into the solid shape. seek() advances uProgress
// AND uTime (so a mid frame differs from both t=0 and the settled end).
// DISTINCT from melt (downward drip) / splat-reveal (max-union of growing
// disks): here the field is a SUMMED metaball goo with a time wobble.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, float, sin, length, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// Fixed metaball centers in uv space (0..1). Spread so the goo droplets tile the
// card before merging. Deterministic constants — no randomness.
const CENTERS: ReadonlyArray<[number, number]> = [
  [0.28, 0.34],
  [0.7, 0.3],
  [0.5, 0.5],
  [0.26, 0.72],
  [0.74, 0.74],
];

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.18 },
  { id: 'viscosity', label: 'Viscosity', type: 'knob', min: 0.4, max: 1.6, step: 0.02, default: 0.9 },
] as const;

export const liquefyRevealPrimitive: PrimitiveDefinition = {
  name: 'liquefy-reveal',
  label: 'Liquefy Reveal',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card forms out of a gooey liquefied blob — surface coalescing from melted droplets into the solid shape.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquefy-reveal', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uProgress = uniform(0);
      const uTime = uniform(0);
      const uWobble = uniform(num(params.wobble, 0.18));
      // viscosity drives the smoothstep threshold: higher viscosity = thicker
      // goo that holds together at a higher field value before reading as solid.
      const uThreshold = uniform(num(params.viscosity, 0.9));

      // Summed metaball coverage field. Each blob contributes radius/(d+eps);
      // the sum forms classic gooey metaball isosurfaces that merge as the
      // blobs grow with progress.
      const u = uv();
      const coverGain = float(1.4); // progress bias so the field closes to full.
      const eps = float(0.06);
      const radius = uProgress.mul(0.22).add(0.04);

      // TSL accumulator: annotate as `any` so reassigning the fluent node type
      // (.add) type-checks under strict tsc (the splat-reveal / pool-caustics
      // gotcha — narrow VarNode typing fails otherwise).
      let field: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any
      CENTERS.forEach((c) => {
        const dist: any = length(u.sub(vec2(float(c[0]), float(c[1])))); // eslint-disable-line @typescript-eslint/no-explicit-any
        const contrib: any = radius.div(dist.add(eps)); // eslint-disable-line @typescript-eslint/no-explicit-any
        field = field.add(contrib);
      });

      // Liquid wobble: a sine of the scaled uv driven by time, fading as the
      // surface settles (multiplied by 1 - uProgress).
      const wobble = sin(u.x.mul(11).add(u.y.mul(9)).add(uTime.mul(2)))
        .mul(uWobble)
        .mul(float(1).sub(uProgress));

      // Goo coverage: the summed field plus wobble plus a progress bias, run
      // through a smoothstep whose lower edge is the viscosity threshold and
      // whose soft band coalesces droplets into the solid shape.
      const goo = smoothstep(
        uThreshold,
        uThreshold.add(0.35),
        field.add(wobble).add(uProgress.mul(coverGain)),
      );

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { opacityNode: unknown }).opacityNode = goo;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live progress on shared scratch so the host (and CPU-observable
      // test) can read the animated value without a renderer.
      target.userData.liquefyProgress = uProgress;
      target.userData.liquefyTime = uTime;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const p = dur <= 0 ? 1 : t / dur;
          uProgress.value = p < 0 ? 0 : p > 1 ? 1 : p;
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uWobble.value = num(params.wobble, 0.18);
          uThreshold.value = num(params.viscosity, 0.9);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'wobble') uWobble.value = num(value, 0.18);
          else if (id === 'viscosity') uThreshold.value = num(value, 0.9);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
