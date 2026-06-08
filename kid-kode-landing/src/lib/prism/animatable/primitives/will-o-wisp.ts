// will-o-wisp — ghostly glowing wisps drift and bob through the dark. HARD /
// volumetric primitive. Swaps the host plane's material for a MeshBasicNode-
// Material whose opacityNode sums several soft glowing orbs at drifting centers
// c_k(uTime) = base_k + (sin(uTime*sx_k), cos(uTime*sy_k))*range. Each orb is
// exp(-length(uv - c_k)*falloff) * (0.6 + 0.4*sin(uTime*pulse_k)) so it bobs and
// pulses; a pale cyan/green glow with a soft halo tints the colorNode. seek()
// advances the time uniform; controls (wisps, driftSpeed, glowSize) read live.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, cos, exp, length, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const MAX_WISPS = 6;

// Deterministic per-wisp parameters from an index hash — no Math.random.
const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'wisps', label: 'Wisps', type: 'knob', min: 2, max: 6, step: 1, default: 4 },
  { id: 'driftSpeed', label: 'Drift Speed', type: 'knob', min: 0.1, max: 2.5, step: 0.05, default: 0.8 },
  { id: 'glowSize', label: 'Glow Size', type: 'knob', min: 0.05, max: 0.3, step: 0.01, default: 0.16 },
] as const;

export const willOWispPrimitive: PrimitiveDefinition = {
  name: 'will-o-wisp',
  label: "Will-o'-Wisp",
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Ghostly glowing wisps drift and bob through the dark, soft orbs of pale light wandering like marsh spirits.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'will-o-wisp', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.driftSpeed, 0.8));
      const uGlow = uniform(num(params.glowSize, 0.16));
      // uCount gates each orb's contribution (1 if active, 0 otherwise) so the
      // wisp count is a live uniform with no rebuild.
      const uCount = uniform(num(params.wisps, 4));

      const u = uv();
      // 1/glowSize -> falloff. Larger glowSize == softer, wider orbs.
      const falloff = float(1).div(uGlow);
      const driftT = uTime.mul(uDrift);

      // Accumulate orbs. `any` alias dodges the narrow VarNode typing on reassign.
      let glow: any = float(0); // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let k = 0; k < MAX_WISPS; k++) {
        // Deterministic per-wisp constants.
        const bx = -0.32 + hash(k * 3 + 1) * 0.64;
        const by = -0.32 + hash(k * 3 + 2) * 0.64;
        const sx = 0.5 + hash(k * 7 + 3) * 1.5;
        const sy = 0.5 + hash(k * 7 + 5) * 1.5;
        const range = 0.18 + hash(k * 11 + 7) * 0.22;
        const pulse = 1.0 + hash(k * 13 + 9) * 2.5;

        const cx = float(bx).add(sin(driftT.mul(sx)).mul(range));
        const cy = float(by).add(cos(driftT.mul(sy)).mul(range));
        const center = vec2(cx, cy);

        const d = length(u.sub(center));
        const bob = float(0.6).add(sin(uTime.mul(pulse)).mul(0.4));
        const orb = exp(d.mul(falloff).negate()).mul(bob);
        // active = 1 when k < count, else 0 (k+0.5 < count guards float compare).
        const active = uCount.sub(float(k + 0.5)).clamp(0, 1);

        glow = glow.add(orb.mul(active));
      }

      const opacity = max(glow, float(0)).clamp(0, 1);

      // Pale cyan/green core with a slightly greener soft halo.
      const core = vec3(0.62, 1.0, 0.86);
      const halo = vec3(0.3, 0.85, 0.55);
      const colorNode = halo.add(core.sub(halo).mul(opacity));

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacity;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the shared scratch space (host can drive
      // them; tests observe the advancing clock without reaching into pixels).
      target.userData.wispUniforms = { uTime, uDrift, uGlow, uCount };

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.driftSpeed, 0.8);
          uGlow.value = clamp(num(params.glowSize, 0.16), 0.05, 0.3);
          uCount.value = clamp(num(params.wisps, 4), 2, MAX_WISPS);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'driftSpeed') uDrift.value = num(value, 0.8);
          else if (id === 'glowSize') uGlow.value = clamp(num(value, 0.16), 0.05, 0.3);
          else if (id === 'wisps') uCount.value = clamp(num(value, 4), 2, MAX_WISPS);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
