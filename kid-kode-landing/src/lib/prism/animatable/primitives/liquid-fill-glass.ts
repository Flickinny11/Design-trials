// liquid-fill-glass — a glass panel filling with tinted liquid. HARD / GPU
// primitive. Swaps the host card's material for a MeshPhysicalNodeMaterial
// (transmission=1, roughness=0) and, via TSL, mixes a liquid region (higher
// thickness + colored attenuation) below a wobbling meniscus against clearer
// empty glass above. The fill level uFill rises 0->1 over time; the meniscus
// line wobbles via sin(uv.x*waves + uTime)*meniscus. seek() advances uFill and
// uTime; onParamChange() updates the live uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import { uniform, uv, sin, step, mix, float, vec3 } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'fillSpeed', label: 'Fill Speed', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.28, unit: '/s' },
  { id: 'liquidColor', label: 'Liquid Color', type: 'color', default: '#3fc7ff' },
  { id: 'meniscus', label: 'Meniscus', type: 'knob', min: 0, max: 0.06, step: 0.002, default: 0.03 },
  { id: 'waves', label: 'Waves', type: 'knob', min: 1, max: 14, step: 0.5, default: 7 },
  { id: 'waveSpeed', label: 'Wave Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.6 },
] as const;

export const liquidFillGlassPrimitive: PrimitiveDefinition = {
  name: 'liquid-fill-glass',
  label: 'Liquid Fill Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A glass panel filling with tinted liquid — a refractive fill line rises with a wobbling meniscus.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquid-fill-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [lr, lg, lb] = rgb(str(params.liquidColor, '#3fc7ff'));

      const uTime = uniform(0);
      const uFill = uniform(0);
      const uMeniscus = uniform(num(params.meniscus, 0.03));
      const uWaves = uniform(num(params.waves, 7));
      const uWaveSpeed = uniform(num(params.waveSpeed, 1.6));
      const uLR = uniform(lr);
      const uLG = uniform(lg);
      const uLB = uniform(lb);

      // Wobbling fill line: level = uFill + sin(uv.x*waves + uTime*speed) * meniscus.
      // mask = step(uv.y, level) → 1 below the meniscus (liquid), 0 above (empty).
      const u = uv();
      const wobble = sin(u.x.mul(uWaves).add(uTime.mul(uWaveSpeed))).mul(uMeniscus);
      const level = uFill.add(wobble);
      const mask = step(u.y, level);

      // Liquid region: higher thickness + colored attenuation. Empty glass: near-
      // zero thickness, clear attenuation. Blend each through the mask so the
      // refraction reads as filled vs empty across the wobbling line.
      // thickness ∈ [0.02 (empty), 0.9 (liquid)] ; node-mixed via mask.
      const thicknessNode = mix(float(0.02), float(0.9), mask);
      const liquidTint = vec3(uLR, uLG, uLB);
      const clearTint = vec3(1, 1, 1);
      const attenColor = mix(clearTint, liquidTint, mask);

      const mat = new MeshPhysicalNodeMaterial({
        transmission: 1,
        roughness: 0,
        metalness: 0,
        thickness: 0.5,
        ior: 1.33,
        transparent: true,
      });
      // CAST node assignments to dodge strict TSL typing (mirrors caustics.ts).
      (mat as unknown as { thicknessNode: unknown }).thicknessNode = thicknessNode;
      (mat as unknown as { attenuationColorNode: unknown }).attenuationColorNode = attenColor;
      // Tint the surface color toward the liquid so the fill is unmistakable even
      // where headless transmission under-renders.
      const colorNode = mix(vec3(0.85, 0.9, 1.0), liquidTint, mask.mul(0.85));
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the fill-level uniform on the shared scratch space so the host
      // (and tests) can observe the rising liquid without a GPU read-back.
      target.userData.uFill = uFill;
      target.userData.uTime = uTime;

      const fillSpeed = () => num(params.fillSpeed, 0.28);
      // Time to fill from 0 to 1 at the current speed (clamped sane).
      const fillDur = () => clamp(1 / Math.max(fillSpeed(), 0.001), 1, 30);

      return {
        // Continuous/looping: keep advancing so re-seeking past the fill point
        // still wobbles the meniscus and the host can loop the tile.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // uFill rises with fillSpeed, settling at 1.
          uFill.value = clamp(tt * fillSpeed(), 0, 1);
          // Read params live so control changes apply without a rebuild.
          uMeniscus.value = num(params.meniscus, 0.03);
          uWaves.value = num(params.waves, 7);
          uWaveSpeed.value = num(params.waveSpeed, 1.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'meniscus') uMeniscus.value = num(value, 0.03);
          else if (id === 'waves') uWaves.value = num(value, 7);
          else if (id === 'waveSpeed') uWaveSpeed.value = num(value, 1.6);
          else if (id === 'liquidColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uLR.value = r;
            uLG.value = g;
            uLB.value = b;
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
