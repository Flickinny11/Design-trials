// gold-glint — a warm gold specular glint travels across the card surface and
// twinkles at its peak, like light raking polished gold. MEDIUM / TSL primitive.
// Swaps the host card's material for a MeshStandardNodeMaterial whose emissiveNode
// adds a warm-gold sweeping band:
//   band    = smoothstep(width, 0, abs(dot(uv, dir) - uSweep))
//   twinkle = 0.7 + 0.3 * sin(uTime * tw)
//   emissive += goldTint * band * twinkle * intensity
// seek() advances uSweep (the band position) and uTime (the twinkle). Distinct
// from a neutral light-sweep: warm gold tint + a twinkle at the band's peak.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, dot, abs, sin, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.04, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'twinkle', label: 'Twinkle Rate', type: 'knob', min: 0, max: 20, step: 0.5, default: 9 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#ffd479' },
] as const;

export const goldGlintPrimitive: PrimitiveDefinition = {
  name: 'gold-glint',
  label: 'Gold Glint',
  category: 'shimmer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A warm gold specular glint travels across the surface and twinkles at its peak, like light raking polished gold.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gold-glint', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#ffd479'));

      const uSweep = uniform(-1); // band position along the sweep direction
      const uTime = uniform(0); // drives the twinkle
      const uWidth = uniform(num(params.width, 0.16));
      const uIntensity = uniform(num(params.intensity, 1.4));
      const uTw = uniform(num(params.twinkle, 9));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Diagonal sweep direction (normalized) — a raking light.
      const dir = vec2(0.7071, 0.7071);
      const u = uv();
      // Signed distance of this fragment from the moving band centre.
      const along = dot(u, dir);
      const band = smoothstep(uWidth, float(0), abs(along.sub(uSweep)));
      const twinkle = float(0.7).add(sin(uTime.mul(uTw)).mul(0.3));
      const emissive = vec3(uR, uG, uB).mul(band).mul(twinkle).mul(uIntensity);

      const mat = new MeshStandardNodeMaterial({
        color: new Color('#3a2f12'),
        metalness: 0.85,
        roughness: 0.35,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into the shared scratch space so the host (and
      // tests) can observe the sweep/twinkle state without reading GPU pixels.
      target.userData.goldGlint = { uSweep, uTime, uWidth, uIntensity, uTw };

      // uSweep travels from -0.2 to ~1.6 (dot(uv,dir) spans 0..~1.414) so the
      // band fully enters and exits over one cycle.
      const SWEEP_LO = -0.2;
      const SWEEP_HI = 1.6;
      const PERIOD = 2.4; // seconds for one full sweep at speed=1

      return {
        // Looping/stateful effect: continuous across t.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 1);
          const cyc = ((t * speed) / PERIOD) % 1;
          uSweep.value = SWEEP_LO + (SWEEP_HI - SWEEP_LO) * cyc;
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uWidth.value = num(params.width, 0.16);
          uIntensity.value = num(params.intensity, 1.4);
          uTw.value = num(params.twinkle, 9);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'width') uWidth.value = num(value, 0.16);
          else if (id === 'intensity') uIntensity.value = num(value, 1.4);
          else if (id === 'twinkle') uTw.value = num(value, 9);
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
