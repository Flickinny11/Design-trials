// tilt-shift-pulse — a miniature-faking tilt-shift band. HARD / GPU primitive.
// Swaps the host card's material for a MeshStandardNodeMaterial whose colorNode
// keeps a central horizontal band sharp while the top and bottom defocus. The
// defocus is faked by mixing the base color toward a desaturated/dimmed version,
// weighted by a smoothstep band mask times a breathing factor (0.5+0.5*sin) so
// the out-of-focus regions pulse in and out of focus on a loop. seek() advances
// the time uniform; the band strength breathes continuously (duration Infinity).

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  abs,
  smoothstep,
  mix,
  sin,
  float,
  vec3,
  dot,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  // Half-height of the sharp central band (small => thin focused strip).
  { id: 'focusHeight', label: 'Focus Height', type: 'fader', min: 0.05, max: 0.5, step: 0.01, default: 0.16 },
  // How softly the band falls off into the defocused regions.
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0.02, max: 0.5, step: 0.01, default: 0.22 },
  // Breathing speed of the defocus pulse.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.2 },
  // Base tint of the card surface.
  { id: 'tint', label: 'Tint', type: 'color', default: '#23304f' },
] as const;

export const tiltShiftPulsePrimitive: PrimitiveDefinition = {
  name: 'tilt-shift-pulse',
  label: 'Tilt Shift',
  category: 'blur',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A miniature-faking tilt-shift band keeps the center sharp while the top and bottom breathe in and out of focus — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'tilt-shift-pulse', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#23304f'));

      const uTime = uniform(0);
      const uFocusHalf = uniform(num(params.focusHeight, 0.16));
      const uFalloff = uniform(num(params.falloff, 0.22));
      const uSpeed = uniform(num(params.speed, 1.2));
      // CPU-observable breathing strength (0..1), updated each seek so tests can
      // read the band's pulse without a GPU.
      const uBreath = uniform(0);
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      const base = vec3(uR, uG, uB);

      // Band mask: 0 at the sharp center, ramps to 1 in the defocused top/bottom.
      const u = uv();
      const distFromCenter = abs(u.y.sub(float(0.5)));
      const blurBand = smoothstep(uFocusHalf, uFocusHalf.add(uFalloff), distFromCenter);

      // Defocus look: desaturate (toward luminance) and dim the base color.
      const lum = dot(base, vec3(float(0.2126), float(0.7152), float(0.0722)));
      const desat = mix(base, vec3(lum, lum, lum), float(0.85)).mul(float(0.55));

      // Breathing factor: the out-of-focus regions pulse in and out of focus.
      const breath = sin(uTime.mul(uSpeed)).mul(float(0.5)).add(float(0.5));
      const weight = blurBand.mul(breath);

      // Mix base (sharp) toward the dim/desaturated version weighted by the band.
      const colorNode = mix(base, desat, weight);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      // Emissive also breathes the band so the miniature look reads under lights.
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = mix(
        base.mul(float(0.35)),
        vec3(float(0), float(0), float(0)),
        weight,
      );

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniforms on shared scratch so the host/controls (and tests)
      // can observe the breathing band strength + focus geometry without a GPU.
      target.userData.tiltShift = { uTime, uBreath, uFocusHalf, uFalloff, uSpeed };

      return {
        // Looping/stateful: the band breathes continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uFocusHalf.value = num(params.focusHeight, 0.16);
          uFalloff.value = num(params.falloff, 0.22);
          uSpeed.value = num(params.speed, 1.2);
          // Mirror the shader's breathing factor on CPU for observability.
          uBreath.value = 0.5 + 0.5 * Math.sin(tt * num(params.speed, 1.2));
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'focusHeight') uFocusHalf.value = num(value, 0.16);
          else if (id === 'falloff') uFalloff.value = num(value, 0.22);
          else if (id === 'speed') uSpeed.value = num(value, 1.2);
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
        },
      };
    },
  ),
};
