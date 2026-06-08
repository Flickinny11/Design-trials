// pointer-shine — a sharp anamorphic glint flares at the pointer location,
// twinkling as it tracks the cursor across glossy glass. HARD / pointer
// primitive. Swaps the card's material for a MeshStandardNodeMaterial whose
// emissiveNode builds a crisp cross/star streak centred at uPointer (a vec2 in
// 0..1 uv space): two perpendicular exponential lobes (one long + thin, one
// short + thin) plus a small radial core. A twinkle term modulates the whole
// glint. seek() reads userData.pointer -> uPointer and advances uTime; controls
// read live so length/intensity/twinkle tweak with no rebuild. DISTINCT from
// spotlight-follow (which is a SOFT radial hotspot) — this is a SHARP
// anamorphic streak.

import { Mesh, Color, Vector2, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  vec2,
  float,
  abs,
  exp,
  sin,
  length,
  max,
  add,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'length', label: 'Length', type: 'knob', min: 0.5, max: 6, step: 0.05, default: 2.4 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 2.2 },
  { id: 'twinkle', label: 'Twinkle', type: 'knob', min: 0, max: 12, step: 0.1, default: 6 },
] as const;

export const pointerShinePrimitive: PrimitiveDefinition = {
  name: 'pointer-shine',
  label: 'Pointer Shine',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'A sharp anamorphic glint flares at the pointer location, twinkling as it tracks the cursor across glossy glass.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pointer-shine', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Live uniforms. uPointer is the glint centre in 0..1 uv space.
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uTime = uniform(0);
      // uLength scales the long streak falloff (larger length -> smaller falloff
      // coefficient -> longer streak). uIntensity scales the whole glint.
      const uLength = uniform(num(params.length, 2.4));
      const uIntensity = uniform(num(params.intensity, 2.2));
      const uTwinkle = uniform(num(params.twinkle, 6));

      const u = uv();
      const dx = abs(u.x.sub(uPointer.x));
      const dy = abs(u.y.sub(uPointer.y));

      // Falloff coefficients. The "loose" coefficient (kx/ky) controls the long
      // axis of each streak lobe and scales inversely with uLength; the "tight"
      // coefficient is large and fixed so the streak stays razor-thin across.
      const kLoose = float(40).div(uLength);
      const kTight = float(220);

      // Horizontal lobe: long across x, thin across y.
      const lobeH = exp(dx.mul(kLoose).negate()).mul(exp(dy.mul(kTight).negate()));
      // Vertical lobe: long across y, thin across x.
      const lobeV = exp(dy.mul(kLoose).negate()).mul(exp(dx.mul(kTight).negate()));
      // Small radial core at the centre.
      const dr = length(vec2(dx, dy));
      const core = exp(dr.mul(float(90)).negate());

      // Cross/star streak + core. Use max for the cross so the two lobes read as
      // a crisp star rather than a smeared sum.
      const streak: any = max(add(lobeH, lobeV), core);

      // Twinkle: 0.7 + 0.3*sin(uTime*tw), so the glint pulses but never dies.
      const twinkle = float(0.7).add(sin(uTime.mul(uTwinkle)).mul(0.3));

      // Cool-white glint, scaled by streak * intensity * twinkle.
      const glint = streak.mul(uIntensity).mul(twinkle);
      const emissiveNode = vec3(0.92, 0.96, 1.0).mul(glint);

      const mat = new MeshStandardNodeMaterial({
        transparent: true,
        metalness: 0.5,
        roughness: 0.22,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on shared scratch space so the host/driver —
      // and CPU tests — can observe glint centre/intensity/time without a GPU.
      target.userData.pointerShineUniforms = { uPointer, uTime, uLength, uIntensity, uTwinkle };

      const readPointer = (): { x: number; y: number } => {
        const p = target.userData.pointer as { x: number; y: number } | undefined;
        return {
          x: clamp(typeof p?.x === 'number' ? p.x : 0.5, 0, 1),
          y: clamp(typeof p?.y === 'number' ? p.y : 0.5, 0, 1),
        };
      };

      return {
        // Stateful / pointer-driven: twinkles continuously across t.
        duration: () => Infinity,
        seek: (t) => {
          const p = readPointer();
          (uPointer.value as Vector2).set(p.x, p.y);
          uTime.value = t;
          // Read controls live so changes apply with no rebuild.
          uLength.value = num(params.length, 2.4);
          uIntensity.value = num(params.intensity, 2.2);
          uTwinkle.value = num(params.twinkle, 6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'length') uLength.value = num(value, 2.4);
          else if (id === 'intensity') uIntensity.value = num(value, 2.2);
          else if (id === 'twinkle') uTwinkle.value = num(value, 6);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
