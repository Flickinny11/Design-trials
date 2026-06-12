// sdf-shape-morph — the card's silhouette fluidly morphs through pure SDF
// shapes: rounded rect -> circle -> hexagon -> back, forever, while the
// surface keeps the subject's OWN look (map/color carried live). HARD / mask /
// GPU node-material primitive. TECHNIQUE: DESIGN-REFERENCES §8 (SDF primitives
// + boolean ops; iquilezles.org/articles/distfunctions): the three 2D SDFs
// (sdRoundedBox, sdCircle, sdHexagon) are evaluated in TSL on the subject's
// centered/aspect-corrected uv space; the live distance is a smooth-mix of the
// two CONSECUTIVE shape SDFs (weights eased CPU-side per seek — mixing SDF
// values is the classic shape-morph trick), and alpha = 1 - smoothstep(-soft,
// +soft, d) cuts the silhouette.
//
// DISTINCT from its mask/reveal neighbors:
//   - iris-wipe / diamond-wipe: a single FIXED shape grows once to reveal the
//     card and ends at full coverage. Here nothing is revealed — the silhouette
//     ITSELF is the animation, cycling through distinct geometric identities
//     with no full-card resting state.
//   - liquefy-reveal: gooey metaballs coalesce INTO the solid card one time.
//     Here the shapes are crisp geometric SDFs and the loop is endless.
//
// SUBJECT-LOOK-SACRED: the swapped MeshStandardNodeMaterial samples the
// subject's texture map by REFERENCE (via .map -> the node material's built-in
// color pipeline) and copies its color/emissive/PBR scalars; every seek
// re-checks the live material and rebinds if the host poured a new map or a
// whole new material instance (mounted artifacts pour textures ASYNCHRONOUSLY
// after attach). Handles both a Mesh subject (card panel) and a Group subject
// (MSDF text-object: every descendant glyph mesh morphs in its own uv frame,
// shape radii fitted to each mesh's measured local aspect).

import { Color, Mesh, type Material, type Object3D, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  float,
  abs,
  length,
  min,
  max,
  dot,
  sign,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

// Shape ids and the dropdown's cycle sequences (consecutive pairs morph).
type ShapeId = 'rect' | 'circle' | 'hex';
const SHAPE_SETS: Record<string, ReadonlyArray<ShapeId>> = {
  tour: ['rect', 'circle', 'hex'],
  'rect-circle': ['rect', 'circle'],
  'circle-hex': ['circle', 'hex'],
};

// Shape extents in "half-height units" (subject uv y spans ±0.5). The rect
// hugs the card; circle/hex are deliberately tighter so each identity reads
// as a clearly different silhouette mid-tour.
const RECT_BX = 0.42; // × aspect
const RECT_BY = 0.4;
const RECT_R = 0.1;
const CIRC_R = 0.4; // × min(aspect, 1) so narrow subjects keep a true circle
const HEX_R = 0.44; // apothem, × min(aspect, 1)

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 0.75 },
  { id: 'smoothness', label: 'Smoothness', type: 'knob', min: 0.1, max: 1, step: 0.01, default: 0.6 },
  { id: 'softness', label: 'Edge Soft', type: 'knob', min: 0.002, max: 0.15, step: 0.002, default: 0.018 },
  {
    id: 'shapes',
    label: 'Shapes',
    type: 'dropdown',
    options: [
      { value: 'tour', label: 'Rect / Circle / Hex' },
      { value: 'rect-circle', label: 'Rect / Circle' },
      { value: 'circle-hex', label: 'Circle / Hex' },
    ],
    default: 'tour',
  },
  { id: 'size', label: 'Size', type: 'knob', min: 0.7, max: 1.1, step: 0.01, default: 1 },
] as const;

/** Collect the meshes a mask material applies to: the subject Mesh itself, or
 *  every descendant Mesh when the subject is a Group (MSDF text-object). */
const collectMeshes = (root: Object3D | null): Mesh[] => {
  if (!root) return [];
  if ((root as Mesh).isMesh) return [root as Mesh];
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
};

/** Width/height aspect measured from the mesh's own geometry bounds (the
 *  subject's LOCAL frame — never hardcoded world units). */
const measureAspect = (mesh: Mesh): number => {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return 1;
  const w = bb.max.x - bb.min.x;
  const h = bb.max.y - bb.min.y;
  return w > 1e-6 && h > 1e-6 ? w / h : 1;
};

// Defensive view of whatever material the subject is wearing right now.
type SourceLook = Material &
  Partial<{
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
    envMapIntensity: number;
    opacity: number;
    map: Texture | null;
  }>;

export const sdfShapeMorphPrimitive: PrimitiveDefinition = {
  name: 'sdf-shape-morph',
  label: 'SDF Shape Morph',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card silhouette fluidly morphs through pure SDF shapes — rounded rect to circle to hexagon and back — while its own surface look rides along.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sdf-shape-morph', category: 'mask', schema: SCHEMA },
    (target, params) => {
      // Shared mask uniforms: per-shape smooth-mix weights (CPU-eased), edge
      // softness, and silhouette scale. Shared across every masked mesh.
      const uWRect = uniform(1);
      const uWCirc = uniform(0);
      const uWHex = uniform(0);
      const uSoft = uniform(clamp(num(params.softness, 0.018), 0.002, 0.15));
      const uSize = uniform(clamp(num(params.size, 1), 0.7, 1.1));

      // TSL intermediate-node type (mirrors splat-reveal / liquefy-reveal) —
      // sidesteps the narrow fluent return types under strict tsc.
      type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

      /** Silhouette mask (1 inside -> 0 outside) for one mesh: the weighted
       *  smooth-mix of the three §8 SDFs in centered, aspect-corrected uv. */
      const buildMaskNode = (aspect: number): TNode => {
        const uAspect = float(aspect);
        const fit = float(Math.min(aspect, 1));
        const u = uv();
        // p: x in ±aspect/2, y in ±0.5 — shapes stay shape-true, not stretched.
        const px: TNode = u.x.sub(0.5).mul(uAspect);
        const py: TNode = u.y.sub(0.5);

        // sdRoundedBox (iquilez): q = |p| - b + r; len(max(q,0)) + min(max(q),0) - r
        const bx: TNode = uAspect.mul(RECT_BX).mul(uSize);
        const by: TNode = float(RECT_BY).mul(uSize);
        const rr: TNode = min(float(RECT_R).mul(uSize), min(bx, by).mul(0.9));
        const qx: TNode = abs(px).sub(bx.sub(rr));
        const qy: TNode = abs(py).sub(by.sub(rr));
        const dRect: TNode = length(vec2(max(qx, float(0)), max(qy, float(0))))
          .add(min(max(qx, qy), float(0)))
          .sub(rr);

        // sdCircle: length(p) - r
        const dCirc: TNode = length(vec2(px, py)).sub(float(CIRC_R).mul(uSize).mul(fit));

        // sdHexagon (iquilez, flat-top): fold by k, clamp the edge run, signed dist.
        const hr: TNode = float(HEX_R).mul(uSize).mul(fit);
        const kxy = vec2(-0.866025404, 0.5);
        const pa: TNode = abs(vec2(px, py));
        const fold: TNode = min(dot(kxy, pa), float(0)).mul(2);
        const p2: TNode = pa.sub(kxy.mul(fold));
        const cx: TNode = tslClamp(p2.x, hr.mul(-0.577350269), hr.mul(0.577350269));
        const p3: TNode = vec2(p2.x.sub(cx), p2.y.sub(hr));
        const dHex: TNode = length(p3).mul(sign(p3.y));

        // Smooth-mix of consecutive shapes: weights are CPU-eased so exactly
        // two are nonzero at any t; mixing SDF values morphs the silhouette.
        const d: TNode = dRect.mul(uWRect).add(dCirc.mul(uWCirc)).add(dHex.mul(uWHex));
        return float(1).sub(smoothstep(uSoft.negate(), uSoft, d));
      };

      interface Tracked {
        mesh: Mesh;
        mat: MeshStandardNodeMaterial;
        src: Material; // live source material — restored on dispose
        uBaseOpacity: ReturnType<typeof uniform>;
      }

      /** Carry the source material's look into the mask material. The map is
       *  shared by REFERENCE (never cloned/owned); a map change rebuilds the
       *  node graph so the poured texture actually renders. */
      const copyLook = (entry: Tracked): void => {
        const s = entry.src as SourceLook;
        if (s.color instanceof Color) entry.mat.color.copy(s.color);
        if (s.emissive instanceof Color) entry.mat.emissive.copy(s.emissive);
        if (typeof s.emissiveIntensity === 'number') entry.mat.emissiveIntensity = s.emissiveIntensity;
        if (typeof s.roughness === 'number') entry.mat.roughness = s.roughness;
        if (typeof s.metalness === 'number') entry.mat.metalness = s.metalness;
        if (typeof s.envMapIntensity === 'number') entry.mat.envMapIntensity = s.envMapIntensity;
        entry.uBaseOpacity.value = typeof s.opacity === 'number' ? s.opacity : 1;
        const srcMap = (s.map ?? null) as Texture | null;
        const holder = entry.mat as unknown as { map: Texture | null };
        if (holder.map !== srcMap) {
          holder.map = srcMap;
          entry.mat.needsUpdate = true;
        }
      };

      const tracked: Tracked[] = collectMeshes(target.subject).map((mesh) => {
        const uBaseOpacity = uniform(1);
        const mat = new MeshStandardNodeMaterial({ transparent: true });
        const mask = buildMaskNode(measureAspect(mesh));
        (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(uBaseOpacity);
        const entry: Tracked = { mesh, mat, src: mesh.material as Material, uBaseOpacity };
        copyLook(entry);
        mesh.material = mat;
        return entry;
      });

      /** Re-check every live material: if the host re-poured a whole new
       *  material instance, adopt its look and re-take the mask slot; always
       *  re-sync color/map (textures land asynchronously after attach). */
      const syncSourceLook = (): void => {
        for (const e of tracked) {
          const live = e.mesh.material;
          if (live !== e.mat && live && !Array.isArray(live)) {
            e.src = live as Material;
            e.mesh.material = e.mat;
          }
          copyLook(e);
        }
      };

      // CPU-side cycle phase -> eased per-shape weights. `smoothness` is the
      // fraction of each segment spent morphing (hold-and-glide: the shape
      // holds its identity for 1-k, then glides into the next over k).
      let lastT = 0;
      // Chrome co-treatment (W1 art pass 2026-06-12): the card's chrome
      // children (header bar / dot / rows — children OF the subject mesh) are
      // NOT part of the masked face material, so they floated full-strength
      // over the morphing silhouette (brass header sticking past the hexagon).
      // Chrome belongs to the RECTANGLE identity: fade it with the rect shape
      // weight, so it melts away as the silhouette departs and returns with it.
      interface ChromeSnap {
        mat: Material & { opacity: number };
        opacity: number;
        transparent: boolean;
      }
      const chrome: ChromeSnap[] = [];
      if ((target.subject as Mesh | null)?.isMesh) {
        const seenChrome = new Set<Material>();
        for (const child of target.subject!.children) {
          child.traverse((o) => {
            const m = (o as Mesh).material;
            if (!m) return;
            for (const mat of Array.isArray(m) ? m : [m]) {
              if (seenChrome.has(mat)) continue;
              seenChrome.add(mat);
              chrome.push({
                mat: mat as Material & { opacity: number },
                opacity: (mat as Material & { opacity: number }).opacity,
                transparent: mat.transparent,
              });
            }
          });
        }
      }
      const fadeChrome = (wRect: number): void => {
        for (const c of chrome) {
          if (!c.mat.transparent) c.mat.transparent = true;
          c.mat.opacity = c.opacity * wRect;
        }
      };

      const applyWeights = (t: number): void => {
        const seq = SHAPE_SETS[str(params.shapes, 'tour')] ?? SHAPE_SETS.tour;
        const speed = clamp(num(params.speed, 0.75), 0.05, 5);
        const k = clamp(num(params.smoothness, 0.6), 0.05, 1);
        const segs = seq.length;
        const pos = (((t * speed) % segs) + segs) % segs;
        const i = Math.floor(pos) % segs;
        const f = pos - Math.floor(pos);
        const holdSpan = 1 - k;
        const lin = f <= holdSpan ? 0 : clamp((f - holdSpan) / k, 0, 1);
        const blend = lin * lin * (3 - 2 * lin); // smoothstep ease — fluid glide
        const w: Record<ShapeId, number> = { rect: 0, circle: 0, hex: 0 };
        w[seq[i]] += 1 - blend;
        w[seq[(i + 1) % segs]] += blend;
        uWRect.value = w.rect;
        uWCirc.value = w.circle;
        uWHex.value = w.hex;
        fadeChrome(w.rect);
      };
      applyWeights(0);

      // CPU-observable handles for the host/tests (no renderer needed).
      target.userData.sdfMorphWeights = { rect: uWRect, circle: uWCirc, hex: uWHex };
      target.userData.sdfMorphSoftness = uSoft;
      target.userData.sdfMorphSize = uSize;

      return {
        // Endless silhouette loop — stateful, so Infinity (t drives the cycle).
        duration: () => Infinity,
        seek: (t) => {
          lastT = t;
          syncSourceLook();
          applyWeights(t);
          // Read scalar params live so control changes apply without a rebuild.
          uSoft.value = clamp(num(params.softness, 0.018), 0.002, 0.15);
          uSize.value = clamp(num(params.size, 1), 0.7, 1.1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Apply immediately: the CONTROLS gate tweaks while paused at t=1s.
          if (id === 'softness') uSoft.value = clamp(num(value, 0.018), 0.002, 0.15);
          else if (id === 'size') uSize.value = clamp(num(value, 1), 0.7, 1.1);
          else applyWeights(lastT); // speed / smoothness / shapes re-phase the cycle
        },
        dispose: () => {
          for (const e of tracked) {
            // Restore the LATEST source material (covers mid-flight re-pours).
            e.mesh.material = e.src;
            // Drop the shared map reference before disposing — the subject's
            // textures are never ours to dispose.
            (e.mat as unknown as { map: Texture | null }).map = null;
            e.mat.dispose();
          }
          tracked.length = 0;
          for (const c of chrome) {
            c.mat.opacity = c.opacity;
            c.mat.transparent = c.transparent;
          }
          chrome.length = 0;
          delete target.userData.sdfMorphWeights;
          delete target.userData.sdfMorphSoftness;
          delete target.userData.sdfMorphSize;
        },
      };
    },
  ),
};
