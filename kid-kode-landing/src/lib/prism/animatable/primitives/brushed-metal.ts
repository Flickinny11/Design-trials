// brushed-metal — an anisotropic brushed-metal sheen sweeps across the surface,
// the highlight stretched along the grain like turned aluminum. HARD / GPU
// primitive. Swaps the host card's panel material for a MeshStandardNodeMaterial;
// an emissiveNode builds an anisotropic highlight: a fine grain pattern
// (grain = uv.x * grainFreq, aniso = pow(0.5 + 0.5*sin(grain*2PI), sharp))
// modulated by a sweeping band along a grain direction (band = smoothstep(width,
// 0, abs(dot(uv,dir) - uSweep))). emissive += tint * aniso * band * intensity, so
// the moving specular is stretched along the brushed grain rather than a single
// isotropic raking line. seek() advances uSweep; onParamChange() updates live
// uniforms. DISTINCT from metallic-sheen (isotropic single band).

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, vec2, float, abs, sin, pow, dot, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const PI = Math.PI;
const TINT: [number, number, number] = (() => {
  const c = new Color('#e8eeff');
  return [c.r, c.g, c.b];
})();

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'grainFreq', label: 'Grain', type: 'knob', min: 20, max: 120, step: 1, default: 60 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.3 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.05, max: 0.6, step: 0.01, default: 0.22 },
] as const;

export const brushedMetalPrimitive: PrimitiveDefinition = {
  name: 'brushed-metal',
  label: 'Brushed Metal',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'An anisotropic brushed-metal sheen sweeps across the surface, the highlight stretched along the grain like turned aluminum.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'brushed-metal', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uSweep = uniform(0);
      const uGrainFreq = uniform(num(params.grainFreq, 60));
      const uIntensity = uniform(num(params.intensity, 1.3));
      const uWidth = uniform(num(params.width, 0.22));
      const uR = uniform(TINT[0]);
      const uG = uniform(TINT[1]);
      const uB = uniform(TINT[2]);

      const u = uv();
      // Fine brushed grain along uv.x → anisotropic micro-streaks.
      const grain = u.x.mul(uGrainFreq);
      const aniso = pow(float(0.5).add(sin(grain.mul(PI * 2)).mul(0.5)), float(3));
      // Sweep band along a grain direction (the brushed lay) — the highlight is
      // stretched along the grain because `dir` runs across the streaks.
      const dir = vec2(0.92, 0.39); // normalized-ish grain-cross direction
      const proj = dot(u, dir);
      const band = smoothstep(uWidth, float(0), abs(proj.sub(uSweep)));
      // emissive += tint * aniso * band * intensity
      const emissiveNode = vec3(uR, uG, uB).mul(aniso).mul(band).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#9aa6c4'),
        roughness: 0.26,
        metalness: 0.95,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      // Park uniform handles so the host/inspector (and tests) can observe the
      // live animated values without a GPU readback.
      mat.userData.brushed = { uSweep, uGrainFreq, uIntensity, uWidth };

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // uSweep travels across the projected range [0, ~1.31] of dot(uv,dir) for
      // uv in [0,1]^2, with margin so the band enters and exits.
      const SPAN = 1.5;
      return {
        duration: () => Infinity,
        seek: (tt) => {
          const speed = num(params.speed, 1);
          // Continuous loop across the projected span; never settles.
          const cycle = ((tt * speed * 0.35) % 1 + 1) % 1;
          uSweep.value = cycle * SPAN - 0.1;
          // Read params live so control changes apply without a rebuild.
          uGrainFreq.value = num(params.grainFreq, 60);
          uIntensity.value = num(params.intensity, 1.3);
          uWidth.value = num(params.width, 0.22);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'grainFreq') uGrainFreq.value = num(value, 60);
          else if (id === 'intensity') uIntensity.value = num(value, 1.3);
          else if (id === 'width') uWidth.value = num(value, 0.22);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
