// pointer-loupe — a jeweler's loupe rides the cursor: a SHARP-edged optical
// magnifier disc shows the content beneath it ENLARGED inside a bright brass
// rim, gliding over the surface. HARD / DISPLACEMENT / pointer primitive.
//
// TECHNIQUE — DESIGN-REFERENCES §1 (curtains.js / VFX-JS mouse-reactive uniform
// class) fused with §11's UV-remap cookbook. A loupe is REAL optical
// magnification: the content directly under the glass reads `zoom`× LARGER. The
// loupe magnifies the subject's OWN content two ways, faithful to what the
// subject actually IS:
//
//   • TEXTURED subject (a mounted artifact with a live `.map`): the sheet's COLOR
//     lane samples `texture(map, loupeUv)` where, INSIDE the disc, the sample uv
//     is pulled TOWARD the loupe center by 1/zoom — a crisp UNIFORM enlargement
//     of the real pixels:
//         loupeUv = center + (uv - center) / zoom            (true loupe optics)
//     read inside a HARD circular disc; outside the disc the sheet samples the
//     subject 1:1, so the card is its genuine self everywhere except under glass.
//   • COMPOSED card (the catalog tile — a panel + brass header + grey rows + ice
//     dot, with NO single texture): the REAL content lives in the chrome child
//     meshes, so there is no texture to UV-sample. The loupe MAGNIFIES THE CHROME
//     directly — a CPU mirror of the loupe optics scales each chrome child whose
//     footprint falls under the glass UNIFORMLY about the loupe center by `zoom`,
//     so the header bar / rows / dot under the disc read bodily ENLARGED, snapping
//     to the child's exact rest pose at/outside the radius. The flat panel sheet
//     sits behind them at the card face.
//
// WAVE 3 — TEXTURE-PRESERVING DISPLACEMENT (mountable: true). The 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look, so
// the category is skipped on mounted artifacts (UNMOUNTABLE_CATEGORIES). This one
// PRESERVES the subject's own look. Like its passing sibling lens-bulge it hides
// the real subject and stands an OVERLAY in its place (the proven
// scroll-stagger-rise / lens-bulge discipline) so the magnified content is the
// ONLY thing on screen — no unmagnified original showing through:
//   - NEVER mutates the subject's material/geometry; on dispose the subject is
//     restored (visibility) untouched.
//   - the sheet's colorNode samples the live `.map` BY REFERENCE through the loupe
//     remap, or — when map-less — carries the live color (tracked uniform) AND
//     copies the PBR scalars (roughness/metalness/envMapIntensity/emissive) so the
//     content shades identically under the rig lights. NEVER an invented fill.
//   - the chrome children become rigid CLONES (real geometry shared by reference,
//     material clone) carrying their EXACT look — magnified under the loupe,
//     dead-still outside it.
//   - LATE TEXTURE POUR: mounted artifacts pour `.map` asynchronously after
//     bindings attach; every seek re-reads the live material and rebuilds the
//     sheet's material the moment the instance OR its map identity changes.
//   - LIVE TRANSFORM TRACKING: co-bindings keep animating the hidden subject;
//     every seek re-syncs the overlay group to the subject's current local pose so
//     the loupe rides a live-tilting artifact.
//   - dispose() restores the subject and disposes EVERYTHING it created (sheet +
//     disc + rim + shadow + chrome clones' material) and never the subject's
//     shared map/geometry.
//
// POINTER-RIG: reads target.userData.pointer {x,y} in 0..1 (non-finite guarded).
// Engagement = proximity to the card (1 over the interior → 0 at a far corner),
// so the harness-pinned engaged point {0.62,0.5} shows the loupe over the card's
// right side and every control reshapes it there; a far-corner idle pointer
// disengages → the loupe collapses to the flat card 1:1 (no disc, no rim).
// GLIDE LAG offsets the loupe center BACK toward the card center by `glide` — a
// STANDING lag that persists when paused (so a frozen control sweep on `glide`
// visibly slides the loupe), in addition to the per-frame dt-eased follow so a
// live cursor is trailed. onParamChange re-applies at the last seek state so a
// paused control sweep takes effect. duration() = Infinity (stateful). Default
// params = the premium look: a 2.4× loupe of radius 0.22 with a bright brass rim.
//
// DISTINCT FROM NEIGHBORS:
//   - lens-bulge (sibling) is a SOFT whole-radius cosine fisheye dome: content
//     swells with radial falloff that eases to identity at the rim. Here it is a
//     SHARP-edged optical disc — UNIFORM (flat) magnification with a hard circular
//     edge, a discrete brass RIM ring and a drop shadow; the surface OUTSIDE the
//     disc is dead flat and untouched.
//   - spotlight-follow is a brightness hotspot disc with NO magnification (it adds
//     emissive, it does not resample/enlarge content). Here the disc genuinely
//     ENLARGES the subject's content through a loupe-optics remap.

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  clamp as tslClamp,
  cos,
  float,
  length as tslLength,
  mix,
  positionLocal,
  smoothstep,
  texture as tslTexture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Optical magnification at the loupe — content reads `zoom`× larger inside the
  // disc (UV pull for textured subjects, chrome scale for composed cards).
  // Default = the premium jeweler's-loupe enlargement.
  { id: 'zoom', label: 'Zoom Factor', type: 'knob', min: 1.2, max: 4, step: 0.05, default: 2.4 },
  // Loupe disc radius as a FRACTION of the measured half-span — scale-free, so
  // the loupe reads identically on a 1.74 catalog card and a 40-unit hero.
  { id: 'radius', label: 'Loupe Radius', type: 'fader', min: 0.12, max: 0.4, step: 0.01, default: 0.22 },
  // Brass rim brightness (emissive gain on the ring) — the bright loupe edge.
  { id: 'rim', label: 'Rim Brightness', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 1 },
  // Glide smoothing (lag): how far the loupe trails behind the cursor toward the
  // card center. 0 = locked to the pointer, higher = a heavier, deliberate glide.
  { id: 'glide', label: 'Glide Lag', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.12 },
] as const;

// Proximity engagement (pointer distance from the card center, in uv units): at
// or inside PROX_INNER the loupe is fully on; beyond PROX_OUTER it has faded out.
// The harness pins the engaged sweep at {0.62,0.5} (dCenter ≈ 0.12, well inside
// PROX_OUTER), so the loupe is visible there; a far-corner idle pointer
// (dCenter ≈ 0.68) lands past PROX_OUTER → fully disengaged.
const PROX_INNER = 0.05;
const PROX_OUTER = 0.62;
// Sheet subdivision — the textured UV-remap lane needs a dense grid so the sharp
// inside/outside disc edge resolves cleanly.
const SHEET_SEG = 64;
// Hard radius clamp (fraction of half-span) for hand-fed params off the schema.
const RADIUS_MIN = 0.06;
const RADIUS_MAX = 0.48;
// The rim ring's thickness as a fraction of the disc radius.
const RIM_FRAC = 0.12;
// The drop shadow's extra radius, as a fraction of the disc.
const SHADOW_GROW = 1.18;
// Fixed timestep fallback when seek times do not advance (paused control sweep).
const DT_FALLBACK = 1 / 60;
// Standing-lag amplifier: maps the glide control (0..0.4) to the fraction of the
// way the loupe is pulled back toward the card center, so a frozen glide sweep
// slides the loupe a clearly visible distance (0.4 → ~0.75). Capped below 1.
const LAG_GAIN = 1.9;

interface PointerXY {
  x: number;
  y: number;
}

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

/** A chrome child posed rigidly per seek (CPU mirror of the loupe optics).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface; restScale captures the child's original scale. hx/hy are
 *  the child's half-extents in the sheet frame, so the loupe magnifies any
 *  chrome whose FOOTPRINT overlaps the disc (a real loupe enlarges whatever it
 *  covers — a wide content row reaches under a small disc even when its center
 *  is off to the side). */
interface ChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  restScale: number;
  hx: number;
  hy: number;
}

/** First Mesh descendant carrying a material (the subject may be a Group —
 *  MSDF text-objects — so traverse rather than assume Mesh). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

export const pointerLoupePrimitive: PrimitiveDefinition = {
  name: 'pointer-loupe',
  label: 'Pointer Loupe',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  mountable: true,
  schema: SCHEMA,
  description:
    "A jeweler's loupe rides the cursor — a crisp magnifier disc shows the content enlarged inside a bright brass rim, gliding over the surface.",
  create: defineAnimatable(
    { name: 'pointer-loupe', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson lens-bulge inherited): each mesh's
      // geometry bbox is mapped mesh-local → subject-local directly — a world-AABB
      // route double-inflates whenever the subject is tilted at measure time. The
      // sheet's w/h covers the UNION of all meshes; its face z comes from the
      // REPRESENTATIVE mesh (the panel) so the sheet sits on the panel face, not
      // pushed forward by chrome that sits proud of it.
      subject.updateWorldMatrix(true, true);
      const invSubject = new Matrix4().copy(subject.matrixWorld).invert();
      const unionBox = new Box3();
      const repBox = new Box3();
      {
        const rel = new Matrix4();
        const tmp = new Box3();
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(invSubject, mesh.matrixWorld);
          tmp.copy(bb).applyMatrix4(rel);
          unionBox.union(tmp);
          if (mesh === repMesh) repBox.copy(tmp);
        });
      }
      const localBox = unionBox.isEmpty() ? null : unionBox;
      const faceBox = repBox.isEmpty() ? localBox : repBox;

      const canOverlay = Boolean(localBox && liveSourceMaterial() && subject.parent);

      // Fallback bookkeeping (degenerate subject — no geometry/material/parent).
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // Sheet extents (subject-local), filled when the overlay is built.
      let spanW = 1;
      let spanH = 1;
      let halfSpan = 0.5; // half of min(w,h) — the loupe-radius reference
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── Loupe uniforms (one graph; pointer-local, set per seek) ──────────
      const uZoom = uniform(num(params.zoom, 2.4));
      const uRimBright = uniform(num(params.rim, 1));
      const uEngage = uniform(0); // proximity engagement 0..1 (0 = flat card)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uRimColor = uniform(new Color('#cd9f55')); // brass rim (subject-derived)

      // ── The loupe UV remap (texture lane — the optical magnification) ────
      // The sheet's planar uv runs 0..1; map the loupe center into uv space.
      // INSIDE the hard disc the sample uv is pulled TOWARD the loupe center by
      // 1/zoom → the content reads `zoom`× larger; OUTSIDE the disc the sheet
      // samples the subject 1:1. uLoupeUv = loupe center in subject uv;
      // uUvRadius = disc radius in uv units (clamped to the smaller axis so the
      // disc stays circular on a non-square card).
      const uLoupeUvX = uniform(0.5);
      const uLoupeUvY = uniform(0.5);
      const uUvRadius = uniform(0.2);
      // Disc-uv distance from the loupe center, normalized by the uv radius.
      const cuvX = uv().x.sub(uLoupeUvX);
      const cuvY = uv().y.sub(uLoupeUvY);
      const dDiscUv = tslLength(vec2(cuvX, cuvY));
      const dNorm = dDiscUv.div(uUvRadius.max(float(1e-3)));
      // HARD disc gate (sharp loupe edge): 1 strictly inside, 0 just past the rim,
      // ×engagement so a disengaged pointer collapses the whole effect to the flat
      // card. A 1px-ish AA shoulder keeps the edge clean.
      const insideDisc = smoothstep(float(1.0), float(0.97), dNorm).mul(uEngage);
      // Magnified sample uv: pull toward the loupe center by 1/zoom inside the
      // disc, identity outside. zSafe = 1/zoom (≤1 → enlarge).
      const zSafe = float(1).div(uZoom);
      const loupeUvX = uLoupeUvX.add(cuvX.mul(zSafe));
      const loupeUvY = uLoupeUvY.add(cuvY.mul(zSafe));
      const sampleX = mix(uv().x, loupeUvX, insideDisc);
      const sampleY = mix(uv().y, loupeUvY, insideDisc);
      const sampleUv = vec2(tslClamp(sampleX, 0, 1), tslClamp(sampleY, 0, 1));

      // What the current sheet material was built FROM — compared against the live
      // source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      // ── Overlay group: the hidden subject's stand-in ─────────────────────
      const overlay = new Group();
      overlay.name = 'pointer-loupe-overlay';
      let sheet: Mesh | null = null;
      let disc: Mesh | null = null;
      let rim: Mesh | null = null;
      let shadow: Mesh | null = null;
      const chrome: ChromeClone[] = [];

      /** Build the SHEET material carrying the subject's OWN look. For a TEXTURED
       *  subject the colorNode samples the live texture through the loupe remap
       *  (magnified inside the disc, 1:1 outside) by reference; for a map-less
       *  composed card the chrome clones carry the magnified content so the sheet
       *  carries the live panel color + PBR scalars (the flat card behind the
       *  chrome). The sheet stays FLAT (no positionNode dome). */
      const buildSheetMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') {
            mat.envMapIntensity = src.envMapIntensity;
          }
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          // Derive the rim's warm tone from the subject (lean toward brass but
          // pick up the subject's hue) so the rim never reads as an invented
          // accent that fights the artifact.
          if (src.color) {
            uRimColor.value.copy(src.color.clone().lerp(new Color('#cd9f55'), 0.6));
          }
        }
        mat.side = DoubleSide;
        const m = mat as unknown as { colorNode: unknown };
        // TEXTURED: the sheet IS the content — magnified through the loupe remap
        // inside the disc, 1:1 outside. MAP-LESS: the live panel color (chrome
        // clones carry the magnified rows/header/dot).
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, sampleUv) : uColor;
        return mat;
      };

      /** The brass RIM ring: an annular SDF on its own quad, bright at the disc
       *  edge, transparent everywhere else. Emissive so it glows like the metal
       *  bezel of a real loupe. */
      const buildRimMaterial = (): MeshBasicNodeMaterial => {
        const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        const d = tslLength(uv().sub(vec2(0.5, 0.5)));
        // Ring centered on the disc edge (0.5), half-width RIM_FRAC*0.5 inside.
        const inner = float(0.5 - RIM_FRAC * 0.5);
        const outer = float(0.5);
        const ringIn = smoothstep(inner, inner.add(0.01), d);
        const ringOut = smoothstep(outer, outer.sub(0.01), d);
        const ring = ringIn.mul(ringOut);
        const m = mat as unknown as { colorNode: unknown; opacityNode: unknown };
        m.colorNode = uRimColor.mul(uRimBright);
        m.opacityNode = ring.mul(uEngage);
        return mat;
      };

      /** A faint GLASS cap on the disc: a soft central highlight, kept LOW opacity
       *  so it NEVER occludes the magnified content beneath it. The disc gives the
       *  loupe its glassy read without a dark dome. */
      const buildDiscMaterial = (): MeshBasicNodeMaterial => {
        const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        const d = tslLength(uv().sub(vec2(0.5, 0.5)));
        const dClamped = tslClamp(d.div(float(0.5)), 0, 1);
        // Soft specular highlight, brightest at center, gated to the disc.
        const capCos = cos(dClamped.mul(float(Math.PI * 0.5)));
        const highlight = capCos.mul(capCos).mul(float(0.16));
        const discGate = smoothstep(float(1), float(0.96), dClamped);
        const m = mat as unknown as { colorNode: unknown; opacityNode: unknown };
        m.colorNode = vec3(0.86, 0.86, 0.9);
        m.opacityNode = highlight.mul(uEngage).mul(discGate);
        return mat;
      };

      /** The soft DROP SHADOW disc beneath the loupe: a dark radial falloff,
       *  offset behind the loupe so it grounds the glass. */
      const buildShadowMaterial = (): MeshBasicNodeMaterial => {
        const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        const d = tslLength(uv().sub(vec2(0.5, 0.5)));
        const soft = smoothstep(float(0.5), float(0.1), d);
        const m = mat as unknown as { colorNode: unknown; opacityNode: unknown };
        m.colorNode = vec3(0, 0, 0);
        m.opacityNode = soft.mul(uEngage).mul(float(0.32));
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        spanW = localBox.max.x - localBox.min.x || 1;
        spanH = localBox.max.y - localBox.min.y || 1;
        halfSpan = Math.min(spanW, spanH) / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z; // the PANEL's front face (loupe floats proud of it)

        // The flat textured/colored sheet — the card face behind everything.
        sheet = new Mesh(new PlaneGeometry(spanW, spanH, SHEET_SEG, SHEET_SEG), buildSheetMaterial());
        sheet.name = 'pointer-loupe-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        sheet.renderOrder = 0;
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the loupe as
        // a rigid clone (real geometry shared by reference, material clone),
        // MAGNIFIED per seek by the CPU mirror of the loupe optics. Footprints are
        // measured in the subject's local frame → baked into the sheet frame.
        {
          const rel = new Matrix4();
          const childBox = new Box3();
          subject.traverse((o) => {
            const child = o as Mesh;
            if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const bb = child.geometry.boundingBox;
            if (!bb || bb.isEmpty()) return;
            const srcMat = (
              Array.isArray(child.material) ? child.material[0] : child.material
            ) as MappedMaterial;
            rel.multiplyMatrices(invSubject, child.matrixWorld);
            childBox.copy(bb).applyMatrix4(rel);
            const ox = (childBox.min.x + childBox.max.x) / 2 - sheetX;
            const oy = (childBox.min.y + childBox.max.y) / 2 - sheetY;
            const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
            m.name = `pointer-loupe-chrome:${child.name || 'mesh'}`;
            // Pre-pose to the child's full local transform so the clone matches
            // exactly at rest (subject-local → sheet-frame offset applied below).
            m.position.copy(child.position);
            m.quaternion.copy(child.quaternion);
            m.scale.copy(child.scale);
            m.renderOrder = 1; // chrome reads OVER the panel sheet
            overlay.add(m);
            chrome.push({
              mesh: m,
              ox,
              oy,
              dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              restScale: child.scale.x,
              hx: (childBox.max.x - childBox.min.x) / 2,
              hy: (childBox.max.y - childBox.min.y) / 2,
            });
          });
        }

        // Loupe furniture: drop shadow (deepest), disc glass, rim (front). Sized
        // to the loupe DIAMETER at build time; per-seek scale tracks the live
        // radius control so the footprint always matches the optical disc.
        const discDiam = 2 * clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan;

        shadow = new Mesh(
          new PlaneGeometry(discDiam * SHADOW_GROW, discDiam * SHADOW_GROW, 1, 1),
          buildShadowMaterial(),
        );
        shadow.name = 'pointer-loupe-shadow';
        shadow.renderOrder = 10;
        overlay.add(shadow);

        disc = new Mesh(new PlaneGeometry(discDiam, discDiam, 12, 12), buildDiscMaterial());
        disc.name = 'pointer-loupe-disc';
        disc.renderOrder = 13;
        overlay.add(disc);

        rim = new Mesh(new PlaneGeometry(discDiam, discDiam, 1, 1), buildRimMaterial());
        rim.name = 'pointer-loupe-rim';
        rim.renderOrder = 14;
        overlay.add(rim);

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet must live as a sibling). The subject is
        // hidden — the overlay IS the card now (the magnified content is the only
        // thing on screen, so there is no unmagnified original showing through).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false;
      }

      // Publish the driven uniforms for the host + headless tests (the
      // water-droplet pattern: no GPU to read pixels from in node). builtMap
      // exposes the by-reference shared texture for the texture-preservation
      // assertions. uMagApplied is the peak content enlargement applied this seek
      // (1 = none) — a deterministic, browser-free proof the loupe magnifies.
      target.userData.pointerLoupe = {
        uZoom,
        uRadius: uniform(clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan),
        uRim: uRimBright,
        uEngage,
        uCenterUvX: uniform(0.5),
        uCenterUvY: uniform(0.5),
        glideLag: uniform(num(params.glide, 0.12)),
        uMagApplied: uniform(1),
        get builtMap(): Texture | null {
          return builtSrcMap;
        },
      };
      const pub = target.userData.pointerLoupe as {
        uRadius: { value: number };
        uCenterUvX: { value: number };
        uCenterUvY: { value: number };
        glideLag: { value: number };
        uMagApplied: { value: number };
      };

      /** Read userData.pointer in 0..1, guarding non-finite. */
      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: Partial<PointerXY> }).pointer;
        const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
      };

      /** Proximity engagement 0..1 from the pointer's distance to the card
       *  center: 1 at/inside PROX_INNER, ramping to 0 at PROX_OUTER. The
       *  harness-pinned {0.62,0.5} is strongly engaged; a far-corner idle pointer
       *  collapses the loupe. */
      const engagementOf = (ptr: PointerXY): number => {
        const dCenter = Math.hypot(ptr.x - 0.5, ptr.y - 0.5);
        return clamp((PROX_OUTER - dCenter) / (PROX_OUTER - PROX_INNER), 0, 1);
      };

      /** CPU mirror of the loupe optics for the chrome clones: a UNIFORM (flat)
       *  magnifier. Each chrome child whose FOOTPRINT overlaps the disc is scaled
       *  `magFactor`× ABOUT the loupe center — its planar offset from the loupe
       *  center is multiplied by magFactor and its scale by magFactor, so the
       *  header bar / rows / dot under the glass read bodily ENLARGED (a hard,
       *  uniform loupe enlargement, not lens-bulge's soft radial falloff). A child
       *  whose footprint clears the disc snaps to its EXACT rest pose. A real
       *  loupe enlarges whatever it COVERS, so coverage is gauged by the disc-to-
       *  footprint gap (a wide content row reaches under a small off-center disc),
       *  with a short eased shoulder at the boundary so a bar slides in/out of the
       *  glass smoothly rather than popping. Lifted a hair toward the camera so
       *  the magnified chrome composites proud of the flat sheet. Returns the peak
       *  applied magnification factor (observability). */
      const placeChrome = (
        engage: number,
        zoom: number,
        cxLocal: number,
        cyLocal: number,
        radiusLocal: number,
      ): number => {
        if (!chrome.length) return 1;
        const rSafe = Math.max(radiusLocal, 1e-3);
        const lift = Math.max(radiusLocal * 0.04, 1e-3);
        let peak = 1;
        for (const c of chrome) {
          // Gap from the loupe center to the child's nearest footprint extent
          // (0 = the disc center is inside the bar). Axis-separated so a wide row
          // reaching under the disc counts as covered even with an off-card center.
          const dx = Math.max(Math.abs(sheetX + c.ox - cxLocal) - c.hx, 0);
          const dy = Math.max(Math.abs(sheetY + c.oy - cyLocal) - c.hy, 0);
          const gap = Math.hypot(dx, dy);
          // Coverage 1 when the footprint reaches the disc center, easing to 0 as
          // the gap grows past the disc radius (a short shoulder = smooth in/out).
          const coverage = engage * clamp((rSafe - gap) / rSafe, 0, 1);
          if (coverage <= 1e-3) {
            // Rest pose: exactly where it started, no lift, no scale.
            c.mesh.position.set(sheetX + c.ox, sheetY + c.oy, faceZ + c.dz);
            c.mesh.scale.setScalar(c.restScale);
            continue;
          }
          // Uniform loupe magnification, blended in by coverage so a bar entering
          // the glass enlarges smoothly to the full `zoom` at full coverage.
          const magFactor = 1 + (zoom - 1) * coverage;
          if (magFactor > peak) peak = magFactor;
          // Scale-about-the-loupe-center: push the child's offset OUTWARD by
          // magFactor and scale it up by the same factor → the part under the
          // glass reads `magFactor`× larger, anchored at the loupe center.
          const ddx = sheetX + c.ox - cxLocal;
          const ddy = sheetY + c.oy - cyLocal;
          const newX = cxLocal + ddx * magFactor;
          const newY = cyLocal + ddy * magFactor;
          c.mesh.position.set(newX, newY, faceZ + c.dz + lift);
          c.mesh.scale.setScalar(c.restScale * magFactor);
        }
        return peak;
      };

      // Smoothed loupe center in subject-uv space (the GLIDE follow). Seeded at
      // the pointer so the first frame is in place, then eased toward the live
      // pointer each seek with a dt-normalized factor (the per-frame follow).
      const initPtr = readPointer();
      let glideX = initPtr.x;
      let glideY = initPtr.y;
      let lastT = 0;
      let seededT = false;

      const apply = (t: number) => {
        // dt from consecutive seek times, clamped; a non-advancing clock (paused
        // control sweep) gets a fixed fallback so the glide still settles.
        let dt = seededT ? t - lastT : DT_FALLBACK;
        if (!Number.isFinite(dt) || dt <= 0) dt = DT_FALLBACK;
        dt = Math.min(dt, 0.1);
        lastT = t;
        seededT = true;

        const zoom = clamp(num(params.zoom, 2.4), 1.2, 4);
        const radiusFrac = clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX);
        const rimBright = clamp(num(params.rim, 1), 0.1, 2);
        const glide = clamp(num(params.glide, 0.12), 0, 0.4);
        uZoom.value = zoom;
        uRimBright.value = rimBright;
        pub.glideLag.value = glide;

        const ptr = readPointer();

        // GLIDE — two coupled effects so the control is LIVE at a frozen frame:
        //  (1) per-frame dt-eased FOLLOW: the smoothed center trails a moving
        //      cursor (glide=0 snaps, larger glide trails further).
        //  (2) a STANDING LAG offset: the loupe rests `glide` of the way BACK from
        //      the pointer toward the card center. This persists when the clock is
        //      paused, so a frozen `glide` sweep visibly SLIDES the loupe.
        const tau = glide * 1.2 + 1e-3;
        const factor = 1 - Math.exp(-dt / tau);
        glideX += (ptr.x - glideX) * factor;
        glideY += (ptr.y - glideY) * factor;
        const lagAmt = clamp(glide * LAG_GAIN, 0, 0.95);
        const lagX = glideX + (0.5 - glideX) * lagAmt;
        const lagY = glideY + (0.5 - glideY) * lagAmt;
        const centerX = clamp(lagX, 0, 1);
        const centerY = clamp(lagY, 0, 1);
        pub.uCenterUvX.value = centerX;
        pub.uCenterUvY.value = centerY;

        // Engagement is driven by the LIVE pointer (so a far-corner pointer
        // collapses the loupe promptly even mid-glide).
        const engage = engagementOf(ptr);
        uEngage.value = engage;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay (no geometry/material/parent). Nothing is
          // spawned; the subject is never hidden — the loupe is a no-op on a
          // degenerate subject. Uniforms still track for observability.
          pub.uRadius.value = radiusFrac * halfSpan;
          // Analytic magnification signal so observability is honest even with no
          // chrome (a uniform loupe enlarges by `zoom` at full engagement).
          pub.uMagApplied.value = 1 + (zoom - 1) * engage;
          // Keep the texture-lane uniforms valid even in the no-op path.
          uLoupeUvX.value = centerX;
          uLoupeUvY.value = centerY;
          uUvRadius.value = radiusFrac * halfSpan / Math.max(Math.min(spanW, spanH), 1e-3);
          subject.position.z = baseZ;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the live
        // source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildSheetMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // ── Loupe placement in subject-local space ──────────────────────────
        // The loupe floats at the GLIDED+lagged center mapped into the panel
        // footprint; its z sits a hair proud of the panel face.
        const radiusLocal = radiusFrac * halfSpan;
        pub.uRadius.value = radiusLocal;
        const discDiam = 2 * radiusLocal;
        const localX = localBox!.min.x + centerX * spanW;
        const localY = localBox!.min.y + centerY * spanH;

        // Texture-lane uniforms: loupe center + radius in subject-uv units.
        uLoupeUvX.value = centerX;
        uLoupeUvY.value = centerY;
        uUvRadius.value = radiusLocal / Math.max(Math.min(spanW, spanH), 1e-3);

        // ── Magnify the REAL chrome content under the loupe ──────────────────
        const peakMag = placeChrome(engage, zoom, localX, localY, radiusLocal);
        // Observability: the chrome mirror magnifies the real content by `peakMag`;
        // for a TEXTURED subject the sheet ALSO magnifies in its UV lane (same
        // factor). Report the uniform loupe factor so the signal is honest in both
        // cases (chrome present or single textured subject).
        pub.uMagApplied.value = chrome.length > 0 ? peakMag : 1 + (zoom - 1) * engage;

        // Track the live radius control by scaling the unit quads (built at the
        // create-time diameter). builtDiam is the geometry's own diameter.
        const builtDiam =
          2 * clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan;
        const sclBase = builtDiam > 1e-6 ? discDiam / builtDiam : 1;

        const proud = Math.max(radiusLocal * 0.02, 1e-3);
        if (shadow) {
          shadow.position.set(localX, localY, faceZ + proud * 0.5);
          shadow.scale.setScalar(sclBase);
        }
        if (disc) {
          disc.position.set(localX, localY, faceZ + proud * 2.5);
          disc.scale.setScalar(sclBase);
        }
        if (rim) {
          rim.position.set(localX, localY, faceZ + proud * 3.5);
          rim.scale.setScalar(sclBase);
        }
      };

      // Deterministic initial state. The rig pins idle at t=0; seed the glide and
      // engagement so a fresh instance is in a valid state.
      apply(0);

      return {
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at a frozen t) take effect without a new seek. dt
        // falls back to a fixed step so the glide does not stall.
        onParamChange: () => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const m of [disc, rim, shadow]) {
              if (!m) continue;
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose(); // ours — never the subject's
            }
            for (const c of chrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            chrome.length = 0;
            disc = null;
            rim = null;
            shadow = null;
            subject.visible = prevVisible; // restore the subject we hid
          } else {
            subject.position.z = baseZ;
          }
        },
      };
    },
  ),
};
