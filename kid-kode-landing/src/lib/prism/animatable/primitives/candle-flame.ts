// candle-flame — a small calm candle flame painted onto the host plane. HARD /
// volumetric TSL primitive. Swaps the plane's material for a MeshBasicNode-
// Material whose colorNode draws a tight teardrop of light: a narrow vertical
// envelope centered horizontally, a teardrop profile (wide-ish low, pinched to
// a point at the top), gently wavering via low-amplitude fbm-ish noise of a
// time uniform. Palette runs faint blue at the very base -> bright yellow core
// -> orange tip. opacityNode is the flame mask. seek() advances the time
// uniform; onParamChange() updates the live uniforms. Distinct from a campfire:
// a single small, calm teardrop — not multiple licking tongues.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  sin,
  abs,
  smoothstep,
  mix,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'flicker', label: 'Flicker', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.3, max: 1.6, step: 0.01, default: 0.8 },
  { id: 'warmth', label: 'Warmth', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const candleFlamePrimitive: PrimitiveDefinition = {
  name: 'candle-flame',
  label: 'Candle Flame',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A small candle flame flickers gently — a tight teardrop of light with a faint blue base, wavering in still air.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'candle-flame', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uFlicker = uniform(num(params.flicker, 0.35));
      const uSize = uniform(num(params.size, 0.8));
      const uWarmth = uniform(num(params.warmth, 0.5));

      const u = uv();
      // Center the flame; v=0 at the wick (bottom), v->1 at the tip.
      const cx = float(0.5);
      const v = u.y; // 0..1, base..tip
      const t = uTime;

      // Cheap layered noise of time only (calm, still-air wobble). Keep it small.
      const wobble = sin(t.mul(7.3))
        .add(sin(t.mul(3.1).add(1.7)).mul(0.6))
        .add(sin(t.mul(13.0).add(0.4)).mul(0.25))
        .mul(0.014)
        .mul(uFlicker);

      // Teardrop half-width profile across height: wide-ish low, pinched to a
      // point near the top. width(v) ~ broad near base, tapering to ~0 at tip.
      const halfWidth = float(0.16)
        .mul(uSize)
        .mul(smoothstep(float(1.02), float(0.18), v)) // narrows toward the tip
        .mul(smoothstep(float(-0.05), float(0.12), v)); // slight pinch at the wick

      // Flame centerline drifts very gently with the wobble; more sway higher up.
      const sway = wobble.mul(v.mul(v));
      const dx = u.x.sub(cx).sub(sway);

      // Horizontal falloff: 1 at the centerline, fading to 0 at the half-width edge.
      const radial = smoothstep(halfWidth, halfWidth.mul(0.25), abs(dx));

      // Vertical envelope: present from the wick, fading out past the tip.
      const vert = smoothstep(float(-0.02), float(0.06), v).mul(
        smoothstep(float(1.05), float(0.6), v),
      );

      // Flame mask (the teardrop body) with a touch of flicker on brightness.
      const flickerBright = float(1).add(wobble.mul(8.0));
      const mask = tslClamp(
        radial.mul(vert).mul(flickerBright),
        float(0),
        float(1),
      );

      // Palette by height: faint blue at the very base -> bright yellow core ->
      // orange tip. warmth pushes the whole palette warmer (less blue, redder tip).
      const blue = vec3(0.18, 0.4, 1.0);
      const yellow = vec3(1.0, 0.92, 0.4);
      const orange = vec3(1.0, 0.42, 0.08);

      // base->core blend over the lowest slice; core->tip over the upper portion.
      const baseToCore = smoothstep(float(0.0), float(0.22), v.add(uWarmth.mul(0.12)));
      const coreToTip = smoothstep(float(0.28), float(0.95), v.sub(uWarmth.mul(0.1)));
      const lowMix = mix(blue, yellow, baseToCore);
      const flameColor = mix(lowMix, orange, coreToTip);

      // Brighten the core; intensity follows the mask so edges glow softer.
      const colorNode = flameColor.mul(mask.mul(1.7));
      const opacityNode = mask;

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles so the host (and tests) can observe the
      // animation clock and resolved control values on CPU.
      target.userData.candleFlame = { uTime, uFlicker, uSize, uWarmth };

      return {
        // Stateful flicker loop — animate continuously across t.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply with no rebuild.
          uFlicker.value = num(params.flicker, 0.35);
          uSize.value = num(params.size, 0.8);
          uWarmth.value = num(params.warmth, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'flicker') uFlicker.value = num(value, 0.35);
          else if (id === 'size') uSize.value = num(value, 0.8);
          else if (id === 'warmth') uWarmth.value = num(value, 0.5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
