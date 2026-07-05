// silhouette-glow-morph — the card collapses to a glowing tracery of its own
// edges, holds as a living outline, then refills with itself. HARD / mask
// primitive (DESIGN-REFERENCES §11 cookbook: edge detection in TSL — neighbor-
// texel luminance differences when the subject carries a texture, uv-rect
// border distance when it does not).
//
// Timeline (finite entrance morph, duration + hold controls):
//   collapse  — fill alpha drains 1→0 while a warm brass edge glow rises 0→1
//   hold      — outline-only beat; the glow carries a subtle deterministic
//               sine pulse so the tracery reads as ALIVE, not frozen
//   refill    — the card pours back in with ITS OWN look; glow extinguishes
//
// THE SUBJECT'S OWN LOOK IS SACRED: the swapped-in node material's colorNode
// samples the subject material's texture map when present (Texture shared by
// reference) and falls back to the subject material's own color — never an
// invented fill. Mounted artifacts pour `.map` ASYNCHRONOUSLY after attach and
// applyImageSpec may swap the mesh material outright, so every seek re-reads
// the live source: when the material instance OR its map identity changes, the
// mask material is rebuilt from the live source and re-applied (the
// scroll-stagger-rise late-pour pattern). Chrome children co-fade with the
// fill (snapshot/restore) so the WHOLE card collapses to tracery, not just the
// panel face. dispose() hands back the latest live source material and every
// touched chrome opacity/transparent flag exactly as found.
//
// DISTINCT from dissolve-burn (a value-noise threshold EATS the surface behind
// an advancing ember erosion front — here there is no erosion front at all:
// the whole fill drains in place while a structural tracery of the subject's
// own edges persists) and from fresnel-glow (a view-dependent rim light over
// an intact surface — here the surface itself collapses to outline and
// returns; the glow traces uv-space/texture edges, not grazing angles).
//
// Deterministic (phase + sine of t only, no Math.random), DOM-free, TSL-only
// (MeshStandardNodeMaterial; runs on WebGPU and the WebGL2 fallback). CPU-
// observable headless via target.userData.silhouetteGlow (uFill/uGlow/uEdgeW
// uniforms + rebuilds/hasMap bookkeeping).

import { Color, Mesh, type Material, type Object3D, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  dot,
  float,
  max,
  min,
  saturate,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const BRASS = '#cd9f55'; // Observatory-Brass accent (design-system brass-400)

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

/** Ease-in-out cubic — both morph halves accelerate then settle. */
const easeInOut = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 1, max: 6, step: 0.1, default: 3.2, unit: 's' },
  { id: 'hold', label: 'Hold Beat', type: 'fader', min: 0, max: 2, step: 0.05, default: 0.7, unit: 's' },
  { id: 'edgeWidth', label: 'Edge Width', type: 'knob', min: 0.01, max: 0.12, step: 0.005, default: 0.045 },
  { id: 'glow', label: 'Glow', type: 'color', default: BRASS },
] as const;

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  opacity: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
};

interface MatSnap {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

/** The appearance source: the first Mesh descendant (the subject itself when
 *  it is a Mesh). The subject may be a Group (MSDF text-object) — traverse,
 *  never assume Mesh. */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

export const silhouetteGlowMorphPrimitive: PrimitiveDefinition = {
  name: 'silhouette-glow-morph',
  label: 'Silhouette Glow Morph',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card collapses to a glowing brass tracery of its own edges, holds as a living outline, then refills with itself.',
  create: defineAnimatable(
    { name: 'silhouette-glow-morph', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const repMesh = findRepresentativeMesh(subject);

      // ── Shared uniforms (survive material rebuilds; tests observe them) ──
      const [gr0, gg0, gb0] = rgb(str(params.glow, BRASS));
      const uFill = uniform(1); // fill alpha 1 (solid) → 0 (outline only)
      const uGlow = uniform(0); // edge glow 0 → 1 (+ living pulse in the hold)
      const uEdgeW = uniform(clamp(num(params.edgeWidth, 0.045), 0.005, 0.2));
      const uEps = uniform(1 / 256); // texel-ish gradient sampling radius
      const uBaseA = uniform(1); // source material's own opacity, carried
      const uTR = uniform(1); // source tint (subject color — never invented)
      const uTG = uniform(1);
      const uTB = uniform(1);
      const uGR = uniform(gr0);
      const uGG = uniform(gg0);
      const uGB = uniform(gb0);

      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted-artifact factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Chrome co-fade snapshots (every mesh material except the panel) ──
      // The whole card must collapse to tracery; the header/dot/rows fade with
      // the fill and are handed back exactly as found on dispose.
      const chromeSnaps: MatSnap[] = [];
      if (repMesh) {
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || mesh === repMesh || !mesh.material) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of list) {
            chromeSnaps.push({
              mat: mat as Material & { opacity: number },
              opacity: (mat as Material & { opacity: number }).opacity,
              transparent: mat.transparent,
            });
          }
        });
      }

      // ── Mask material builder (DESIGN-REFERENCES §11: TSL edge fields) ──
      // Built once at create and REBUILT whenever the live source material or
      // its map identity changes (late texture pour / external swap).
      const buildMat = (src: MappedMaterial | null): MeshStandardNodeMaterial => {
        const map = (src?.map as Texture | null | undefined) ?? null;
        // Subject tint: the source material's own color. With a map present a
        // missing color stays neutral white (identity over the texture) — the
        // standard pipeline's map×color product, never an invented fill.
        const c = src?.color instanceof Color ? src.color : null;
        uTR.value = c ? c.r : 1;
        uTG.value = c ? c.g : 1;
        uTB.value = c ? c.b : 1;
        uBaseA.value = src && src.opacity > 0.01 ? src.opacity : 1;

        const u = uv();
        const tint = vec3(uTR, uTG, uTB);

        // Structural edge: distance to the nearest uv-rect border — the
        // subject's silhouette always traces, map or not.
        const dEdge = min(
          min(u.x, float(1).sub(u.x)),
          min(u.y, float(1).sub(u.y)),
        );
        const border = float(1).sub(smoothstep(uEdgeW.mul(0.55), uEdgeW, dEdge));

        // Cast through the vec3 alias to dodge strict TSL Var/Join typing
        // (the dissolve-burn / caustics node-assignment pattern).
        type N3 = ReturnType<typeof vec3>;
        let edge = border;
        let colorNode: N3 = tint;
        if (map) {
          // Texture-luminance gradient (fwidth-style neighbor differences):
          // sample 4 neighboring texels of the SHARED map (by reference) and
          // trace where luminance changes fast — the artifact's own interior
          // edges join the silhouette tracery.
          const lum = (uvN: ReturnType<typeof uv>) =>
            dot(texture(map, uvN).rgb, vec3(0.299, 0.587, 0.114));
          type UV = ReturnType<typeof uv>;
          const ex = vec2(uEps, 0);
          const ey = vec2(0, uEps);
          const gx = lum(u.add(ex) as unknown as UV).sub(lum(u.sub(ex) as unknown as UV));
          const gy = lum(u.add(ey) as unknown as UV).sub(lum(u.sub(ey) as unknown as UV));
          const grad = abs(gx).add(abs(gy));
          const texEdge = smoothstep(float(0.06), float(0.32), grad);
          edge = max(border, texEdge);
          colorNode = texture(map, u).rgb.mul(tint) as unknown as N3;
        }

        // Fill drains while edge tracery stays opaque under the rising glow;
        // emissive is the warm brass tracery itself.
        const glowMask = edge.mul(uGlow);
        const opacityNode = saturate(max(uFill, glowMask)).mul(uBaseA);
        const emissiveNode = vec3(uGR, uGG, uGB).mul(glowMask).mul(1.55);

        const mat = new MeshStandardNodeMaterial({ transparent: true });
        // Carry the subject's PBR feel so the refilled card matches itself.
        mat.roughness = typeof src?.roughness === 'number' ? src.roughness : 0.34;
        mat.metalness = typeof src?.metalness === 'number' ? src.metalness : 0.4;
        if (typeof src?.envMapIntensity === 'number') {
          (mat as unknown as { envMapIntensity: number }).envMapIntensity = src.envMapIntensity;
        }
        (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
        (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
        (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;
        return mat;
      };

      // ── Live-source bookkeeping ──────────────────────────────────────────
      let currentSource: MappedMaterial | null = liveSourceMaterial();
      let builtMap: Texture | null = (currentSource?.map as Texture | null | undefined) ?? null;
      let mat: MeshStandardNodeMaterial = buildMat(currentSource);
      if (repMesh) repMesh.material = mat;

      // Observable handle for the host/tests (dissolve-burn's uThreshold
      // pattern, extended with rebuild bookkeeping).
      const handle = { uFill, uGlow, uEdgeW, rebuilds: 0, hasMap: Boolean(builtMap) };
      target.userData.silhouetteGlow = handle;

      const syncEps = () => {
        // Gradient sampling radius: ~half the edge width, floored at one texel
        // of the live map (1/256 when dimensions are unknown).
        const img = (builtMap as { image?: { width?: number } } | null)?.image;
        const texel = img && typeof img.width === 'number' && img.width > 0 ? 1 / img.width : 1 / 256;
        uEps.value = Math.max(uEdgeW.value * 0.5, texel);
      };
      syncEps();

      const rebuild = () => {
        const old = mat;
        builtMap = (currentSource?.map as Texture | null | undefined) ?? null;
        mat = buildMat(currentSource);
        if (repMesh) repMesh.material = mat;
        old.dispose(); // ours only — the source material/map are never disposed
        handle.rebuilds += 1;
        handle.hasMap = Boolean(builtMap);
        syncEps();
      };

      return {
        duration: () => num(params.duration, 3.2),
        seek: (t) => {
          // 1) LIVE SOURCE RE-CHECK — textures pour asynchronously after
          // attach and materials get swapped outright; rebuild from the live
          // source the moment either identity changes.
          if (repMesh) {
            const live = liveSourceMaterial();
            if (live !== mat) {
              currentSource = live; // external swap: the new material IS the source
              rebuild();
            } else if (((currentSource?.map as Texture | null | undefined) ?? null) !== builtMap) {
              rebuild(); // late pour landed on the displaced source material
            }
          }

          // 2) Envelope: collapse → hold (outline) → refill.
          const dur = num(params.duration, 3.2);
          const hold = clamp(num(params.hold, 0.7), 0, dur * 0.6);
          const half = Math.max((dur - hold) / 2, 1e-4);
          const tc = clamp(t, 0, dur);

          let fill: number;
          let inHold = false;
          if (tc < half) {
            fill = 1 - easeInOut(tc / half); // collapse
          } else if (tc < half + hold) {
            fill = 0; // outline-only beat
            inHold = true;
          } else {
            fill = easeInOut((tc - half - hold) / half); // refill
          }

          // Living outline: a subtle deterministic sine pulse rides the glow
          // through the hold beat (sin of t — no randomness).
          const pulse = inHold ? 1 + 0.1 * Math.sin(2 * Math.PI * 1.4 * t) : 1;
          uFill.value = fill;
          uGlow.value = (1 - fill) * pulse;

          // Live numeric reads so control changes apply without a rebuild.
          uEdgeW.value = clamp(num(params.edgeWidth, 0.045), 0.005, 0.2);
          syncEps();

          // 3) Chrome co-fade: the card's bars/dot/rows drain and refill with
          // the panel so the hold beat is pure tracery.
          for (const snap of chromeSnaps) {
            if (!snap.mat.transparent) snap.mat.transparent = true;
            snap.mat.opacity = fill * snap.opacity;
          }
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'glow' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uGR.value = r;
            uGG.value = g;
            uGB.value = b;
          } else if (id === 'edgeWidth') {
            uEdgeW.value = clamp(num(value, 0.045), 0.005, 0.2);
            syncEps();
          }
        },
        dispose: () => {
          // Hand the LATEST live source back — only if the mesh still carries
          // our material (an even-later external owner wins otherwise).
          if (repMesh && currentSource && repMesh.material === mat) {
            repMesh.material = currentSource;
          }
          mat.dispose();
          for (const snap of chromeSnaps) {
            snap.mat.opacity = snap.opacity;
            snap.mat.transparent = snap.transparent;
          }
        },
      };
    },
  ),
};
