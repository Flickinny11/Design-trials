// ink-spread — a drop of ink blooms across the plane, an organic stain growing
// from the center. HARD / GPU primitive (wave category). Swaps the host plane's
// material for a MeshBasicNodeMaterial (transparent); opacityNode is a smoothstep
// around a growing radius uniform (uRadius, advanced 0 -> ~0.95 over an eased
// phase in seek) of length(uv-0.5), perturbed by a uv-hash fbm noise term so the
// edge is ragged/organic. colorNode is the tint. seek() advances uRadius;
// onParamChange() updates the live uniforms. uRadius.value is stashed on
// target.userData as an observable.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, length, smoothstep, sin, dot, fract } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 6, step: 0.1, default: 2.2, unit: 's' },
  { id: 'edgeNoise', label: 'Edge Noise', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#10131c' },
] as const;

export const inkSpreadPrimitive: PrimitiveDefinition = {
  name: 'ink-spread',
  label: 'Ink Spread',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A drop of ink blooms across the surface, an organic stain growing from the center.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-spread', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#10131c'));

      const uRadius = uniform(0); // grows 0 -> ~0.95 across the eased phase
      const uNoise = uniform(num(params.edgeNoise, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Observable handle: stash the live radius value on shared userData so the
      // host (and CPU tests) can read the animation's progress.
      target.userData.inkRadius = 0;

      // Centered uv -> distance from the drop origin.
      const u = uv();
      const centered = vec2(u.x.sub(0.5), u.y.sub(0.5));
      const d = length(centered);

      // Cheap sin-based fbm hash on the uv to ragged the stain edge. Two octaves
      // of a hash(dot(uv, k)) term so the growing boundary is organic, not a
      // perfect circle. Scaled by uNoise (the edgeNoise knob).
      const hash = (p: unknown) =>
        fract(sin(dot(p as never, vec2(12.9898, 78.233))).mul(43758.5453));
      const n1 = hash(u.mul(7.0));
      const n2 = hash(u.mul(17.0).add(vec2(3.1, 1.7)));
      const fbm = n1.mul(0.65).add(n2.mul(0.35)).sub(0.5); // ~[-0.5, 0.5]
      const raggedD = d.add(fbm.mul(uNoise).mul(0.22));

      // Stain coverage: 1 inside the growing radius, fading out over a soft band
      // at the boundary. smoothstep(radius, radius-band, raggedD) -> opaque core,
      // transparent beyond the ragged front.
      const band = float(0.06);
      const inner = uRadius.sub(band);
      const coverage = smoothstep(uRadius, inner, raggedD);

      const colorNode = vec3(uR, uG, uB);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = coverage;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const dur = () => num(params.duration, 2.2);

      const apply = (t: number) => {
        // Eased phase 0->1; radius blooms to ~0.95 (covers the centered plane's
        // corner-distance of ~0.707, so the stain fully fills before settling).
        const p = ease('easeOut' as EaseName, phase(t, dur()));
        const radius = p * 0.95;
        uRadius.value = radius;
        uNoise.value = clamp(num(params.edgeNoise, 0.5), 0, 1);
        target.userData.inkRadius = radius;
      };

      return {
        duration: dur,
        seek: (tt) => apply(tt),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'edgeNoise') uNoise.value = clamp(num(value, 0.5), 0, 1);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          target.userData.inkRadius = 0;
        },
      };
    },
  ),
};
