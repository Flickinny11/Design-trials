// fog — low volumetric fog rolls sideways across the plane. HARD / GPU
// primitive (volumetric). Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode builds layered horizontal fbm bands
// advected along uv.x by a time*drift uniform, modulated by a vertical density
// gradient (thicker low). The result is soft grey, low-contrast fog with a
// gentle band structure that thins and thickens as banks pass.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData for CPU-observable tests.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, fract, mix, clamp as tslClamp } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
  { id: 'density', label: 'Density', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 1 },
  { id: 'layers', label: 'Layers', type: 'knob', min: 1, max: 5, step: 1, default: 3 },
] as const;

// 1-D-ish pseudo-noise from a 2-D coord: cheap layered sines (deterministic,
// no textures). Used to build banded fbm horizontally.
function bandNoise(
  x: ReturnType<typeof uv>['x'],
  y: ReturnType<typeof uv>['y'],
) {
  const a = sin(x.mul(3.1).add(y.mul(1.7)));
  const b = sin(x.mul(6.3).sub(y.mul(0.9)).add(1.3));
  const c = sin(x.mul(12.1).add(y.mul(2.4)).sub(0.7));
  // weighted fbm, normalized to ~0..1
  return a.mul(0.5).add(b.mul(0.3)).add(c.mul(0.2)).mul(0.5).add(0.5);
}

export const fogPrimitive: PrimitiveDefinition = {
  name: 'fog',
  label: 'Fog',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Low fog rolls across, soft layered banks thinning and thickening as they pass.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.6));
      const uDensity = uniform(num(params.density, 1));
      const uLayers = uniform(num(params.layers, 3));

      const u = uv();
      // Sideways advection: drift the field along uv.x by time*speed.
      const drift = uTime.mul(uSpeed);
      const x = u.x.sub(drift);
      const y = u.y;

      // Three horizontal fbm bands at increasing frequency, each advected at a
      // slightly different rate so banks pass independently (parallax of fog).
      const b0 = bandNoise(x, y.mul(0.6));
      const b1 = bandNoise(x.mul(1.8).add(drift.mul(0.4)), y.mul(1.1).add(0.3));
      const b2 = bandNoise(x.mul(3.2).sub(drift.mul(0.7)), y.mul(0.4).add(0.6));

      // Number of active layers gates b1/b2 in smoothly via uLayers (1..5).
      const w1 = tslClamp(uLayers.sub(float(1)), float(0), float(1));
      const w2 = tslClamp(uLayers.sub(float(2)), float(0), float(1));
      const layered = b0
        .add(b1.mul(w1).mul(0.6))
        .add(b2.mul(w2).mul(0.35));

      // Vertical density gradient — thicker low (y near 0), thinner high.
      const vertical = float(1).sub(y).mul(0.9).add(0.2);

      // Combine, scale by density, keep low-contrast (gentle band structure,
      // not flat): map into a soft 0.15..0.9 range.
      const raw = layered.mul(vertical).mul(uDensity);
      const fogAmt = tslClamp(raw.mul(0.55).add(0.2), float(0), float(1));

      // Soft grey fog with a faint cool tint, low contrast: mix dark grey -> light grey.
      const lo = vec3(0.18, 0.2, 0.23);
      const hi = vec3(0.78, 0.8, 0.84);
      const colorNode = mix(lo, hi, fogAmt);
      // Slight opacity link to density so banks read as denser, not just brighter.
      const opacityNode = tslClamp(
        fogAmt.mul(0.7).add(0.3).add(abs(fract(drift).sub(0.5)).mul(0.0)),
        float(0.15),
        float(1),
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.fogUniforms = { uTime, uSpeed, uDensity, uLayers };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.6);
          uDensity.value = num(params.density, 1);
          uLayers.value = num(params.layers, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'layers') uLayers.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.fogUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
