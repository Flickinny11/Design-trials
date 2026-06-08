// holographic — a holographic foil sheen sweeps across the card. The subject's
// material is swapped for a MeshStandardNodeMaterial whose emissive node adds an
// additive rainbow band: a sin-based HSV palette of (dot(uv, dir) + uTime*speed)
// over a dark base, producing diagonal holo bands driven by a moving light.
// HARD / GPU primitive (TSL). Looping/stateful → duration() = Infinity; seek()
// advances the uTime uniform and reads params live; onParamChange updates uniforms.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, dot, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'bandScale', label: 'Band Scale', type: 'knob', min: 1, max: 16, step: 0.1, default: 7 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.2 },
] as const;

export const holographicPrimitive: PrimitiveDefinition = {
  name: 'holographic',
  label: 'Holographic',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A holographic foil sheen sweeps across the card — rainbow bands shifting with a moving light.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'holographic', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uBandScale = uniform(num(params.bandScale, 7));
      const uIntensity = uniform(num(params.intensity, 1.2));

      // Diagonal coordinate: dot(uv, dir) where dir is a normalized diagonal.
      const u = uv();
      const dir = vec3(0.7071, 0.7071, 0.0);
      const proj = dot(vec3(u.x, u.y, float(0)), dir);

      // Moving phase: scaled diagonal position + time. The band sweeps as uTime grows.
      const phase = proj.mul(uBandScale).add(uTime.mul(uSpeed));

      // Sin-based HSV-ish rainbow palette: three sines offset by 2pi/3 give R/G/B.
      const TAU3 = (2 * Math.PI) / 3;
      const r = sin(phase).mul(0.5).add(0.5);
      const g = sin(phase.add(float(TAU3))).mul(0.5).add(0.5);
      const b = sin(phase.add(float(TAU3 * 2))).mul(0.5).add(0.5);

      // Band mask: a moving bright crest so the holo reads as a sweeping foil
      // rather than a static rainbow wash. Sharpened sin of the same phase.
      const crest = max(sin(phase), float(0));
      const band = crest.mul(crest).mul(uIntensity);

      // Additive rainbow band over a dark base (the base material color stays
      // dark via the swapped material's defaults; emissive adds the holo).
      const emissiveNode = vec3(r, g, b).mul(band);

      const mat = new MeshStandardNodeMaterial({
        color: 0x0b1124,
        roughness: 0.3,
        metalness: 0.6,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish live uniform handles to the host scratch space so a driver (or a
      // headless test) can observe the animation without a real GPU readback.
      target.userData.holographic = { uTime, uSpeed, uBandScale, uIntensity };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uBandScale.value = num(params.bandScale, 7);
          uIntensity.value = num(params.intensity, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'bandScale') uBandScale.value = num(value, 7);
          else if (id === 'intensity') uIntensity.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
