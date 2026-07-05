// aerogel-haze — frozen-smoke aerogel: an ultra-light transmissive slab with a
// cool-blue Rayleigh haze and a warm backlit Tyndall glow. HARD / GPU primitive
// (glass). Swaps the host card panel's material for a MeshPhysicalNodeMaterial
// with high transmission (~0.95), mid thickness, mid (hazy) roughness, and a
// cool-blue attenuationColor (Rayleigh scattering tint). An emissiveNode adds a
// warm backlight concentrated where the slab is thin (edges) — Tyndall warm-on-
// transmit — faintly breathing on uTime. seek() advances uTime (read live);
// onParamChange() mirrors the structural uniforms.
//
// DISTINCT from frosted-glass (neutral roughness sweep, no tint, no backlight):
// aerogel is permanently blue-hazed with a warm edge glow.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  float,
  vec3,
  sin,
  abs,
  smoothstep,
  max,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp as clampNum, type ControlValue, type PrimitiveDefinition } from '../contract';

const COOL_BLUE = new Color('#7fb6ff'); // Rayleigh scatter tint
const WARM = new Color('#ffb066'); // Tyndall warm backlight

const SCHEMA = [
  { id: 'haze', label: 'Haze', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'warmth', label: 'Warmth', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.1, max: 2, step: 0.05, default: 0.7 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
] as const;

export const aerogelHazePrimitive: PrimitiveDefinition = {
  name: 'aerogel-haze',
  label: 'Aerogel Haze',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Frozen-smoke aerogel — an ultra-light transmissive slab with a blue Rayleigh haze and a warm backlit glow.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'aerogel-haze', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uHaze = uniform(num(params.haze, 0.55));
      const uWarmth = uniform(num(params.warmth, 0.6));

      // Warm backlit glow concentrated where the slab reads as thin — at the
      // edges of the card face. Distance-from-center in uv: 0 at center, ~1 at
      // edge. The edge factor rises sharply near the rim (Tyndall warm-on-
      // transmit), and breathes faintly on time so the glow looks alive.
      const u = uv();
      const cx = abs(u.x.sub(0.5)).mul(2.0);
      const cy = abs(u.y.sub(0.5)).mul(2.0);
      const edgeDist = max(cx, cy); // square-ish falloff toward the rim
      const rim = smoothstep(float(0.45), float(1.0), edgeDist);
      const breathe = sin(uTime.mul(1.3)).mul(0.5).add(0.5).mul(0.35).add(0.65);
      const glow = rim.mul(uWarmth).mul(breathe);

      const warm = vec3(WARM.r, WARM.g, WARM.b);
      const emissiveNode = warm.mul(glow);

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 0.95,
        thickness: num(params.thickness, 0.7),
        // mid (hazy) roughness; haze biases it cloudier
        roughness: 0.35 + num(params.haze, 0.55) * 0.35,
        metalness: 0.0,
        ior: 1.05, // aerogel: barely above air
        envMapIntensity: 1.1,
        attenuationDistance: 0.5,
        attenuationColor: COOL_BLUE.clone(),
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish handles to host scratch space (contract: userData holds uniform
      // handles). uTime is the load-bearing observable.
      target.userData.uTime = uTime;
      target.userData.uHaze = uHaze;
      target.userData.uWarmth = uWarmth;

      // Apply the haze fader to the (CPU-side, observable) material roughness and
      // attenuation tint; keep the uniforms in sync for the emissive glow.
      const applyHaze = () => {
        const haze = num(params.haze, 0.55);
        const physical = mat as unknown as {
          roughness: number;
          thickness: number;
          attenuationColor: Color;
        };
        // hazier -> rougher AND a stronger blue tint (lower blue floor = bluer)
        physical.roughness = clampNum(0.35 + haze * 0.35, 0, 1);
        physical.thickness = num(params.thickness, 0.7);
        // Rayleigh tint deepens with haze: lerp from near-white toward cool blue.
        const b = COOL_BLUE;
        physical.attenuationColor.setRGB(
          1 - (1 - b.r) * haze,
          1 - (1 - b.g) * haze,
          1 - (1 - b.b) * haze,
        );
        uHaze.value = haze;
        uWarmth.value = num(params.warmth, 0.6);
      };
      applyHaze();

      return {
        // Continuous breathing backlight -> purely stateful loop.
        duration: () => Infinity,
        seek: (t) => {
          uTime.value = t * num(params.speed, 1);
          applyHaze();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'haze' || id === 'thickness') applyHaze();
          else if (id === 'warmth') uWarmth.value = num(value, 0.6);
          // speed read live in seek(); no uniform to mirror.
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
