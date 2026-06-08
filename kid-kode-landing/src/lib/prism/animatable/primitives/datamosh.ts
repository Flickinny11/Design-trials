// datamosh — the card glitches in through datamosh block-smearing. The card's
// material is swapped for a MeshStandardNodeMaterial whose colorNode samples a
// procedural grid/gradient at uv + a deterministic per-block shift. The shift is
// hash(block) * smear * (1 - easeOut(phase)): blocks are displaced hard early
// and snap to 0 as the animation settles, so the smear reads as rectangular
// regions bleeding then snapping clean. opacityNode reveals the card via
// uProgress. seek() advances both phase and progress uniforms; params are read
// live so control tweaks apply on the next seek with no rebuild.
//
// HARD / displacement primitive. Distinct from glitch-displace (CPU jitter) and
// pixel-dissolve — this is block-smear datamosh entirely in TSL.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  floor,
  fract,
  sin,
  dot,
  mix,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'blocks', label: 'Blocks', type: 'knob', min: 4, max: 24, step: 1, default: 12 },
  { id: 'smear', label: 'Smear', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.22 },
] as const;

/** easeOut(t) = 1 - (1-t)^2, mirrors easing.ts' easeOut for CPU-side checks. */
const easeOutCpu = (t: number): number => {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
};

export const datamoshPrimitive: PrimitiveDefinition = {
  name: 'datamosh',
  label: 'Datamosh',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card glitches in through datamosh block-smearing — rectangular regions shift and bleed before snapping clean.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'datamosh', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const dur = () => num(params.duration, 1.4);

      // Live uniforms driven from seek().
      const uProgress = uniform(0); // 0..1 reveal
      const uMosh = uniform(1); // (1 - easeOut(phase)): 1 early -> 0 settled
      const uBlocks = uniform(num(params.blocks, 12));
      const uSmear = uniform(num(params.smear, 0.22));

      // ── Block-smear datamosh in TSL ─────────────────────────────────────
      const u = uv();

      // Deterministic per-block hash in [0,1) via the classic sin-dot hash.
      const block = floor(u.mul(uBlocks)).div(uBlocks); // top-left uv of the block
      const h = fract(sin(dot(block, vec2(12.9898, 78.233))).mul(43758.5453));
      const h2 = fract(sin(dot(block, vec2(39.346, 11.135))).mul(24634.6345));

      // Per-block shift: signed, scaled by smear and the decaying mosh amount.
      // (h*2-1) maps the hash to [-1,1] so blocks smear both directions.
      const shift = vec2(h.mul(2).sub(1), h2.mul(2).sub(1)).mul(uSmear).mul(uMosh);
      const sUv = u.add(shift);

      // Procedural grid/gradient sampled at the shifted uv so the smear is
      // visible: a soft diagonal gradient crossed with a fine grid of bright
      // seams. Sampling at sUv makes displaced blocks pull a wrong slice of the
      // pattern, reading as the classic datamosh bleed.
      const grad = sUv.x.add(sUv.y).mul(0.5); // 0..1-ish diagonal gradient
      const gx = smoothstep(float(0.92), float(1.0), fract(sUv.x.mul(uBlocks)));
      const gy = smoothstep(float(0.92), float(1.0), fract(sUv.y.mul(uBlocks)));
      const seam = gx.add(gy);

      const baseCol = mix(vec3(0.06, 0.1, 0.26), vec3(0.36, 0.55, 1.0), grad);
      const seamCol = vec3(0.7, 0.85, 1.0).mul(seam);
      const colorNode = baseCol.add(seamCol);

      // Reveal: fully transparent at progress 0, opaque once settled. The mosh
      // term keeps a flicker of extra transparency on heavily-shifted blocks
      // early on so the smear visibly "tears" before snapping clean.
      const reveal = smoothstep(float(0.0), float(0.85), uProgress);
      const tear = float(1.0).sub(h.mul(uMosh).mul(0.6));
      const opacityNode = reveal.mul(tear);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on the shared scratch space so the host
      // (and conformance/CPU tests) can observe drive state without a GPU.
      (target.userData as Record<string, unknown>).datamosh = {
        uProgress,
        uMosh,
        uBlocks,
        uSmear,
      };

      return {
        duration: dur,
        seek: (t) => {
          const p = dur() <= 0 ? 1 : clamp(t / dur(), 0, 1);
          uProgress.value = p;
          uMosh.value = 1 - easeOutCpu(p);
          // Read params live so control changes apply without a rebuild.
          uBlocks.value = num(params.blocks, 12);
          uSmear.value = num(params.smear, 0.22);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'blocks') uBlocks.value = num(value, 12);
          else if (id === 'smear') uSmear.value = num(value, 0.22);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
