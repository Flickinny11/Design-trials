// sdf-shape-morph — the card's silhouette fluidly morphs through pure SDF
// shapes: rounded rect -> circle -> hexagon -> back, forever, while the
// COMPOSITE card identity rides along. HARD / mask / GPU node-material
// primitive. TECHNIQUE: DESIGN-REFERENCES §8 (SDF primitives + boolean ops;
// iquilezles.org/articles/distfunctions): the three 2D SDFs (sdRoundedBox,
// sdCircle, sdHexagon) are evaluated in TSL on the subject's centered/
// aspect-corrected uv space; the live distance is a smooth-mix of the two
// CONSECUTIVE shape SDFs (weights eased CPU-side per seek — mixing SDF values
// is the classic shape-morph trick), and alpha = 1 - smoothstep(-soft, +soft,
// d) cuts the silhouette.
//
// SINGLE-SILHOUETTE GUARANTEE (W1 advocate fix, 2026-06-12): the per-seek
// weights are a CONVEX combination (each >= 0, sum == 1 — applyState assigns
// 1-blend / blend to two consecutive shapes). All three SDFs are exact signed
// distances of CONVEX sets, hence convex functions; a convex combination of
// convex functions is convex, so the sub-zero set {d < 0} is convex —
// connected. The weighted mix can NEVER produce two disjoint silhouettes.
//
// SURFACE TREATMENT (W1 advocate fix — "circle/hex states are featureless
// dark fills"): the silhouette is a designed object, not a flat cutout.
//   - colorNode = live source map (rebindable TextureNode, metaball-merge
//     pattern) x carried source color x an inner-distance shade gradient
//     (darker at the SDF edge -> brighter deep inside) for volume.
//   - emissiveNode = carried source emissive + a soft brass rim glow riding
//     the |d| edge band (design-world brass, same constant as metaball-merge),
//     scaled by the Edge Glow control.
//   - roughness/metalness/envMapIntensity copied live so the face still
//     shades under the rig lighting (PBR look carried, never a flat sheet).
//
// CHROME CO-TREATMENT (W1 advocate fix — "mid-morph reads as a double
// exposure"; pattern proven by metaball-merge): the card's chrome children
// (brass header, ice dot, grey rows — parented to the subject mesh) are
// treated by the SAME morphing SDF, twice over:
//   - GPU: each chrome child's material is swapped for a node material whose
//     opacityNode evaluates the live mixed SDF at the fragment's PANEL-frame
//     position (positionLocal + measured child offset, scaled by the panel's
//     Box3 height) — chrome is clipped per-pixel by the silhouette, so a bar
//     end can never poke past the hexagon.
//   - CPU: every applyState evaluates the mixed SDF at each chrome child's
//     CENTER (panel-frame px-space from measured bounds) and drives a per-
//     child cover uniform = baseOpacity x coverage, with the smoothing width
//     widened to the child's half-extent so wide bars fade as the front
//     passes their center. Chrome appears/disappears exactly with the
//     silhouette — it never floats over a hidden face.
//
// DISTINCT from its mask/reveal neighbors:
//   - iris-wipe / diamond-wipe: a single FIXED shape grows once to reveal the
//     card and ends at full coverage. Here nothing is revealed — the silhouette
//     ITSELF is the animation, cycling through distinct geometric identities
//     with no full-card resting state.
//   - liquefy-reveal: gooey metaballs coalesce INTO the solid card one time.
//     Here the shapes are crisp geometric SDFs and the loop is endless.
//
// SUBJECT-LOOK-SACRED: every seek re-checks the live material and rebinds if
// the host poured a new map or a whole new material instance (mounted
// artifacts pour textures ASYNCHRONOUSLY after attach). Handles both a Mesh
// subject (card panel + chrome children) and a Group subject (MSDF
// text-object: every descendant glyph mesh morphs in its own uv frame, shape
// radii fitted to each mesh's measured local aspect).

import {
  Color,
  DataTexture,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  abs,
  length,
  min,
  max,
  dot,
  sign,
  smoothstep,
  positionLocal,
  texture,
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

// Surface-treatment constants (W1 art pass).
const RIM_W = 0.05; // |d| band width of the brass edge glow (half-height units)
const INNER_DEPTH = 0.16; // inner-distance over which the volume shade brightens
const BRASS = [0.83, 0.63, 0.36] as const; // design-world brass (metaball-merge)

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
  { id: 'glow', label: 'Edge Glow', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.85 },
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

interface ShapeWeights {
  rect: number;
  circle: number;
  hex: number;
}

/** CPU smoothstep mirror (chrome co-treatment coverage eval). */
const sstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** CPU mirror of the TSL SDF mix below — MUST stay in lockstep with
 *  buildSdfNode (same constants, same ops) so the chrome co-treatment's
 *  coverage agrees with the rendered silhouette. */
const cpuMixedSdf = (
  px: number,
  py: number,
  w: ShapeWeights,
  size: number,
  aspect: number,
): number => {
  const fit = Math.min(aspect, 1);
  // sdRoundedBox
  const bx = aspect * RECT_BX * size;
  const by = RECT_BY * size;
  const rr = Math.min(RECT_R * size, Math.min(bx, by) * 0.9);
  const qx = Math.abs(px) - (bx - rr);
  const qy = Math.abs(py) - (by - rr);
  const dRect =
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  // sdCircle
  const dCirc = Math.hypot(px, py) - CIRC_R * size * fit;
  // sdHexagon
  const hr = HEX_R * size * fit;
  const kx = -0.866025404;
  const ky = 0.5;
  let ax = Math.abs(px);
  let ay = Math.abs(py);
  const fold = Math.min(kx * ax + ky * ay, 0) * 2;
  ax -= kx * fold;
  ay -= ky * fold;
  const cl = Math.min(Math.max(ax, -0.577350269 * hr), 0.577350269 * hr);
  const p3x = ax - cl;
  const p3y = ay - hr;
  const dHex = Math.hypot(p3x, p3y) * Math.sign(p3y);
  return dRect * w.rect + dCirc * w.circle + dHex * w.hex;
};

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
      // softness, silhouette scale, rim-glow strength. Shared across every
      // masked mesh AND every co-treated chrome child.
      const uWRect = uniform(1);
      const uWCirc = uniform(0);
      const uWHex = uniform(0);
      const uSoft = uniform(clamp(num(params.softness, 0.018), 0.002, 0.15));
      const uSize = uniform(clamp(num(params.size, 1), 0.7, 1.1));
      const uGlow = uniform(clamp(num(params.glow, 0.85), 0, 2));

      // TSL intermediate-node type (mirrors splat-reveal / liquefy-reveal) —
      // sidesteps the narrow fluent return types under strict tsc.
      type TNode = any; // eslint-disable-line @typescript-eslint/no-explicit-any

      /** Live mixed SDF at a point in centered, aspect-corrected px-space
       *  (x in ±aspect/2, y in ±0.5). Used by the face materials (uv-driven)
       *  and the chrome materials (positionLocal-driven) — ONE silhouette
       *  cuts the whole composite. CPU mirror: cpuMixedSdf (keep in lockstep). */
      const buildSdfNode = (px: TNode, py: TNode, aspect: number): TNode => {
        const uAspect = float(aspect);
        const fit = float(Math.min(aspect, 1));

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
        // Convex combination of convex SDFs -> always ONE connected silhouette.
        return dRect.mul(uWRect).add(dCirc.mul(uWCirc)).add(dHex.mul(uWHex));
      };

      /** Silhouette mask (1 inside -> 0 outside) from a mixed SDF value. */
      const maskOf = (d: TNode): TNode => float(1).sub(smoothstep(uSoft.negate(), uSoft, d));

      // Owned 1×1 white fallback so the texture lane is a no-op multiply when
      // the live source is map-less (catalog card) — carried color + the shade
      // gradient + rig lighting carry the look (metaball-merge pattern).
      const fallbackTex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      fallbackTex.needsUpdate = true;

      interface Tracked {
        mesh: Mesh;
        mat: MeshStandardNodeMaterial;
        src: Material; // live source material — restored on dispose
        uBaseOpacity: ReturnType<typeof uniform>;
        // Carried look lanes (per mesh — text glyphs alternate ice/brass).
        uCR: ReturnType<typeof uniform>;
        uCG: ReturnType<typeof uniform>;
        uCB: ReturnType<typeof uniform>;
        uER: ReturnType<typeof uniform>;
        uEG: ReturnType<typeof uniform>;
        uEB: ReturnType<typeof uniform>;
        mapNode: TNode; // rebindable TextureNode (shared by REFERENCE)
        boundMap: Texture | null; // null = fallback bound
      }

      /** Carry the source material's look into the mask material. The map is
       *  shared by REFERENCE (never cloned/owned) through the rebindable
       *  TextureNode; color/emissive flow through carried uniforms so the
       *  colorNode/emissiveNode pipelines stay live without a rebuild. */
      const copyLook = (entry: Tracked): void => {
        const s = entry.src as SourceLook;
        if (s.color instanceof Color) {
          entry.mat.color.copy(s.color); // kept truthful for host inspection
          entry.uCR.value = s.color.r;
          entry.uCG.value = s.color.g;
          entry.uCB.value = s.color.b;
        }
        if (s.emissive instanceof Color) {
          const ei = typeof s.emissiveIntensity === 'number' ? s.emissiveIntensity : 1;
          entry.mat.emissive.copy(s.emissive);
          entry.mat.emissiveIntensity = ei;
          entry.uER.value = s.emissive.r * ei;
          entry.uEG.value = s.emissive.g * ei;
          entry.uEB.value = s.emissive.b * ei;
        }
        if (typeof s.roughness === 'number') entry.mat.roughness = s.roughness;
        if (typeof s.metalness === 'number') entry.mat.metalness = s.metalness;
        if (typeof s.envMapIntensity === 'number') entry.mat.envMapIntensity = s.envMapIntensity;
        entry.uBaseOpacity.value = typeof s.opacity === 'number' ? s.opacity : 1;
        const srcMap = (s.map ?? null) as Texture | null;
        const holder = entry.mat as unknown as { map: Texture | null };
        if (holder.map !== srcMap) holder.map = srcMap; // by-reference, for inspection/restore parity
        if (entry.boundMap !== srcMap) {
          (entry.mapNode as unknown as { value: Texture }).value = srcMap ?? fallbackTex;
          entry.boundMap = srcMap;
        }
      };

      const tracked: Tracked[] = collectMeshes(target.subject).map((mesh) => {
        const aspect = measureAspect(mesh);
        const uBaseOpacity = uniform(1);
        const uCR = uniform(1);
        const uCG = uniform(1);
        const uCB = uniform(1);
        const uER = uniform(0);
        const uEG = uniform(0);
        const uEB = uniform(0);
        const mapNode: TNode = texture(fallbackTex);
        const mat = new MeshStandardNodeMaterial({ transparent: true });

        const u = uv();
        // p: x in ±aspect/2, y in ±0.5 — shapes stay shape-true, not stretched.
        const px: TNode = u.x.sub(0.5).mul(aspect);
        const py: TNode = u.y.sub(0.5);
        const d = buildSdfNode(px, py, aspect);

        // Surface treatment: inner-distance shade for volume (darker at the
        // edge, brighter deep inside) + brass rim glow riding the |d| band.
        const inner: TNode = smoothstep(float(0), float(INNER_DEPTH), d.negate());
        const shade: TNode = float(0.8).add(inner.mul(0.28));
        const rim: TNode = float(1).sub(smoothstep(float(0), float(RIM_W), abs(d)));
        (mat as unknown as { colorNode: unknown }).colorNode = mapNode.rgb
          .mul(vec3(uCR, uCG, uCB))
          .mul(shade);
        (mat as unknown as { emissiveNode: unknown }).emissiveNode = vec3(uER, uEG, uEB).add(
          vec3(BRASS[0], BRASS[1], BRASS[2]).mul(rim).mul(uGlow),
        );
        (mat as unknown as { opacityNode: unknown }).opacityNode = maskOf(d).mul(uBaseOpacity);

        const entry: Tracked = {
          mesh,
          mat,
          src: mesh.material as Material,
          uBaseOpacity,
          uCR,
          uCG,
          uCB,
          uER,
          uEG,
          uEB,
          mapNode,
          boundMap: null,
        };
        copyLook(entry);
        mesh.material = mat;
        return entry;
      });

      // ── Chrome co-treatment (metaball-merge pattern, W1 art pass) ─────────
      // The card's chrome children are NOT part of the masked face material;
      // the old binary melt (opacity = rect weight) left them floating over a
      // hidden face mid-morph (the advocate's double-exposure). Now the SAME
      // morphing SDF treats them: GPU per-fragment clip + CPU center coverage.
      interface ChromeSnap {
        mat: Material & { opacity: number };
        opacity: number;
        transparent: boolean;
      }
      interface ChromeTracked {
        mesh: Mesh;
        name: string;
        /** Swapped masked material — null on the array-material fallback path. */
        mat: MeshStandardNodeMaterial | null;
        src: Material | Material[];
        snaps: ChromeSnap[]; // fallback path: opacity snapshot/restore
        uCover: ReturnType<typeof uniform>; // baseOpacity × CPU coverage
        baseOpacity: number;
        px: number; // child center in panel px-space
        py: number;
        halfShort: number; // half of the child's SHORT extent, px-space
      }

      const subjMesh =
        target.subject && (target.subject as Mesh).isMesh ? (target.subject as Mesh) : null;
      // Panel frame metrics from measured geometry bounds (never hardcoded):
      // px-space = (local - center) / panelHeight, matching the face uv mapping.
      let panelH = 1;
      let panelAspect = 1;
      let panelCx = 0;
      let panelCy = 0;
      if (subjMesh) {
        const geo = subjMesh.geometry;
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bb = geo.boundingBox;
        if (bb) {
          const pw = bb.max.x - bb.min.x;
          const ph = bb.max.y - bb.min.y;
          if (ph > 1e-6) panelH = ph;
          if (pw > 1e-6 && ph > 1e-6) panelAspect = pw / ph;
          panelCx = (bb.max.x + bb.min.x) / 2;
          panelCy = (bb.max.y + bb.min.y) / 2;
        }
      }

      /** Carry the chrome child's own look into its masked material (standard
       *  slots — chrome gets no colorNode, so its map/color render natively). */
      const copyChromeLook = (c: ChromeTracked): void => {
        if (!c.mat || Array.isArray(c.src)) return;
        const s = c.src as SourceLook;
        if (s.color instanceof Color) c.mat.color.copy(s.color);
        if (s.emissive instanceof Color) c.mat.emissive.copy(s.emissive);
        if (typeof s.emissiveIntensity === 'number') c.mat.emissiveIntensity = s.emissiveIntensity;
        if (typeof s.roughness === 'number') c.mat.roughness = s.roughness;
        if (typeof s.metalness === 'number') c.mat.metalness = s.metalness;
        if (typeof s.envMapIntensity === 'number') c.mat.envMapIntensity = s.envMapIntensity;
        c.baseOpacity = typeof s.opacity === 'number' ? s.opacity : 1;
        const srcMap = (s.map ?? null) as Texture | null;
        const holder = c.mat as unknown as { map: Texture | null };
        if (holder.map !== srcMap) {
          holder.map = srcMap;
          c.mat.needsUpdate = true;
        }
      };

      const chrome: ChromeTracked[] = [];
      if (subjMesh) {
        subjMesh.updateWorldMatrix(true, true);
        const wp = new Vector3();
        for (const child of subjMesh.children) {
          child.traverse((o) => {
            const m = o as Mesh;
            if (!m.isMesh || !m.material) return;
            // Child center in the panel's local frame -> px-space.
            m.getWorldPosition(wp);
            const lp = subjMesh.worldToLocal(wp.clone());
            const ox = lp.x - panelCx;
            const oy = lp.y - panelCy;
            const cg = m.geometry;
            if (!cg.boundingBox) cg.computeBoundingBox();
            const cb = cg.boundingBox;
            const halfShort = cb
              ? Math.min(cb.max.x - cb.min.x, cb.max.y - cb.min.y) / 2 / panelH
              : 0.02;
            const uCover = uniform(1);
            if (Array.isArray(m.material)) {
              // Rare multi-material chrome: CPU opacity co-fade only.
              chrome.push({
                mesh: m,
                name: m.name,
                mat: null,
                src: m.material,
                snaps: m.material.map((cm) => ({
                  mat: cm as Material & { opacity: number },
                  opacity: (cm as Material & { opacity: number }).opacity,
                  transparent: cm.transparent,
                })),
                uCover,
                baseOpacity: 1,
                px: ox / panelH,
                py: oy / panelH,
                halfShort,
              });
              return;
            }
            // Full treatment: per-fragment GPU clip by the same morphing SDF.
            // Fragment's panel-frame position = child offset + positionLocal
            // (catalog chrome carries no local rotation/scale).
            const cmat = new MeshStandardNodeMaterial({ transparent: true });
            const pxN: TNode = (positionLocal as TNode).x.add(float(ox)).div(float(panelH));
            const pyN: TNode = (positionLocal as TNode).y.add(float(oy)).div(float(panelH));
            const dC = buildSdfNode(pxN, pyN, panelAspect);
            (cmat as unknown as { opacityNode: unknown }).opacityNode = maskOf(dC).mul(uCover);
            const entry: ChromeTracked = {
              mesh: m,
              name: m.name,
              mat: cmat,
              src: m.material,
              snaps: [],
              uCover,
              baseOpacity: 1,
              px: ox / panelH,
              py: oy / panelH,
              halfShort,
            };
            copyChromeLook(entry);
            m.material = cmat;
            chrome.push(entry);
          });
        }
      }

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
        for (const c of chrome) {
          if (!c.mat) continue;
          const live = c.mesh.material;
          if (live !== c.mat && live && !Array.isArray(live)) {
            c.src = live as Material;
            c.mesh.material = c.mat;
          }
          copyChromeLook(c);
        }
      };

      // CPU-side cycle phase -> eased per-shape weights + chrome coverage.
      // `smoothness` is the fraction of each segment spent morphing
      // (hold-and-glide: the shape holds its identity for 1-k, then glides
      // into the next over k).
      let lastT = 0;
      const applyState = (t: number): void => {
        const seq = SHAPE_SETS[str(params.shapes, 'tour')] ?? SHAPE_SETS.tour;
        const speed = clamp(num(params.speed, 0.75), 0.05, 5);
        const k = clamp(num(params.smoothness, 0.6), 0.05, 1);
        const soft = clamp(num(params.softness, 0.018), 0.002, 0.15);
        const size = clamp(num(params.size, 1), 0.7, 1.1);
        uSoft.value = soft;
        uSize.value = size;
        uGlow.value = clamp(num(params.glow, 0.85), 0, 2);

        const segs = seq.length;
        const pos = (((t * speed) % segs) + segs) % segs;
        const i = Math.floor(pos) % segs;
        const f = pos - Math.floor(pos);
        const holdSpan = 1 - k;
        const lin = f <= holdSpan ? 0 : clamp((f - holdSpan) / k, 0, 1);
        const blend = lin * lin * (3 - 2 * lin); // smoothstep ease — fluid glide
        // Convex weights (>= 0, sum 1) — see the single-silhouette guarantee.
        const w: ShapeWeights = { rect: 0, circle: 0, hex: 0 };
        w[seq[i]] += 1 - blend;
        w[seq[(i + 1) % segs]] += blend;
        uWRect.value = w.rect;
        uWCirc.value = w.circle;
        uWHex.value = w.hex;

        // Chrome co-treatment: CURRENT mixed SDF at each child's center; the
        // smoothing width widens to the child's half-extent so wide bars fade
        // proportionally as the silhouette front passes them.
        for (const c of chrome) {
          const d = cpuMixedSdf(c.px, c.py, w, size, panelAspect);
          const s = Math.max(soft, c.halfShort);
          const cov = 1 - sstep(-s, s, d);
          c.uCover.value = c.baseOpacity * cov;
          if (!c.mat) {
            for (const sn of c.snaps) {
              if (!sn.mat.transparent) sn.mat.transparent = true;
              sn.mat.opacity = sn.opacity * cov;
            }
          }
        }
      };
      applyState(0);

      // CPU-observable handles for the host/tests (no renderer needed).
      target.userData.sdfMorphWeights = { rect: uWRect, circle: uWCirc, hex: uWHex };
      target.userData.sdfMorphSoftness = uSoft;
      target.userData.sdfMorphSize = uSize;
      target.userData.sdfMorphGlow = uGlow;
      target.userData.sdfMorphChrome = chrome.map((c) => ({
        name: c.name,
        px: c.px,
        py: c.py,
        uCover: c.uCover,
      }));

      return {
        // Endless silhouette loop — stateful, so Infinity (t drives the cycle).
        duration: () => Infinity,
        seek: (t) => {
          lastT = t;
          syncSourceLook();
          // Params are read live inside applyState — control changes apply
          // without a rebuild.
          applyState(t);
        },
        onParamChange: () => {
          // Apply immediately at the pinned time: the CONTROLS gate sweeps
          // while PAUSED at t=1s — weights (speed/smoothness/shapes), the
          // silhouette uniforms (softness/size/glow), AND the chrome coverage
          // all must respond without another seek.
          applyState(lastT);
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
            if (c.mat) {
              c.mesh.material = c.src;
              (c.mat as unknown as { map: Texture | null }).map = null;
              c.mat.dispose();
            } else {
              for (const sn of c.snaps) {
                sn.mat.opacity = sn.opacity;
                sn.mat.transparent = sn.transparent;
              }
            }
          }
          chrome.length = 0;
          fallbackTex.dispose(); // owned fallback only — never the source's maps
          delete target.userData.sdfMorphWeights;
          delete target.userData.sdfMorphSoftness;
          delete target.userData.sdfMorphSize;
          delete target.userData.sdfMorphGlow;
          delete target.userData.sdfMorphChrome;
        },
      };
    },
  ),
};
