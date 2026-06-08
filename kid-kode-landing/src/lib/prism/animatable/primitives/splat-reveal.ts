// splat-reveal — several paint splats burst and merge to reveal the card.
// HARD / GPU primitive (displacement category). Swaps the host card panel's
// material for a MeshBasicNodeMaterial whose opacityNode is a metaball union of
// K (3..5) fixed-position blobs: each blob is smoothstep(uProgress*radius, 0,
// dist) and we take the max over the active set, then sharpen via
// smoothstep(0.5, 0.6, acc + uProgress*0.3). seek() advances uProgress 0->1 to
// full coverage. Blob centers are deterministic constants. DISTINCT from
// paint-spread (a single center blot) — here multiple blobs grow and union.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, length, max, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// Five deterministic blob centers in uv space (0..1). The active count picks a
// prefix of these. Spread out so they tile the card before merging.
const CENTERS: ReadonlyArray<[number, number]> = [
  [0.3, 0.32],
  [0.72, 0.4],
  [0.5, 0.7],
  [0.22, 0.74],
  [0.8, 0.78],
];

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  {
    id: 'blobs',
    label: 'Blobs',
    type: 'dropdown',
    options: [
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5', label: '5' },
    ],
    default: '4',
  },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.2, max: 0.6, step: 0.01, default: 0.4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5d8bff' },
] as const;

const activeCount = (v: ControlValue | undefined): number => {
  const n = parseInt(str(v, '4'), 10);
  return n >= 3 && n <= 5 ? n : 4;
};

export const splatRevealPrimitive: PrimitiveDefinition = {
  name: 'splat-reveal',
  label: 'Splat Reveal',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Several paint splats burst and merge to reveal the card — multiple deterministic blobs growing and unioning into full coverage.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'splat-reveal', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5d8bff'));

      const uProgress = uniform(0);
      const uSpread = uniform(num(params.spread, 0.4));
      // Per-blob active multiplier (1 = on, 0 = off). Lets the dropdown change
      // the union live without rebuilding the node graph.
      const uActive: ReturnType<typeof uniform>[] = CENTERS.map((_, i) =>
        uniform(i < activeCount(params.blobs) ? 1 : 0),
      );
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Metaball union: acc = max_k active_k * smoothstep(progress*spread, 0, dist_k)
      // smoothstep(edge0, edge1, x) with edge0 > edge1 gives 1 at the center
      // (x small) falling to 0 at the blob radius (x >= progress*spread).
      const u = uv();
      // TSL intermediate-node type (mirrors foam.ts / clouds.ts) — sidesteps the
      // narrow fluent return types so reassigning the accumulator type-checks.
      type TNode = any;
      let acc: TNode = float(0);
      CENTERS.forEach((c, i) => {
        const dist: TNode = length(u.sub(vec2(float(c[0]), float(c[1]))));
        const radius: TNode = uProgress.mul(uSpread);
        const sm: TNode = smoothstep(radius, float(0), dist);
        const blob: TNode = sm.mul(uActive[i]);
        acc = max(acc, blob);
      });
      // Sharpen + bias by progress so the union closes to full coverage by p=1.
      const coverage = smoothstep(float(0.5), float(0.6), acc.add(uProgress.mul(0.3)));

      const colorNode = vec3(uR, uG, uB);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = coverage;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live progress uniform on shared scratch so the host (and the
      // CPU-observable test) can read the animated value without a renderer.
      target.userData.splatProgress = uProgress;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const p = dur <= 0 ? 1 : t / dur;
          uProgress.value = p < 0 ? 0 : p > 1 ? 1 : p;
          // Read params live so control changes apply without a rebuild.
          uSpread.value = num(params.spread, 0.4);
          const n = activeCount(params.blobs);
          for (let i = 0; i < CENTERS.length; i++) uActive[i].value = i < n ? 1 : 0;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'spread') uSpread.value = num(value, 0.4);
          else if (id === 'blobs') {
            const n = activeCount(value);
            for (let i = 0; i < CENTERS.length; i++) uActive[i].value = i < n ? 1 : 0;
          } else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
