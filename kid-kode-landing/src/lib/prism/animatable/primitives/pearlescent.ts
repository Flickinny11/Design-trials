// pearlescent — a soft mother-of-pearl sheen that shifts hue across the card
// surface with "view angle". HARD / GPU primitive. Swaps the host card's
// material for a MeshStandardNodeMaterial whose colorNode blends the panel's
// base tint toward a PASTEL palette driven by a fresnel-like proxy term plus a
// slow time drift. The fresnel proxy is f = pow(1 - |uv.y-0.5|*2, power), so the
// sheen reads strongest at the upper/lower edges (a grazing-angle stand-in that
// works headless, no real view vector needed). The hue band is kept narrow,
// low-contrast and high-value so it stays pearlescent (pastel, premium) rather
// than the saturated oil-slick of `iridescence`. seek() advances uTime slowly;
// onParamChange() updates the live uniforms.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, pow, clamp, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // slow hue drift over time — kept low so the sheen breathes, not strobes.
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.12 },
  // how far the hue spreads across the surface (pastel band width).
  { id: 'range', label: 'Hue Range', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
  // sheen mix: 0 = base tint only, 1 = full pearl overlay.
  { id: 'sheen', label: 'Sheen', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const pearlescentPrimitive: PrimitiveDefinition = {
  name: 'pearlescent',
  label: 'Pearlescent',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A soft pearlescent sheen shifts hue across the surface with view angle, like mother-of-pearl — pastel, low-contrast, premium.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pearlescent', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uRange = uniform(num(params.range, 0.35));
      const uSheen = uniform(num(params.sheen, 0.6));

      // ── pastel mother-of-pearl color ─────────────────────────────────────
      // base panel tint (soft cool blue, matches the card chrome).
      const base = vec3(0.42, 0.5, 0.72);

      // fresnel-like proxy: strongest sheen toward the top/bottom edges, fading
      // through the middle — a grazing-angle stand-in over uv. power=2 gives a
      // smooth falloff. f in [0,1].
      const u = uv();
      const grad = float(1).sub(abs(u.y.sub(0.5)).mul(2));
      const f = pow(clamp(grad, float(0), float(1)), float(2));

      // hue = base offset + fresnel*range + slow time drift. Kept narrow.
      const hue = f.mul(uRange).add(uTime.mul(uDrift));

      // pastelPalette(hue): a low-contrast, high-value (whitened) spectrum. Each
      // channel is a phase-offset cosine pulled HARD toward white so the result
      // stays pastel (premium), never neon. amplitude 0.18 around a 0.8 base.
      const TAU = float(6.2831853);
      const ph = hue.mul(TAU);
      const amp = float(0.18);
      const lift = float(0.8);
      const pr = sin(ph).mul(amp).add(lift);
      const pg = sin(ph.add(2.0943951)).mul(amp).add(lift);
      const pb = sin(ph.add(4.1887902)).mul(amp).add(lift);
      const pastel = vec3(pr, pg, pb);

      // color = mix(base, pastel, sheen * f). Weighting by f as well as the
      // sheen control keeps the pearl concentrated at the grazing edges.
      const mixAmt = clamp(uSheen.mul(f), float(0), float(1));
      const colorNode = mix(base, pastel, mixAmt);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      // smooth, slightly metallic so the sheen reads as a soft pearl surface.
      (mat as unknown as { roughness: number }).roughness = 0.28;
      (mat as unknown as { metalness: number }).metalness = 0.4;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into the host scratch space (CPU-observable).
      target.userData.pearlescent = { uTime, uDrift, uRange, uSheen };

      return {
        // Looping/stateful sheen: continuous slow drift, no settle.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uRange.value = num(params.range, 0.35);
          uSheen.value = num(params.sheen, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'range') uRange.value = num(value, 0.35);
          else if (id === 'sheen') uSheen.value = num(value, 0.6);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
