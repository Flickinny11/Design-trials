// fresnel-glow — a rim glow on the host sphere driven by a view-angle fresnel
// term times a time-driven pulse, while the sphere rotates so play is
// CPU-observable. Hard / glass primitive. Template note: swap the sphere's
// material for a TSL node material whose emissiveNode is color * pow(fresnel,
// power) * pulse; advance a time uniform in seek() and also rotate the host
// object. Params read live via uniforms (onParamChange) and via params in seek.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  vec3,
  float,
  normalView,
  positionViewDirection,
  oneMinus,
  sin,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'power', label: 'Power', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.5 },
  { id: 'color', label: 'Color', type: 'color', default: '#5d8bff' },
  { id: 'pulseSpeed', label: 'Pulse speed', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.5 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
] as const;

export const fresnelGlowPrimitive: PrimitiveDefinition = {
  name: 'fresnel-glow',
  label: 'Fresnel glow',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A view-angle rim glow pulses on the sphere edge while the sphere slowly rotates; color, power, pulse speed, and intensity tunable.',
  create: defineAnimatable(
    { name: 'fresnel-glow', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.color, '#5d8bff'));

      const uTime = uniform(0);
      const uPower = uniform(num(params.power, 2.5));
      const uPulseSpeed = uniform(num(params.pulseSpeed, 1.5));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // fresnel = 1 - (normal . viewDir): bright at grazing angles (the rim).
      const fresnel = oneMinus(normalView.dot(positionViewDirection).abs());
      // pulse = sine of time, remapped into 0..1 so the glow breathes.
      const pulse = sin(uTime.mul(uPulseSpeed)).mul(0.5).add(0.5);
      const rim = fresnel.pow(uPower).mul(pulse).mul(uIntensity);
      const emissiveNode = vec3(uR, uG, uB).mul(rim);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#10131f'),
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const subject = mesh ?? target.object;
      const baseRotY = subject.rotation.y;

      // One full rotation per duration so seek(0) vs seek(dur) differ visibly.
      const DURATION = 4;
      const SPIN = Math.PI * 2;

      return {
        duration: () => DURATION,
        seek: (t: number) => {
          uTime.value = t;
          // Live-read pulse speed too, in case a host drives uniforms by params.
          uPulseSpeed.value = num(params.pulseSpeed, 1.5);
          subject.rotation.y = baseRotY + (t / DURATION) * SPIN;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'power') uPower.value = num(value, 2.5);
          else if (id === 'pulseSpeed') uPulseSpeed.value = num(value, 1.5);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'color' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          subject.rotation.y = baseRotY;
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
