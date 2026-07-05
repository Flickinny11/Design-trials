// ice-glass — frosted crystalline ice: the host card's material is swapped for a
// semi-transmissive MeshPhysicalNodeMaterial with a cold blue attenuation tint.
// Its normalNode is perturbed by a faceted/cellular crack field (layered sin
// "voronoi-ish" cells) so the surface reads as a cracked frozen pane of ice
// crystal facets — DISTINCT from frosted-glass (which is a smooth roughness
// sweep). A `uFrost` uniform grows over time: frost creeps in, lifting roughness
// and the crack density / normal-perturbation strength so the ice freezes harder
// the longer it plays. HARD / GPU (glass) primitive.
//
// seek() advances uFrost (a 0->1->0 triangle over the loop, so a mid frame
// differs from t=0 AND the settled end) and reads the knobs live; onParamChange
// mirrors the structural uniforms. dispose() restores prevMat and disposes the
// swapped material. uFrost.value is the load-bearing CPU-observable.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  normalLocal,
  float,
  sin,
  cos,
  dot,
  fract,
  floor,
  vec2,
  vec3,
  mix,
  abs,
  max,
  clamp as tslClamp,
  normalize,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'frost', label: 'Frost', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.7 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#bcdcff' },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.1, max: 2, step: 0.05, default: 0.8 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
] as const;

export const iceGlassPrimitive: PrimitiveDefinition = {
  name: 'ice-glass',
  label: 'Ice Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Frosted crystalline ice — semi-transmissive with a cracked/faceted frozen normal and a cold blue tint, frost creeping over time.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ice-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      // Swap the card's panel mesh material. Card subject exposes the panel Mesh.
      const mesh = (target.subject as Mesh) ?? null;

      const [tr, tg, tb] = rgb(String(params.tint ?? '#bcdcff'));

      // uFrost: 0 (clear ice) -> 1 (deeply frozen) drives roughness and crack
      // density. This is the primitive's load-bearing observable.
      const uFrost = uniform(0);
      const uThickness = uniform(num(params.thickness, 0.8));
      const uTintR = uniform(tr);
      const uTintG = uniform(tg);
      const uTintB = uniform(tb);

      // ── Faceted / cellular crack field ──────────────────────────────────
      // A "voronoi-ish" cell value from a deterministic hash of the floored
      // position grid, plus a layered-sin web for the crack seams. Crack
      // density grows with uFrost so more facets appear as it freezes.
      const baseScale = float(7.0);
      const scale = baseScale.add(uFrost.mul(9.0)); // denser facets when frozen
      const p = vec2(positionLocal.x, positionLocal.y).mul(scale);

      // Hash of the cell index -> a stable per-cell value (deterministic, no RNG).
      const cell = floor(p);
      const cellHash = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453));

      // Layered sin "crack seams": where the combined sine web crosses zero we get
      // dark hairline cracks between the crystal facets.
      const f = fract(p).sub(0.5);
      const seam = abs(
        sin(f.x.mul(6.2831).add(cellHash.mul(6.2831)))
          .add(sin(f.y.mul(6.2831).sub(cellHash.mul(4.1)))),
      );
      const crackMask = tslClamp(float(1.2).sub(seam), float(0), float(1));

      // ── Perturbed normal (the crystal facets) ───────────────────────────
      // Push the local normal sideways by the gradient-ish direction of the crack
      // field, scaled by frost (stronger faceting as it freezes). cos/sin of the
      // hashed cell gives a per-facet tilt direction so facets point differently.
      const dirAngle = cellHash.mul(6.2831);
      const tilt = vec3(cos(dirAngle), sin(dirAngle), float(0.0))
        .mul(crackMask)
        .mul(uFrost.mul(0.8).add(0.15));
      const perturbed = normalize(normalLocal.add(tilt));

      // ── Cold blue tint + crack darkening on the surface color ───────────
      // Base panel reads through transmission; we add a cold-blue cast that
      // intensifies with frost, and darken the crack seams slightly.
      const coldTint = vec3(uTintR, uTintG, uTintB);
      const iceBase = mix(vec3(0.10, 0.16, 0.28), coldTint, uFrost.mul(0.9).add(0.1));
      const colorNode = iceBase.mul(float(1.0).sub(crackMask.mul(0.35)));

      // ── Roughness: clear-ish ice when un-frosted, frosty when frozen ────
      // Mid roughness baseline (frosty) that climbs with uFrost, with the crack
      // seams reading rougher than the facet faces.
      const roughNode = tslClamp(
        mix(float(0.18), float(0.62), uFrost).add(crackMask.mul(0.18)),
        float(0.04),
        float(0.95),
      );

      // ── Emissive cold rim sparkle on the crack seams ────────────────────
      const emissiveNode = vec3(0.55, 0.72, 1.0).mul(crackMask.mul(max(uFrost, float(0.2))).mul(0.5));

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 0.85,
        thickness: 0.8,
        ior: 1.31, // ice IOR
        metalness: 0.0,
        envMapIntensity: 1.25,
      });
      // Cold blue attenuation tint inside the glass body.
      mat.attenuationColor = new Color(tr, tg, tb);
      mat.attenuationDistance = 0.9;

      (mat as unknown as { normalNode: unknown }).normalNode = perturbed;
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { roughnessNode: unknown }).roughnessNode = roughNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handle to the host scratch space (contract: userData is
      // "Scratch space shared with the host (uniform handles, etc.)").
      target.userData.uFrost = uFrost;

      // Loop period in seconds; uFrost traces 0->1->0 (frost creeps in, then
      // thaws) across it so a mid frame differs from both endpoints.
      const PERIOD = 4;

      const applyFrost = (t: number) => {
        const speed = num(params.speed, 1);
        const frostMax = num(params.frost, 0.7);
        const cycle = (t * speed) / PERIOD;
        const tri = 1 - Math.abs((((cycle % 1) + 1) % 1) - 0.5) * 2; // 0->1->0
        uFrost.value = tri * frostMax;
        uThickness.value = num(params.thickness, 0.8);
        // thickness is read live and pushed to the material body.
        (mat as unknown as { thickness: number }).thickness = num(params.thickness, 0.8);
      };

      return {
        // Continuous frost-creep loop → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (t) => applyFrost(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'thickness') {
            uThickness.value = num(value, 0.8);
            (mat as unknown as { thickness: number }).thickness = num(value, 0.8);
          } else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uTintR.value = r;
            uTintG.value = g;
            uTintB.value = b;
            mat.attenuationColor = new Color(r, g, b);
          }
          // frost + speed are read live in seek(); no structural mirror needed.
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
