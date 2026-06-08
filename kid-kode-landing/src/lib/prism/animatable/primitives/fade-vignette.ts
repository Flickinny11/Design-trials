// fade-vignette — the card resolves from the center outward through a soft
// radial vignette, the edges arriving last. MEDIUM / fade primitive. Swaps the
// host card's material for a MeshStandardNodeMaterial whose opacityNode is a
// smoothstep over the radial distance from uv center: coverage grows from the
// center to the edges as uProgress advances 0 -> ~1.1. seek() advances the
// uProgress uniform; the `invert` toggle flips the gradient so edges arrive
// first. DISTINCT from iris-wipe (a hard radial cut) — this is a soft fade.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, length, smoothstep, float, vec2 } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.3 },
  { id: 'invert', label: 'Edges First', type: 'toggle', default: false },
] as const;

export const fadeVignettePrimitive: PrimitiveDefinition = {
  name: 'fade-vignette',
  label: 'Fade Vignette',
  category: 'fade',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card resolves from the center outward through a soft radial vignette, the edges arriving last.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fade-vignette', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uProgress = uniform(0);
      const uSoft = uniform(num(params.softness, 0.3));
      const uInvert = uniform(bool(params.invert, false) ? 1 : 0);

      // Radial coverage: 0 at center, ~1.4 at corners. radial = |uv - 0.5| * 2.
      const u = uv();
      const radial: any = length(u.sub(vec2(0.5, 0.5))).mul(2);
      // Optionally measure from the edge inward (corners -> center) when inverted.
      const measure: any = radial.mul(float(1).sub(uInvert)).add(
        float(1.4).sub(radial).mul(uInvert),
      );

      // smoothstep(edge0, edge1, x): with edge0 = progress + soft and
      // edge1 = progress, opacity is 1 inside the swept-in region (measure <=
      // progress) and falls off softly across the band. As progress grows from
      // 0 to ~1.1 the visible region expands center -> edges.
      const opacityNode: any = smoothstep(uProgress.add(uSoft), uProgress, measure);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles into the host's scratch space (contract:
      // userData is "scratch space shared with the host"). Lets the host /
      // tests observe the driven uProgress without rendering.
      target.userData.fadeVignette = { uProgress, uSoft, uInvert };

      const dur = () => num(params.duration, 1.4);

      const apply = (t: number) => {
        const p = clamp(t / dur(), 0, 1) * 1.1; // sweep to ~1.1 so edges fully clear
        uProgress.value = p;
        // Read params live so control changes apply without a rebuild.
        uSoft.value = num(params.softness, 0.3);
        uInvert.value = bool(params.invert, false) ? 1 : 0;
      };

      return {
        duration: dur,
        seek: (t) => apply(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'softness') uSoft.value = num(value, 0.3);
          else if (id === 'invert') uInvert.value = bool(value, false) ? 1 : 0;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
