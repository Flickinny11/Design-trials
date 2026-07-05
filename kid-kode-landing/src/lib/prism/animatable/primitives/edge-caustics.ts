// edge-caustics — caustic light concentrates into bright crawling lines along
// the contours of a moving height field, like the rim-light at the edge of a
// ripple. HARD / GPU primitive. Swaps the host plane's material for a
// MeshStandardNodeMaterial whose emissiveNode lights up thin bright contour
// lines where a drifting 3-wave height field crosses its level sets. seek()
// advances a time uniform; onParamChange() updates the live uniforms. DISTINCT
// from caustic-net (a filament web) — this paints bright moving CONTOUR EDGES.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, fract, abs, pow, clamp } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'density', label: 'Density', type: 'knob', min: 1, max: 14, step: 0.1, default: 6 },
  { id: 'edgePow', label: 'Edge Sharpness', type: 'knob', min: 2, max: 8, step: 0.1, default: 4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#7fe9ff' },
] as const;

export const edgeCausticsPrimitive: PrimitiveDefinition = {
  name: 'edge-caustics',
  label: 'Edge Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Caustic light concentrates into bright crawling lines along contours, like the rim-light at the edge of a ripple.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'edge-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#7fe9ff'));
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uDensity = uniform(num(params.density, 6));
      const uEdgePow = uniform(num(params.edgePow, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Moving height field: three drifting sine waves at scaled, related
      // frequencies (a, b, c) summed. As time advances the field crawls.
      const u = uv();
      const t = uTime.mul(uSpeed);
      const a = uDensity;
      const b = uDensity.mul(1.21);
      const c = uDensity.mul(0.73);

      const h = sin(u.x.mul(a).add(t))
        .add(sin(u.y.mul(b).sub(t.mul(1.2))))
        .add(sin(u.x.add(u.y).mul(c).add(t.mul(0.7))));

      // Edge term: bright thin lines along the level sets of h. fract(h*0.5)
      // wraps the field into a sawtooth; |frac-0.5|*2 is a triangle that is 0
      // exactly on each contour and 1 between them; (1 - that) peaks ON the
      // contour, and pow(...) thins the peak into a crisp crawling line.
      const tri = abs(fract(h.mul(0.5)).sub(0.5)).mul(2);
      const edge: any = pow(clamp(float(1).sub(tri), float(0), float(1)), uEdgePow);

      const emissiveNode = vec3(uR, uG, uB).mul(edge);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles for the host/preview rig (CPU-observable).
      target.userData.edgeCaustics = { uTime, uSpeed, uDensity, uEdgePow };

      return {
        // Looping/stateful crawl: never settles, so duration is Infinity.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uDensity.value = num(params.density, 6);
          uEdgePow.value = num(params.edgePow, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'density') uDensity.value = num(value, 6);
          else if (id === 'edgePow') uEdgePow.value = num(value, 4);
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
