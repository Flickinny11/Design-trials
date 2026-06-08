// fog-roll — a directional bank of fog rolls in from one side, billowing across
// the surface in slow churning layers. HARD / GPU primitive (smoke). Swaps the
// host plane's material for a MeshBasicNodeMaterial whose opacityNode/colorNode
// build a churning fbm field advected horizontally (density = fbm(uv*scale +
// vec2(uTime*roll, 0))) multiplied by a soft front envelope keyed to
// envelope(uv.x - wrap(uTime*roll)) so a billowing front sweeps across the
// surface. Low-contrast grey-white tint.
//
// DISTINCT from `fog` (low banded volumetric haze, vertical density gradient)
// and `smoke` (rising vertical plume): fog-roll is a horizontally advecting
// FRONT — a coherent bank with a leading edge that wraps across the surface.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData for CPU-observable tests.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, fract, mix, smoothstep, max, min } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'roll', label: 'Roll', type: 'knob', min: 0, max: 2, step: 0.02, default: 0.4 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.8, step: 0.02, default: 0.5 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const fogRollPrimitive: PrimitiveDefinition = {
  name: 'fog-roll',
  label: 'Fog Roll',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A bank of fog rolls in from one side, billowing across the surface in slow churning layers.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog-roll', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRoll = uniform(num(params.roll, 0.4));
      const uDensity = uniform(num(params.density, 0.5));
      const uScale = uniform(num(params.scale, 3));

      // ── value-noise + fbm (pure TSL, deterministic) ──────────────────────
      // Sin-hash value noise smoothed with bilinear blend of the 4 lattice
      // corners; fbm stacks a few octaves for a churning, billowing field.
      const hash = (p: any) => p.dot(vec2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: any) => {
        const i = p.floor();
        const f = p.fract();
        const w = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = a.mix(b, w.x);
        const x2 = c.mix(d, w.x);
        return x1.mix(x2, w.y);
      };

      // Horizontal advection of the noise field — the bank churns as it drifts.
      const u = uv();
      const roll = uTime.mul(uRoll);
      // Coordinate carried along x by time*roll; vertical churn shifts the
      // upper octaves so layers slip past each other (billowing, not sliding).
      const base = vec2(u.x.mul(uScale).add(roll), u.y.mul(uScale));

      let fbm: any = noise(base).mul(0.5);
      fbm = fbm.add(noise(base.mul(2).add(vec2(roll.mul(0.6), roll.mul(0.25)))).mul(0.3));
      fbm = fbm.add(noise(base.mul(4).sub(vec2(roll.mul(0.9), 0))).mul(0.2));

      // ── advecting front envelope ─────────────────────────────────────────
      // wrap(uTime*roll) sweeps a leading edge across uv.x in [0,1]; the bank
      // is dense behind the front and thins ahead of it. abs(diff)-based
      // wraparound distance keeps the front continuous as it loops.
      const front = fract(roll.mul(0.35)); // wrapped front position in [0,1]
      const dx = u.x.sub(front);
      // shortest signed wrap distance to the front in [-0.5, 0.5]
      const wrapped = dx.sub(dx.add(0.5).floor());
      // dense (1) well behind the front, fading to 0 just ahead of it
      const envelope = smoothstep(float(0.5), float(-0.15), wrapped);

      // Churning density: fbm gated by the sweeping front, scaled by density.
      const density = fbm.mul(envelope).mul(uDensity.mul(2.0));

      // Low-contrast grey-white tint: soft churning bank reads as pale haze,
      // slightly brighter where the fbm piles up.
      const lo = vec3(0.74, 0.76, 0.79);
      const hi = vec3(0.93, 0.94, 0.96);
      const tintAmt: any = min(max(fbm.mul(envelope), float(0)), float(1));
      const colorNode = mix(lo, hi, tintAmt);
      const opacityNode: any = min(max(density, float(0)), float(0.92));

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.fogRollUniforms = { uTime, uRoll, uDensity, uScale };

      return {
        // Continuous rolling bank — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRoll.value = num(params.roll, 0.4);
          uDensity.value = num(params.density, 0.5);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'roll') uRoll.value = num(value, 0.4);
          else if (id === 'density') uDensity.value = num(value, 0.5);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.fogRollUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
