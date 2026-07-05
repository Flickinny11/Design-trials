// metallic-sheen — a bright specular band rakes across a brushed-metal card,
// like light raking across it. MEDIUM / GPU primitive. Swaps the host card's
// panel material for a MeshStandardNodeMaterial; an emissiveNode adds a narrow
// bright band built from a smoothstep around a moving line position along uv.x
// (driven by a time uniform), tinted, over a metallic tint base. seek() advances
// the time uniform; onParamChange() updates the live uniforms. Distinct from a
// broad shimmer by the single, narrow raking band.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, abs, smoothstep, fract } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.02, max: 0.4, step: 0.01, default: 0.12 },
  { id: 'brightness', label: 'Brightness', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#dfe7ff' },
] as const;

export const metallicSheenPrimitive: PrimitiveDefinition = {
  name: 'metallic-sheen',
  label: 'Metallic Sheen',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A bright specular band sweeps across a brushed-metal card, like light raking across it.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'metallic-sheen', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#dfe7ff'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uWidth = uniform(num(params.width, 0.12));
      const uBright = uniform(num(params.brightness, 1.4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Moving raking line position in [0,1) along uv.x.
      const linePos = fract(uTime.mul(uSpeed).mul(0.25));
      // Distance from the current fragment's uv.x to the moving line.
      const d = abs(uv().x.sub(linePos));
      // A single narrow bright band: 1 at the line, falling to 0 by uWidth.
      const band = smoothstep(uWidth, float(0), d).mul(uBright);
      // Tinted band added as emissive over the metallic base.
      const emissiveNode = vec3(uR, uG, uB).mul(band);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#9aa6c4'),
        roughness: 0.28,
        metalness: 0.92,
        transparent: true,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      // Park uniform handles so the host/inspector (and tests) can observe the
      // live animated values without a GPU readback.
      mat.userData.sheen = { uTime, uSpeed, uWidth, uBright };

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uWidth.value = num(params.width, 0.12);
          uBright.value = num(params.brightness, 1.4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'width') uWidth.value = num(value, 0.12);
          else if (id === 'brightness') uBright.value = num(value, 1.4);
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
