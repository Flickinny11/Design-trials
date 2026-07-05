// glint-streak — sharp anamorphic glints flare across the card. The host card's
// material is swapped for a MeshStandardNodeMaterial whose emissiveNode adds
// crisp cross/horizontal lens-flare streaks at a moving hotspot (uHot). For a
// hotspot, the streak kernel is intensity * exp(-|uv.x-hot.x|*kx) along the
// horizontal arm plus a tighter exp(-|uv.y-hot.y|*ky) vertical arm, multiplied
// by a twinkle (0.5 + 0.5*sin(uTime*tw)). seek() advances uTime and slides uHot
// across the card; controls (speed, length, intensity) are read live.
// SHIMMER / GPU. DISTINCT from sparkle-glints: these are long anamorphic streaks,
// not point sparkles.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, exp, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1 },
  { id: 'length', label: 'Length', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1.4 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.6 },
] as const;

export const glintStreakPrimitive: PrimitiveDefinition = {
  name: 'glint-streak',
  label: 'Glint Streak',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Sharp anamorphic glints flare across bright points of the card — crisp lens-flare streaks that twinkle and travel.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'glint-streak', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uHotX = uniform(0.2);
      const uHotY = uniform(0.6);
      const uLength = uniform(num(params.length, 1.4));
      const uIntensity = uniform(num(params.intensity, 1.6));

      const u = uv();
      // Horizontal arm: wide along x, tight along y.
      const dxH = abs(u.x.sub(uHotX));
      const dyH = abs(u.y.sub(uHotY));
      const armH = exp(dxH.mul(float(2.5).div(uLength)).negate())
        .mul(exp(dyH.mul(float(70)).negate()));
      // Vertical arm: tight along x, wide along y.
      const armV = exp(dyH.mul(float(2.5).div(uLength)).negate())
        .mul(exp(dxH.mul(float(70)).negate()));
      // Crisp central core for the lens-flare point.
      const core = exp(dxH.mul(dxH).add(dyH.mul(dyH)).mul(float(900)).negate());

      const streak = armH.add(armV).add(core.mul(float(1.5)));
      // Twinkle: flickers the flare over time.
      const twinkle = float(0.5).add(sin(uTime.mul(7.0)).mul(0.5)).mul(0.6).add(0.4);

      const glint = max(streak.mul(twinkle).mul(uIntensity), float(0));
      // Cool-white anamorphic tint.
      const emissiveNode = vec3(0.62, 0.78, 1.0).mul(glint);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles so the host (and tests) can observe seek-driven
      // state on CPU without reading GPU pixels.
      target.userData.glintStreak = { uTime, uHotX, uHotY };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          const speed = num(params.speed, 1);
          uTime.value = tt;
          // Hotspot travels diagonally across the card face and wraps.
          const phase = tt * speed * 0.35;
          uHotX.value = (phase % 1.0 + 1.0) % 1.0;
          uHotY.value = 0.5 + 0.32 * Math.sin(tt * speed * 1.7);
          // Read live so control tweaks apply on the next seek with no rebuild.
          uLength.value = num(params.length, 1.4);
          uIntensity.value = num(params.intensity, 1.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'length') uLength.value = num(value, 1.4);
          else if (id === 'intensity') uIntensity.value = num(value, 1.6);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
