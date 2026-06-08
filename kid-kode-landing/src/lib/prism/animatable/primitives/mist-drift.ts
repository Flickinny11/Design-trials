// mist-drift — a low, thin mist drifts slowly sideways across the scene: soft,
// near-transparent, ground-hugging haze. MEDIUM / GPU primitive (smoke). Swaps
// the host plane's material for a MeshBasicNodeMaterial whose opacityNode builds
// a low-alpha drifting haze concentrated low in the frame:
//   base = fbm(uv*scale + vec2(uTime*drift, uTime*0.05))   // slow sideways slip
//   env  = smoothstep(0.6, 0.0, uv.y)                        // denser near bottom
//   alpha = base * env * density                            // keep density low/hazy
// seek() advances the time uniform (continuous loop, duration Infinity).
//
// DISTINCT from `fog-roll` (a coherent advecting FRONT with a leading edge) and
// `dust-cloud` (discrete drifting motes): mist-drift is a CALM, ground-hugging
// haze with no front and no particles — a thin sheet that slips sideways and is
// densest along the floor of the frame.
//
// onParamChange() + live param reads keep the controls tweakable with no
// rebuild. Uniform handles are published on target.userData for CPU tests.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep, max, min } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.12 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.28 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const mistDriftPrimitive: PrimitiveDefinition = {
  name: 'mist-drift',
  label: 'Mist Drift',
  category: 'smoke',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A low, thin mist drifts slowly sideways across the scene — soft, near-transparent, ground-hugging haze.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'mist-drift', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uDensity = uniform(num(params.density, 0.28));
      const uScale = uniform(num(params.scale, 3));

      // ── value-noise + fbm (pure TSL, deterministic) ──────────────────────
      // Sin-hash value noise smoothed with bilinear blend of the 4 lattice
      // corners; fbm stacks a few octaves for a soft, wispy haze field.
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

      // Sideways drift: x carried by time*drift, with a barely-perceptible
      // vertical seep (time*0.05) so the sheet feels alive without rising.
      const u = uv();
      const t = uTime;
      const flow = vec2(t.mul(uDrift), t.mul(0.05));
      const base0 = u.mul(uScale).add(flow);

      let fbm: any = noise(base0).mul(0.55);
      fbm = fbm.add(noise(base0.mul(2).add(vec2(t.mul(uDrift.mul(0.6)), 0))).mul(0.3));
      fbm = fbm.add(noise(base0.mul(4).add(vec2(t.mul(uDrift.mul(0.35)), 0))).mul(0.15));

      // Ground-hugging envelope: dense near the bottom (uv.y -> 0), thinning to
      // nothing by mid-frame so the mist stays low and calm.
      const env = smoothstep(float(0.6), float(0.0), u.y);

      // Low-alpha haze: fbm gated by the floor envelope, scaled by density.
      const alpha: any = min(max(fbm.mul(env).mul(uDensity), float(0)), float(0.5));

      // Soft, near-white-grey tint; very slightly cool so it reads as haze.
      const colorNode = vec3(0.82, 0.85, 0.88);
      const opacityNode = alpha;

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.mistDriftUniforms = { uTime, uDrift, uDensity, uScale };

      return {
        // Continuous, calm drifting haze — runs off the time driver.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uDensity.value = num(params.density, 0.28);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'density') uDensity.value = num(value, 0.28);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.mistDriftUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
