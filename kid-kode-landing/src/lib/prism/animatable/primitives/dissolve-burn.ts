// dissolve-burn — the card burns away (or in) along a glowing ember edge. HARD /
// displacement primitive. Swaps the host card's material for a MeshStandard-
// NodeMaterial: a value-noise field over the scaled uv is thresholded by a
// uThreshold uniform (step) so fragments wink out as the threshold rises, while
// an emissiveNode adds a hot ember rim — emberColor * smoothstep around the burn
// front — so the dissolving edge glows. seek() sweeps uThreshold (0->1 to burn
// away, 1->0 to burn in per `direction`).
//
// DISTINCT from dissolve-noise (soft alpha smoothstep, NO ember rim) and from
// any blocky pixel-dissolve (this is a continuous noise threshold with a glowing
// emissive front). Observable on CPU (headless): uThreshold.value changes
// monotonically across seek and reverses with `direction`. Restores prevMat in
// dispose; the look lives entirely in the GPU opacity/emissive nodes.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  float,
  sin,
  dot,
  vec2,
  vec3,
  fract,
  floor,
  mix,
  step,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'scale', label: 'Noise Scale', type: 'knob', min: 2, max: 14, step: 0.1, default: 7 },
  { id: 'rim', label: 'Ember Rim', type: 'knob', min: 0.02, max: 0.4, step: 0.01, default: 0.14 },
  { id: 'ember', label: 'Ember', type: 'color', default: '#ff6a1a' },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    default: 'burn-out',
    options: [
      { value: 'burn-out', label: 'Burn Out' },
      { value: 'burn-in', label: 'Burn In' },
    ],
  },
] as const;

export const dissolveBurnPrimitive: PrimitiveDefinition = {
  name: 'dissolve-burn',
  label: 'Burn Dissolve',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card burns away (or in) along a glowing ember edge — a noise threshold eats the alpha with a hot emissive rim at the burn front.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dissolve-burn', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [er0, eg0, eb0] = rgb(str(params.ember, '#ff6a1a'));

      const uThreshold = uniform(0);
      const uScale = uniform(num(params.scale, 7));
      const uRim = uniform(num(params.rim, 0.14));
      const uER = uniform(er0);
      const uEG = uniform(eg0);
      const uEB = uniform(eb0);

      // Value-noise (hash-based) field over the scaled uv. Deterministic, no
      // textures: hash each lattice corner and bilinearly interpolate, giving a
      // smoothly varying 0..1 field whose iso-contours the threshold sweeps
      // through — fragments burn off in noise order rather than as a hard wipe.
      const p = uv().mul(uScale);
      const i = floor(p);
      const f = fract(p);
      const w = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights

      // Cast lattice coords to dodge strict TSL Var/Join typing (mirrors the
      // node-assignment casts in caustics.ts / dissolve-noise.ts).
      type V2 = ReturnType<typeof vec2>;
      const hash = (g: V2) => fract(sin(dot(g, vec2(127.1, 311.7))).mul(43758.5453));

      const a = hash(i as unknown as V2);
      const b = hash(i.add(vec2(1, 0)) as unknown as V2);
      const c = hash(i.add(vec2(0, 1)) as unknown as V2);
      const d = hash(i.add(vec2(1, 1)) as unknown as V2);

      const noise = mix(mix(a, b, w.x), mix(c, d, w.x), w.y);

      // Alpha: a fragment survives while its noise value is ABOVE the threshold.
      // As uThreshold rises 0->1 the burn front eats the card; step gives the
      // hard charred edge characteristic of a burn (no soft alpha falloff).
      const opacityNode = step(uThreshold, noise);

      // Ember rim: a hot band trailing the burn front. smoothstep peaks where the
      // noise value is just above the threshold (within uRim) and falls to 0
      // deeper into the still-solid region — emberColor * that band glows along
      // the dissolving edge.
      const front = float(1).sub(
        smoothstep(uThreshold, uThreshold.add(uRim), noise),
      );
      const emissiveNode = vec3(uER, uEG, uEB).mul(front.mul(step(uThreshold, noise)));

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.set('#1b2444');
      mat.roughness = 0.34;
      mat.metalness = 0.4;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the threshold uniform on shared scratch space (host/primitive
      // shared per contract) so the host (and tests) can observe the sweep.
      target.userData.uThreshold = uThreshold;

      const isBurnIn = (): boolean => str(params.direction, 'burn-out') === 'burn-in';

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const ph = dur <= 0 ? 1 : Math.min(Math.max(t / dur, 0), 1);
          // burn-out: threshold 0 -> 1 (card eaten away). burn-in: 1 -> 0 (card
          // materializes as the front recedes).
          uThreshold.value = isBurnIn() ? 1 - ph : ph;
          // Live reads so control changes apply without a rebuild.
          uScale.value = num(params.scale, 7);
          uRim.value = num(params.rim, 0.14);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 7);
          else if (id === 'rim') uRim.value = num(value, 0.14);
          else if (id === 'ember' && typeof value === 'string') {
            const [r, g, bl] = rgb(value);
            uER.value = r;
            uEG.value = g;
            uEB.value = bl;
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
