// dissolve-noise — the card materializes by a per-fragment noise threshold
// sweeping its alpha from 0 to full. MEDIUM / fade primitive. Swaps the host
// card's material for a MeshStandardNodeMaterial whose opacityNode compares a
// uv-noise field against a uThreshold uniform via smoothstep. seek() advances
// uThreshold from 0 -> 1 over the eased phase so fragments emerge in noise
// order; onParamChange() / live reads update the soft edge + noise scale.
//
// Observable on CPU (headless): uThreshold.value changes monotonically across
// seek (asserted by the test). Restores the previous material in dispose.

import { Mesh, type Material } from 'three';
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
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'noiseScale', label: 'Noise Scale', type: 'knob', min: 2, max: 40, step: 0.5, default: 12 },
  { id: 'edge', label: 'Edge Softness', type: 'knob', min: 0.02, max: 0.6, step: 0.01, default: 0.18 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
  },
] as const;

export const dissolveNoisePrimitive: PrimitiveDefinition = {
  name: 'dissolve-noise',
  label: 'Noise Dissolve',
  category: 'fade',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card materializes by a per-fragment noise threshold sweeping its alpha from 0 to full.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dissolve-noise', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uThreshold = uniform(0);
      const uScale = uniform(num(params.noiseScale, 12));
      const uEdge = uniform(num(params.edge, 0.18));

      // Value-noise (hash-based) field over the scaled uv. Deterministic, no
      // textures: hash each lattice corner and bilinearly interpolate, giving a
      // smoothly varying 0..1 field whose iso-contours the threshold sweeps
      // through — fragments emerge in noise order rather than as a hard wipe.
      const p = uv().mul(uScale);
      const i = floor(p);
      const f = fract(p);
      const w = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights

      // Cast lattice coords to dodge strict TSL Var/Join typing (mirrors the
      // node-assignment casts in caustics.ts).
      type V2 = ReturnType<typeof vec2>;
      const hash = (g: V2) => fract(sin(dot(g, vec2(127.1, 311.7))).mul(43758.5453));

      const a = hash(i as unknown as V2);
      const b = hash(i.add(vec2(1, 0)) as unknown as V2);
      const c = hash(i.add(vec2(0, 1)) as unknown as V2);
      const d = hash(i.add(vec2(1, 1)) as unknown as V2);

      const noise = mix(mix(a, b, w.x), mix(c, d, w.x), w.y);

      // Soft alpha edge: as uThreshold sweeps 0->1 the smoothstep band crosses
      // the whole noise range, revealing the fragment once threshold exceeds its
      // noise value (plus a soft uEdge falloff).
      const lo = uThreshold.sub(uEdge);
      const hi = uThreshold.add(uEdge);
      const opacityNode = smoothstep(lo, hi, noise.oneMinus());

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      // Brighter base + a self-lit emissive so the dissolve front reads with
      // punch at tile size even before scene lights land. A standard material at
      // the old dark navy went near-black on the #06070d bg; lift the albedo and
      // add a cool emissive tied to the same opacityNode so the EMERGING edge
      // glows — the dissolve front stays legible across the whole timeline.
      mat.color.set('#33457f');
      mat.roughness = 0.3;
      mat.metalness = 0.4;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = vec3(0.16, 0.3, 0.62).mul(
        opacityNode,
      );
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the threshold uniform on shared scratch space (contract: userData
      // is host/primitive shared) so the host (and tests) can observe the sweep
      // — the look itself lives entirely in the GPU opacityNode.
      target.userData.uThreshold = uThreshold;

      const curveName = (): EaseName =>
        (typeof params.curve === 'string' ? params.curve : 'easeInOut') as EaseName;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const ph = dur <= 0 ? 1 : Math.min(Math.max(t / dur, 0), 1);
          uThreshold.value = ease(curveName(), ph);
          // Live reads so control changes apply without a rebuild.
          uScale.value = num(params.noiseScale, 12);
          uEdge.value = num(params.edge, 0.18);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'noiseScale') uScale.value = num(value, 12);
          else if (id === 'edge') uEdge.value = num(value, 0.18);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
