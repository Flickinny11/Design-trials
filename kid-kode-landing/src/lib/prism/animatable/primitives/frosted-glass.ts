// frosted-glass — frost creeps across a transmissive glass sphere: a roughness
// sweep clouds it from clear to frosted and back over the loop. HARD / GPU
// primitive (glass). Swaps the host sphere's material for a
// MeshPhysicalNodeMaterial with transmission; its roughnessNode is a smoothstep
// front sweeping across position.y, driven by a `uFront` uniform that goes
// 0->1->0 each loop. A deterministic value-noise grain roughens the frosted
// band so it reads as ground glass, not a flat gradient. seek() advances uFront
// (and reads knob params live); onParamChange() mirrors the structural uniforms.

import { Mesh, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  float,
  smoothstep,
  sin,
  dot,
  fract,
  vec2,
  mix,
  clamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'frostiness', label: 'Frostiness', type: 'knob', min: 0.1, max: 1, step: 0.01, default: 0.9 },
  { id: 'grain', label: 'Grain', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.4 },
] as const;

export const frostedGlassPrimitive: PrimitiveDefinition = {
  name: 'frosted-glass',
  label: 'Frosted Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'sphere',
  defaultDriver: 'time',
  description:
    'Frost creeps across the glass, a roughness sweep clouding it from clear to frosted and back.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'frosted-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // uFront: the leading edge of the frost band, sweeping bottom->top->bottom.
      const uFront = uniform(0);
      const uFrostiness = uniform(num(params.frostiness, 0.9));
      const uGrain = uniform(num(params.grain, 0.4));

      // Map local Y (sphere radius ~0.82) into a 0..1 vertical coordinate.
      const yNorm = positionLocal.y.mul(0.61).add(0.5);

      // The frost band: clear (0) below the front, frosted (1) above it, with a
      // soft smoothstep edge so frost "creeps" rather than snapping.
      const edge = float(0.22);
      const band = smoothstep(uFront.sub(edge), uFront.add(edge), yNorm);

      // Deterministic value-noise grain keyed off local position — no RNG.
      const p = vec2(positionLocal.x.mul(9.0), positionLocal.y.mul(9.0));
      const noise = fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
      const grainTerm = noise.sub(0.5).mul(uGrain).mul(band);

      // Final roughness: base clear-glass roughness lifted toward `frostiness`
      // inside the band, then perturbed by grain. Clamp to a valid [0,1] range.
      const baseRough = float(0.04);
      const rough = clamp(
        mix(baseRough, uFrostiness, band).add(grainTerm),
        float(0.0),
        float(1.0),
      );

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 1.0,
        thickness: 0.6,
        ior: 1.45,
        metalness: 0.0,
        envMapIntensity: 1.2,
      });
      (mat as unknown as { roughnessNode: unknown }).roughnessNode = rough;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles to the host scratch space (contract: userData is
      // "Scratch space shared with the host (uniform handles, etc.)"). The front
      // sweep is the load-bearing observable for this primitive.
      target.userData.uFront = uFront;
      target.userData.uFrostiness = uFrostiness;
      target.userData.uGrain = uGrain;

      // Loop period in seconds; uFront traces 0->1->0 across it.
      const PERIOD = 4;

      const applyFront = (t: number) => {
        const speed = num(params.speed, 1);
        const cycle = (t * speed) / PERIOD;
        const tri = 1 - Math.abs(((cycle % 1) + 1) % 1 - 0.5) * 2; // 0->1->0 triangle
        uFront.value = tri;
        uFrostiness.value = num(params.frostiness, 0.9);
        uGrain.value = num(params.grain, 0.4);
      };

      return {
        // Continuous loop → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (t) => applyFront(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'frostiness') uFrostiness.value = num(value, 0.9);
          else if (id === 'grain') uGrain.value = num(value, 0.4);
          // speed is read live in seek(); no uniform to mirror.
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
