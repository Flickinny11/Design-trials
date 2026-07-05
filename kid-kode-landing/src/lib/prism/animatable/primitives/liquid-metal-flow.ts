// liquid-metal-flow — a flowing chrome reflection ripples across the card
// surface like molten mercury. HARD / GPU / shimmer primitive. Swaps the card
// panel's material for a MeshStandardNodeMaterial whose colorNode builds a
// faux-reflection from flowing fbm noise: bright highlight bands smear and
// merge, mixing a dark metal base toward a bright metal tint by the reflection
// value, plus a subtle hue shimmer. seek() advances a uTime uniform; params are
// read live (and mirrored to onParamChange) so control tweaks apply with no
// rebuild. DISTINCT from holographic foil (rainbow) — this is chrome/mercury.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  fract,
  floor,
  mix,
  smoothstep,
  dot,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'flow', label: 'Flow', type: 'knob', min: 0, max: 3, step: 0.05, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
  { id: 'contrast', label: 'Contrast', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1 },
  { id: 'base', label: 'Base', type: 'color', default: '#0c0e14' },
  { id: 'metal', label: 'Metal', type: 'color', default: '#e8eef7' },
] as const;

export const liquidMetalFlowPrimitive: PrimitiveDefinition = {
  name: 'liquid-metal-flow',
  label: 'Liquid Metal',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A flowing chrome reflection ripples across the surface like molten mercury, bright highlights smearing and merging.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquid-metal-flow', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [br0, bg0, bb0] = rgb(str(params.base, '#0c0e14'));
      const [mr0, mg0, mb0] = rgb(str(params.metal, '#e8eef7'));

      const uTime = uniform(0);
      const uFlow = uniform(num(params.flow, 1));
      const uScale = uniform(num(params.scale, 4));
      const uContrast = uniform(num(params.contrast, 1));
      const uBase = uniform(vec3(br0, bg0, bb0));
      const uMetal = uniform(vec3(mr0, mg0, mb0));

      // Expose live uniforms so headless tests / inspectors can observe motion
      // and control changes (no GPU needed — we read uniform .value on CPU).
      target.userData.uTime = uTime;
      target.userData.uFlow = uFlow;
      target.userData.uScale = uScale;
      target.userData.uContrast = uContrast;

      // ── faux-reflection: fbm over flowing noise ──────────────────────────
      // Deterministic value-noise hash (no Math.random in the shader graph).
      const hash = (p: any) =>
        fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

      const vnoise = (p: any) => {
        const i = floor(p);
        const f = fract(p);
        const u: any = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = mix(a, b, u.x);
        const x2 = mix(c, d, u.x);
        return mix(x1, x2, u.y);
      };

      const u = uv();
      const t = uTime.mul(uFlow);
      // Flow direction: strong drift in x, gentle in y (mercury smearing).
      const flowOff = vec2(t, uTime.mul(0.3));
      const base = u.mul(uScale).add(flowOff);

      // fbm: 3 octaves of value-noise (typed as any — fluent TSL accumulator).
      let f: any = float(0);
      f = f.add(vnoise(base).mul(0.5));
      f = f.add(vnoise(base.mul(2).add(vec2(5.2, 1.3).mul(t))).mul(0.25));
      f = f.add(vnoise(base.mul(4).sub(vec2(1.7, 9.2))).mul(0.125));

      // Banded chrome highlights: a broad sheet + a tight bright filament.
      // contrast sharpens the highlight edges.
      const c0 = float(0.4);
      const c1 = float(0.7);
      const broad = smoothstep(c0, c1, f);
      const tight = smoothstep(float(0.75), float(0.9), f).mul(1.5);
      const reflection: any = broad.add(tight).mul(uContrast);

      // Mix dark metal base -> bright metal tint by reflection.
      let col: any = mix(uBase, uMetal, reflection.clamp(0, 1));
      // Subtle hue shimmer: tint the highlight with a slow cool/warm sweep.
      const shimmer = sin(f.mul(6.28).add(uTime.mul(0.8))).mul(0.5).add(0.5);
      const hueTint = vec3(
        float(0.9).add(shimmer.mul(0.1)),
        float(0.95),
        float(0.9).add(cos(uTime.mul(0.6)).mul(0.1)),
      );
      col = col.mul(mix(vec3(1, 1, 1), hueTint, broad.mul(0.6)));

      const mat = new MeshStandardNodeMaterial({
        metalness: 0.9,
        roughness: 0.25,
        transparent: true,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = col;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = uMetal.mul(
        tight.mul(0.4),
      );

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity, // continuous flowing loop
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uFlow.value = num(params.flow, 1);
          uScale.value = num(params.scale, 4);
          uContrast.value = num(params.contrast, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'flow') uFlow.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'contrast') uContrast.value = num(value, 1);
          else if (id === 'base' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            (uBase.value as unknown as { set: (r: number, g: number, b: number) => void }).set(r, g, b);
          } else if (id === 'metal' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            (uMetal.value as unknown as { set: (r: number, g: number, b: number) => void }).set(r, g, b);
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.uTime;
          delete target.userData.uFlow;
          delete target.userData.uScale;
          delete target.userData.uContrast;
          mat.dispose();
        },
      };
    },
  ),
};
