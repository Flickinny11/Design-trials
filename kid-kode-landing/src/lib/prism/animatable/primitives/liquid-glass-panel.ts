// liquid-glass-panel — Apple-style "liquid glass" CHROME surface via SCREEN-SPACE
// UV DISPLACEMENT (ORRERY No.7 §4 path C). The sibling `liquid-glass` primitive
// is a transmission=1 sphere (Path B — a per-object scene re-render the ≤2
// transmission budget caps). This one NEVER sets `transmission`: it swaps the
// host mesh's material for a MeshBasicNodeMaterial whose color samples the
// ALREADY-RENDERED framebuffer (`viewportSharedTexture` — one shared copy, no
// extra scene pass) at the fragment's screen position offset by a gentle
// procedural ripple. The result reads as frosted, refracting glass that costs
// nothing on the transmission budget, so it is the right surface for panels/nav
// chrome sitting on screen alongside the one true transmission hero (the crystal).
//
// MOUNTABLE: category 'glass' is normally skipped by attachAnimationBindings
// (UNMOUNTABLE_CATEGORIES) because glass primitives swap the subject material
// and depend on the catalog rig. This one is self-contained (no env/rig
// dependency — it samples the live framebuffer) and is designed to replace a
// chrome backing plate with no baked look to preserve, so it opts in with
// `mountable: true`.
//
// A high default `tint` weight keeps the surface legible (a solid dark frost
// behind labels) even where the sampled framebuffer is dark, honoring "always
// pair glass-over-text with adaptive tint" (§4).

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  cos,
  mix,
  clamp as tslClamp,
  screenUV,
  viewportSharedTexture,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'tintColor', label: 'Tint', type: 'color', default: '#10151f' },
  { id: 'tintAmount', label: 'Tint amount', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.62 },
  { id: 'displace', label: 'Displace', type: 'knob', min: 0, max: 0.08, step: 0.001, default: 0.018 },
  { id: 'frequency', label: 'Ripple freq', type: 'knob', min: 1, max: 24, step: 0.5, default: 9 },
  { id: 'opacity', label: 'Opacity', type: 'fader', min: 0.3, max: 1, step: 0.01, default: 0.92 },
] as const;

export const liquidGlassPanelPrimitive: PrimitiveDefinition = {
  name: 'liquid-glass-panel',
  label: 'Liquid Glass (panel)',
  category: 'glass',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  mountable: true,
  description:
    'Frosted "liquid glass" chrome via screen-space UV displacement — samples the rendered framebuffer (no transmission re-render), so it costs nothing on the ≤2 transmission budget.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'liquid-glass-panel', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDisplace = uniform(num(params.displace, 0.018));
      const uFreq = uniform(num(params.frequency, 9));
      const uTint = uniform(num(params.tintAmount, 0.62));
      const [tr, tg, tb] = rgb(str(params.tintColor, '#10151f'));
      const uTintR = uniform(tr);
      const uTintG = uniform(tg);
      const uTintB = uniform(tb);
      const uOpacity = uniform(num(params.opacity, 0.92));

      // Surface uv drives a gentle two-axis ripple; uTime breathes it so the
      // glass looks liquid. The ripple offsets the SCREEN uv we read the
      // background from, bending whatever is behind the panel.
      const u = uv();
      const wobX = sin(u.y.mul(uFreq).add(uTime)).mul(uDisplace);
      const wobY = cos(u.x.mul(uFreq).add(uTime.mul(0.8))).mul(uDisplace);
      const sampleUV = vec2(
        tslClamp(screenUV.x.add(wobX), float(0), float(1)),
        tslClamp(screenUV.y.add(wobY), float(0), float(1)),
      );
      // One shared framebuffer copy (NOT a per-object transmission render).
      const refracted = viewportSharedTexture(sampleUV).rgb;

      // Adaptive tint behind labels (legibility) + a soft bottom-to-top sheen so
      // the sheet reads as a beveled glass surface rather than a flat scrim.
      const tint = vec3(uTintR, uTintG, uTintB);
      const sheen = u.y.mul(0.1).add(0.02);
      const glass = mix(refracted, tint, uTint).add(sheen);

      const mat = new MeshBasicNodeMaterial();
      mat.transparent = true;
      (mat as unknown as { colorNode: unknown }).colorNode = vec4(glass, uOpacity);
      // Belt-and-braces scalar fallback (if the node graph is unsupported on a
      // backend): a dark frosted plate, never a transmission surface.
      mat.color = new Color(str(params.tintColor, '#10151f'));
      mat.opacity = num(params.opacity, 0.92);

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish driven uniforms for diagnostics/tests without reaching the graph.
      target.userData.liquidGlassPanel = { uTime, uDisplace, uFreq, uTint };

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'displace') uDisplace.value = num(value, 0.018);
          else if (id === 'frequency') uFreq.value = num(value, 9);
          else if (id === 'tintAmount') uTint.value = num(value, 0.62);
          else if (id === 'opacity') {
            uOpacity.value = num(value, 0.92);
            mat.opacity = num(value, 0.92);
          } else if (id === 'tintColor' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uTintR.value = r;
            uTintG.value = g;
            uTintB.value = b;
            mat.color = new Color(value);
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
