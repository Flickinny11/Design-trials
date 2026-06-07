// displacement-transition — a displacement-mapped wipe between two tints.
// REFERENCE-style primitive (hard / displacement). Swaps the host plane's
// material for a MeshBasicNodeMaterial whose colorNode mixes two tints by a
// step() of the wipe axis (displaced by a noise of `amount`) against a live
// `progress` uniform that advances 0->1 over `duration`.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, sin, dot, vec2, fract, step, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 3, step: 0.1, default: 1.4, unit: 's' },
  { id: 'amount', label: 'Amount', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.3 },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'x', label: 'Horizontal' },
      { value: 'y', label: 'Vertical' },
    ],
    default: 'x',
  },
] as const;

const TINT_A = '#23304f';
const TINT_B = '#5d8bff';

export const displacementTransitionPrimitive: PrimitiveDefinition = {
  name: 'displacement-transition',
  label: 'Displacement transition',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A displacement-mapped wipe sweeps across the plane, mixing two tints; a progress uniform drives the reveal and amount roughens the edge.',
  create: defineAnimatable(
    { name: 'displacement-transition', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const [ar, ag, ab] = rgb(TINT_A);
      const [br, bg, bb] = rgb(TINT_B);

      const uProgress = uniform(0);
      const uAmount = uniform(num(params.amount, 0.3));
      // 1 → wipe along x; 0 → wipe along y.
      const uAxisX = uniform(str(params.axis, 'x') === 'y' ? 0 : 1);

      const u = uv();
      // Per-fragment pseudo-noise in [0,1] (cheap, deterministic, dep-free).
      const noise = fract(sin(dot(u, vec2(12.9898, 78.233))).mul(43758.5453));
      // Coordinate along the chosen axis, perturbed by the noise * amount.
      const coordX = u.x.mul(uAxisX);
      const coordY = u.y.mul(uAxisX.oneMinus());
      const axisCoord = coordX.add(coordY);
      const displaced = axisCoord.add(noise.sub(0.5).mul(uAmount));
      // step(): fragments past the displaced wipe front take tint B.
      const reveal = step(displaced, uProgress);

      const colorNode = mix(
        vec3(ar, ag, ab),
        vec3(br, bg, bb),
        reveal,
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          uProgress.value = phase(t, num(params.duration, 1.4));
          // Read amount/axis live so control changes take effect with no rebuild.
          uAmount.value = num(params.amount, 0.3);
          uAxisX.value = str(params.axis, 'x') === 'y' ? 0 : 1;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'amount') uAmount.value = num(value, 0.3);
          else if (id === 'axis') uAxisX.value = str(value, 'x') === 'y' ? 0 : 1;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
