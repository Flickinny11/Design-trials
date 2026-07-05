// moonstone-sheen — a soft blue adularescence floats over the surface like
// moonstone: a milky, low-contrast glow that drifts as if lit from within.
// HARD / GPU primitive (category 'shimmer'). Swaps the host card panel's
// material for a MeshStandardNodeMaterial whose colorNode mixes a pale milky
// base toward an adularescent blue-white by a single soft glow blob. The blob
// is positioned by sin/cos of a slowly-advanced time uniform, so the sheen
// floats across the surface. seek() advances uTime slowly; onParamChange()
// updates the live uniforms. DISTINCT from pearlescent (which sweeps a pastel
// hue band): this is one floating blue glow, kept milky and low-contrast.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, length, sin, cos, smoothstep, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0.05, max: 1.2, step: 0.05, default: 0.35 },
  { id: 'intensity', label: 'Intensity', type: 'fader', min: 0, max: 1, step: 0.02, default: 0.6 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9fc6ff' },
] as const;

export const moonstoneSheenPrimitive: PrimitiveDefinition = {
  name: 'moonstone-sheen',
  label: 'Moonstone',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A soft blue adularescence floats over the surface like moonstone — a milky glow that shifts as if lit from within.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'moonstone-sheen', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [tr, tg, tb] = rgb(str(params.tint, '#9fc6ff'));

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.35));
      const uIntensity = uniform(num(params.intensity, 0.6));
      // Adularescent blue-white tint the glow mixes toward.
      const uTintR = uniform(tr);
      const uTintG = uniform(tg);
      const uTintB = uniform(tb);

      // A pale, milky base — low-contrast, premium. Slightly cool off-white.
      const baseColor = vec3(0.78, 0.82, 0.9);

      // The glow blob drifts across the surface: its center orbits a small
      // ellipse driven by the slowly-advanced time uniform.
      const u = uv();
      const cx = sin(uTime.mul(uDrift)).mul(0.2);
      const cy = cos(uTime.mul(uDrift).mul(0.7)).mul(0.2);
      const center = vec2(cx, cy).add(vec2(0.5, 0.5));
      const d = length(u.sub(center));
      // Soft bright blob: bright at the center, fading out by radius 0.5.
      const glow = smoothstep(0.5, 0.0, d).mul(uIntensity);

      // Mix the milky base toward the adularescent blue-white by the glow.
      const adular = vec3(uTintR, uTintG, uTintB);
      const colorNode = mix(baseColor, adular, glow);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      // Keep it milky: low roughness variation, soft metallic so it reads premium.
      (mat as unknown as { roughness: number }).roughness = 0.35;
      (mat as unknown as { metalness: number }).metalness = 0.2;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles on the shared scratch space so the host
      // (and conformance tests) can observe the animated state on the CPU.
      target.userData.moonstoneUniforms = {
        time: uTime,
        drift: uDrift,
        intensity: uIntensity,
      };

      return {
        // Stateful, looping sheen — never settles, plays continuously.
        duration: () => Infinity,
        seek: (tt) => {
          // Advance slowly — moonstone adularescence floats lazily.
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.35);
          uIntensity.value = num(params.intensity, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.35);
          else if (id === 'intensity') uIntensity.value = num(value, 0.6);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uTintR.value = r;
            uTintG.value = g;
            uTintB.value = b;
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
