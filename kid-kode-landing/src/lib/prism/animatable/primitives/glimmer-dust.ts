// glimmer-dust — a fine dusting of glimmer sparkles drifts and flickers across
// the surface like glitter catching the light. SHIMMER / GPU primitive. Swaps
// the host card's material for a MeshStandardNodeMaterial whose emissiveNode is
// a high-frequency hashed glimmer field: a sine-hash noise of uv*density offset
// by a STEPPED time term (floor(uTime*flickerRate)) so the sparkles re-roll in
// discrete steps -> flicker. sharpened with pow, scaled by intensity, tinted.
// seek() advances the time uniform; onParamChange() updates the live uniforms.
//
// Distinct from sparkle-glints (a few big glints) and starfield (steady fixed
// positions): this is DENSE glitter whose sparkle positions re-roll every step.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, fract, floor, pow, max, dot, vec2 } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'density', label: 'Density', type: 'knob', min: 20, max: 120, step: 1, default: 60 },
  { id: 'flickerRate', label: 'Flicker', type: 'knob', min: 2, max: 20, step: 0.5, default: 9, unit: 'hz' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'sharp', label: 'Sharpness', type: 'knob', min: 1, max: 12, step: 0.5, default: 6 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#fff4c4' },
] as const;

export const glimmerDustPrimitive: PrimitiveDefinition = {
  name: 'glimmer-dust',
  label: 'Glimmer Dust',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A fine dusting of glimmer sparkles drifts and flickers across the surface like glitter catching the light.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'glimmer-dust', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#fff4c4'));
      const uTime = uniform(0);
      const uDensity = uniform(num(params.density, 60));
      const uFlicker = uniform(num(params.flickerRate, 9));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uSharp = uniform(num(params.sharp, 6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // High-frequency hashed glimmer field.
      //   cell = floor(uv*density + steppedTime)  -> per-sparkle cell id
      //   n    = hashNoise(cell)                  -> 0..1 sparkle value
      //   stepped time (floor(uTime*flickerRate)*0.123) re-rolls the hash in
      //   discrete steps -> the flicker. A slow drift keeps the dust moving.
      const u = uv();
      const step = floor(uTime.mul(uFlicker)).mul(0.123);
      const drift = uTime.mul(0.15);
      // cell coordinate: dense grid that scrolls slowly and re-rolls per step.
      const cell = floor(
        vec2(u.x.mul(uDensity).add(drift).add(step), u.y.mul(uDensity).sub(drift).add(step)),
      );
      // sine-hash noise: fract(sin(dot(cell, k)) * big) in [0,1].
      const n = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));

      // threshold + sharpen so only the brightest cells spark.
      const threshold = float(0.82);
      const above = max(n.sub(threshold), float(0)).div(float(1).sub(threshold));
      const glimmer = pow(above, uSharp).mul(uIntensity);

      const emissiveNode = vec3(uR, uG, uB).mul(glimmer);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      // Keep the card readable: tint base dark, let the glimmer ride the emissive.
      mat.color = new Color('#1b2444');
      mat.roughness = 0.4;
      mat.metalness = 0.3;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose uniform handles on the shared scratch space so the host (and
      // headless tests, which cannot read GPU pixels) can observe the live
      // clock + control uniforms driving the shader.
      target.userData.glimmerUniforms = {
        time: uTime,
        density: uDensity,
        flicker: uFlicker,
        intensity: uIntensity,
        sharp: uSharp,
      };

      return {
        // Looping/stateful flicker — continuous across t.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDensity.value = num(params.density, 60);
          uFlicker.value = num(params.flickerRate, 9);
          uIntensity.value = num(params.intensity, 1.4);
          uSharp.value = num(params.sharp, 6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'density') uDensity.value = num(value, 60);
          else if (id === 'flickerRate') uFlicker.value = num(value, 9);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'sharp') uSharp.value = num(value, 6);
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
