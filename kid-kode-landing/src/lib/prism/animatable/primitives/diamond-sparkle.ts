// diamond-sparkle — sharp four-point diamond sparkles ignite at scattered bright
// spots across the surface, twinkling on and off. HARD / GPU primitive
// (category 'shimmer'). Swaps the host card's material for a
// MeshStandardNodeMaterial whose emissiveNode sums K fixed-position sparkles.
// Each sparkle is a 4-point star kernel built from anisotropic exponential
// falloffs (a tight horizontal blade crossed with a tight vertical blade), and
// each blinks at its own phase via max(0, sin(uTime*rate + phase_s)). The
// 'points' dropdown adds two diagonal arms (a 6/8-point star) for a richer
// burst. seek() advances uTime and reads params live; onParamChange() mirrors
// the live uniforms; dispose() restores the swapped material.
//
// DISTINCT from sparkle-glints (round grid points) — these are sharp 4-point
// stars at fixed scattered positions, like light catching a cut diamond.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, abs, exp, sin, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'rate', label: 'Rate', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.2 },
  {
    id: 'points',
    label: 'Points',
    type: 'dropdown',
    options: [
      { value: '4', label: '4-point' },
      { value: '6', label: '6-point (diagonal arms)' },
    ],
    default: '4',
  },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.8 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#ffffff' },
] as const;

// K fixed scattered sparkle spots, each with its own twinkle phase. Positions
// are deterministic constants (no randomness) so the look is reproducible.
const SPOTS: ReadonlyArray<{ x: number; y: number; phase: number }> = [
  { x: 0.18, y: 0.74, phase: 0.0 },
  { x: 0.42, y: 0.32, phase: 1.7 },
  { x: 0.66, y: 0.81, phase: 3.1 },
  { x: 0.81, y: 0.46, phase: 4.6 },
  { x: 0.3, y: 0.55, phase: 2.3 },
  { x: 0.58, y: 0.2, phase: 5.4 },
];

// Star-kernel falloff sharpness. Tight axis = the thin blade core; loose axis =
// the long ray. kxTight/kyTight pinch the orthogonal blade.
const KX = 22.0; // horizontal blade: gentle along x -> long ray
const KY = 22.0; // vertical blade: gentle along y -> long ray
const KX_TIGHT = 160.0; // pinch across the vertical blade
const KY_TIGHT = 160.0; // pinch across the horizontal blade

export const diamondSparklePrimitive: PrimitiveDefinition = {
  name: 'diamond-sparkle',
  label: 'Diamond Sparkle',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Sharp four-point diamond sparkles ignite at scattered bright spots across the surface, twinkling on and off.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'diamond-sparkle', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#ffffff'));
      const uTime = uniform(0);
      const uRate = uniform(num(params.rate, 2.2));
      const uIntensity = uniform(num(params.intensity, 1.8));
      // Diagonal-arm gate: 0 for a pure 4-point star, 1 to add the two diagonal
      // arms (6/8-point burst). Reacted to live via onParamChange.
      const uDiagonal = uniform(str(params.points, '4') === '4' ? 0 : 1);
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Build the summed emissive from K fixed sparkle spots. Each spot's star
      // kernel = a horizontal blade (long in x, pinched in y) + a vertical blade
      // (long in y, pinched in x). The diagonal arms (gated by uDiagonal) rotate
      // the same blade pair 45deg. Each blade set is gated by its own twinkle.
      const u = uv();
      const kx = float(KX);
      const ky = float(KY);
      const kxt = float(KX_TIGHT);
      const kyt = float(KY_TIGHT);

      // Accumulator must be typed `any` — reassigning a fluent TSL node through
      // .add() trips the narrow VarNode typing under strict tsc (see
      // splat-reveal.ts / pool-caustics.ts fixes).
      let acc: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any

      for (const s of SPOTS) {
        const dx = u.x.sub(float(s.x));
        const dy = u.y.sub(float(s.y));

        // Axis-aligned 4-point star: crossed anisotropic exp blades.
        const horiz = exp(abs(dx).mul(kx).negate()).mul(exp(abs(dy).mul(kyt).negate()));
        const vert = exp(abs(dy).mul(ky).negate()).mul(exp(abs(dx).mul(kxt).negate()));
        const star4 = horiz.add(vert);

        // Diagonal arms: same blades rotated 45deg (use d = (dx±dy)/√2 axes).
        const da = dx.add(dy).mul(0.70710678);
        const db = dx.sub(dy).mul(0.70710678);
        const diagA = exp(abs(da).mul(kx).negate()).mul(exp(abs(db).mul(kyt).negate()));
        const diagB = exp(abs(db).mul(ky).negate()).mul(exp(abs(da).mul(kxt).negate()));
        const starDiag = diagA.add(diagB).mul(uDiagonal);

        const star = star4.add(starDiag);

        // Per-spot twinkle: max(0, sin(uTime*rate + phase)) so it blinks on/off.
        const twinkle = max(sin(uTime.mul(uRate).add(float(s.phase))), float(0));

        acc = acc.add(star.mul(twinkle));
      }

      const emissiveNode = vec3(uR, uG, uB).mul(acc).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles through the host-shared scratch space so the
      // host/tests can observe driven state on CPU without a renderer.
      target.userData.diamondSparkle = {
        uTime,
        uRate,
        uIntensity,
        uDiagonal,
        uR,
        uG,
        uB,
      };

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRate.value = num(params.rate, 2.2);
          uIntensity.value = num(params.intensity, 1.8);
          uDiagonal.value = str(params.points, '4') === '4' ? 0 : 1;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rate') uRate.value = num(value, 2.2);
          else if (id === 'intensity') uIntensity.value = num(value, 1.8);
          else if (id === 'points' && typeof value === 'string') {
            uDiagonal.value = value === '4' ? 0 : 1;
          } else if (id === 'tint' && typeof value === 'string') {
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
