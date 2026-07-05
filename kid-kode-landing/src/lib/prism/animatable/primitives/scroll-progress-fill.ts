// scroll-progress-fill — a fill front sweeps across the card in proportion to
// scroll, like a progress bar driven by the page position. MEDIUM / scroll
// primitive (driver = scroll, NOT time). Swaps the card panel's material for a
// MeshStandardNodeMaterial whose colorNode/emissiveNode mix a fill tint into the
// base wherever the chosen axis coord < uProgress, with a soft leading edge
// (smoothstep over `softness`). uProgress is driven by userData.scroll, read in
// seek(). Distinct from time-driven mask wipes: nothing animates unless scroll
// moves.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, mix, smoothstep, sub, oneMinus } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    default: 'ltr',
    options: [
      { value: 'ltr', label: 'Left → Right' },
      { value: 'rtl', label: 'Right → Left' },
      { value: 'btt', label: 'Bottom → Top' },
      { value: 'ttb', label: 'Top → Bottom' },
    ],
  },
  { id: 'fillColor', label: 'Fill Color', type: 'color', default: '#5ad4ff' },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08 },
] as const;

/** Map a direction id to a uv-derived 0..1 coordinate node along the fill axis. */
function axisCoord(direction: string) {
  const u = uv();
  switch (direction) {
    case 'rtl':
      return oneMinus(u.x);
    case 'btt':
      return u.y;
    case 'ttb':
      return oneMinus(u.y);
    case 'ltr':
    default:
      return u.x;
  }
}

export const scrollProgressFillPrimitive: PrimitiveDefinition = {
  name: 'scroll-progress-fill',
  label: 'Scroll Progress Fill',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  description:
    'A fill front sweeps across the card in proportion to scroll, like a progress bar driven by the page position.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'scroll-progress-fill', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const baseMat = mesh ? (mesh.material as Material & {
        color?: Color;
        emissive?: Color;
      }) : null;

      // Base panel tint sampled once so the fill mixes over the real card color.
      const baseColor = baseMat?.color ? baseMat.color.clone() : new Color('#1b2444');
      const [br, bg, bb] = [baseColor.r, baseColor.g, baseColor.b];

      const [fr, fg, fb] = rgb(str(params.fillColor, '#5ad4ff'));

      const uProgress = uniform(0);
      const uSoftness = uniform(clamp(num(params.softness, 0.08), 0, 0.3));
      const uFr = uniform(fr);
      const uFg = uniform(fg);
      const uFb = uniform(fb);

      // coord along the fill axis (0..1). Fill amount = soft step rising as
      // coord passes below the progress front. A leading edge of width
      // `softness` is feathered via smoothstep(progress - soft, progress, coord)
      // inverted so coord < progress => filled.
      const coord = axisCoord(str(params.direction, 'ltr'));
      const lo = sub(uProgress, uSoftness);
      // edge -> 1 ahead of front (coord < lo), 0 behind (coord > progress)
      const edge = oneMinus(smoothstep(lo, uProgress, coord));

      const baseRGB = vec3(float(br), float(bg), float(bb));
      const fillRGB = vec3(uFr, uFg, uFb);
      const colorNode = mix(baseRGB, fillRGB, edge);
      // Emissive lights only the filled region so the front reads as a glow.
      const emissiveNode = fillRGB.mul(edge).mul(float(0.9));

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const readProgress = (): number => {
        const s = target.userData.scroll;
        return clamp(typeof s === 'number' && Number.isFinite(s) ? s : 0, 0, 1);
      };

      // Observable: the resolved fill front + its leading-edge low bound mirror
      // onto userData so the host/driver (and headless tests) can read the
      // scroll-driven state without poking the GPU uniforms.
      const ud = target.userData as Record<string, unknown>;
      const publish = (): void => {
        ud.scrollProgressFill = uProgress.value;
        ud.scrollProgressFillSoftness = uSoftness.value;
      };
      publish();

      return {
        // Scroll-driven: not a fixed timeline. Stateful/continuous.
        duration: () => Infinity,
        seek: () => {
          // Driven purely by scroll position (the scroll driver writes
          // userData.scroll); the master clock only triggers a re-read.
          uProgress.value = readProgress();
          uSoftness.value = clamp(num(params.softness, 0.08), 0, 0.3);
          const [r, g, b] = rgb(str(params.fillColor, '#5ad4ff'));
          uFr.value = r;
          uFg.value = g;
          uFb.value = b;
          publish();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'softness') {
            uSoftness.value = clamp(num(value, 0.08), 0, 0.3);
            ud.scrollProgressFillSoftness = uSoftness.value;
          } else if (id === 'fillColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uFr.value = r;
            uFg.value = g;
            uFb.value = b;
          }
          // `direction` reshapes the colorNode graph; a rebuild is required for
          // a new axis, but live re-seek keeps progress/softness/color reactive.
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
