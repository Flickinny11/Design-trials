// noise-wipe — an organic, ragged dissolve front sweeps across the card. The
// reveal front is a diagonal coordinate (uv.x*0.5 + n*0.5) modulated by a soft
// fbm/layered-sin noise field n = noise(uv*scale), so the edge that the reveal
// crosses is a natural, eroded contour rather than a straight line. A softness
// band feathers the front. seek() advances uProgress 0 -> 1.
// HARD / mask / GPU node-material primitive. Swaps the host card's material for
// a MeshStandardNodeMaterial whose opacityNode is
//   smoothstep(uProgress + soft, uProgress, uv.x*0.5 + n*0.5)
// so the surface is hidden ahead of the front and shown behind it, the front
// itself being the noise-warped diagonal. DISTINCT from wipe-linear (hard
// straight front) and dissolve-noise (uniform fade): this is a masked organic
// wipe with a ragged erosion edge.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, sin, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const ACCENT = '#5d8bff';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.3, unit: 's' },
  { id: 'scale', label: 'Raggedness', type: 'knob', min: 2, max: 12, step: 0.1, default: 6 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.01, max: 0.4, step: 0.01, default: 0.12 },
] as const;

export const noiseWipePrimitive: PrimitiveDefinition = {
  name: 'noise-wipe',
  label: 'Noise Wipe',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'An organic, ragged dissolve front sweeps across the card following a soft noise contour — a natural erosion reveal.',
  create: defineAnimatable(
    { name: 'noise-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the reveal shows the original colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let tint: [number, number, number] = rgb(ACCENT);
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        const c = (prevMat as unknown as { color: Color }).color;
        tint = [c.r, c.g, c.b];
      }

      const uProgress = uniform(0);
      const uScale = uniform(num(params.scale, 6));
      const uSoftness = uniform(num(params.softness, 0.12));
      const uR = uniform(tint[0]);
      const uG = uniform(tint[1]);
      const uB = uniform(tint[2]);

      // Organic erosion front.
      //   n     = layered sines of uv*scale (a cheap fbm-style noise field),
      //           remapped to ~0..1
      //   front = uv.x*0.5 + n*0.5  -> the diagonal sweep coordinate warped by
      //           the ragged noise contour
      // The surface is revealed where `front` is below uProgress, feathered by a
      // softness band. opacity = smoothstep(uProgress + soft, uProgress, front):
      // 1 behind the front (front < uProgress), 0 ahead of it.
      const u = uv();
      const sx = u.x.mul(uScale);
      const sy = u.y.mul(uScale);
      // Layered sins at incommensurate frequencies approximate fbm.
      const n1 = sin(sx.add(sy.mul(1.3)));
      const n2 = sin(sx.mul(1.7).sub(sy.mul(0.9)).add(float(2.1)));
      const n3 = sin(sx.mul(0.6).add(sy.mul(2.3)).add(float(4.7)));
      // Accumulate (reassigned fluent chain -> annotate as any per TSL typing).
      let noise: any = n1.mul(0.5);
      noise = noise.add(n2.mul(0.3));
      noise = noise.add(n3.mul(0.2));
      // remap from ~[-1,1] to ~[0,1]
      const n = noise.mul(0.5).add(0.5);

      const front = u.x.mul(0.5).add(n.mul(0.5));
      const opacityNode: any = smoothstep(uProgress.add(uSoftness), uProgress, front);

      const colorNode = vec3(uR, uG, uB);
      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      if (mesh) mesh.material = mat;

      // Publish live uniform handles so the host/driver (and tests) can observe
      // the reveal progress / raggedness on the CPU.
      target.userData.noiseWipeProgress = uProgress;
      target.userData.noiseWipeScale = uScale;

      return {
        duration: () => num(params.duration, 1.3),
        seek: (t) => {
          const dur = num(params.duration, 1.3);
          // progress 0 -> 1: the noise-warped front sweeps across the card.
          uProgress.value = phase(t, dur);
          // Read controls live so a change applies on the next seek.
          uScale.value = num(params.scale, 6);
          uSoftness.value = num(params.softness, 0.12);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') {
            uScale.value = num(value, 6);
          } else if (id === 'softness') {
            uSoftness.value = num(value, 0.12);
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
