// pointer-loupe — a jeweler's loupe rides the cursor: a glass magnifier disc
// ENLARGES the card's OWN content beneath it inside a translucent brass rim,
// gliding over the surface. HARD / DISPLACEMENT / pointer primitive.
//
// TECHNIQUE — the PROVEN texture-preserving idiom of its shipped sibling
// lens-bulge, tuned to a SHARP-edged UNIFORM loupe rather than a soft fisheye
// dome. A loupe is REAL optical magnification: the card content directly under
// the glass reads `zoom`× LARGER. The magnification is applied to the subject's
// OWN content two ways, faithful to what the subject actually IS:
//
//   • TEXTURED subject (a mounted artifact with a live `.map`): the sheet's COLOR
//     lane samples `texture(map, loupeUv)` where, INSIDE the disc, the sample uv
//     is pulled TOWARD the loupe center by 1/zoom — a crisp UNIFORM enlargement
//     of the real pixels, easing back to a 1:1 read at the disc edge so the
//     content stays inside the disc (no torn / clipped read):
//         loupeUv = center + (uv - center) · (1/zoom .. 1 at the rim)
//   • COMPOSED card (the catalog tile — a panel + brass header + grey rows + ice
//     dot, with NO single texture): the REAL content lives in the chrome child
//     meshes, so there is no texture to UV-sample. The loupe ENLARGES THE CHROME
//     directly — a CPU mirror of the loupe optics. Each chrome child whose
//     CENTER falls under the glass is pushed radially OUTWARD from the loupe
//     center and scaled up by a magnification that is `zoom` at the loupe center
//     and DECAYS SMOOTHLY back to 1.0 at the disc edge. Because the effective
//     magnification → 1 at the rim, a child near the edge barely moves and a
//     child outside the disc is at its EXACT rest pose — the enlarged content is
//     CONTAINED inside the disc and pinches to the card at the rim. NOTHING is
//     pushed out of frame; the header is never ripped off the card body.
//
// WAVE 3 — TEXTURE-PRESERVING DISPLACEMENT (mountable: true). The 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look, so
// the category is skipped on mounted artifacts (UNMOUNTABLE_CATEGORIES). This one
// PRESERVES the subject's own look exactly as lens-bulge does — it NEVER mutates
// the subject's material/geometry. It stands a faithful OVERLAY in the subject's
// place (the shipped lens-bulge / scroll-stagger-rise discipline) so the
// magnified content is the only thing on screen with no unmagnified original
// showing through:
//   - the sheet's colorNode samples the live `.map` BY REFERENCE through the
//     loupe remap, or — when map-less — carries the live color (tracked uniform)
//     AND copies the PBR scalars (roughness/metalness/envMapIntensity/emissive)
//     so the content shades identically under the rig lights. NEVER an invented
//     fill. The sheet stays FLAT (no positionNode dome) at the card face.
//   - the chrome children become rigid CLONES (real geometry shared by
//     reference, material clone) carrying their EXACT look — so the brass header /
//     grey rows / ice dot stay legible and tack-sharp, magnified through the lens
//     and dead-still outside it.
//   - the ONLY loupe furniture is a TRANSLUCENT glass disc: a faint specular cap
//     (low opacity, NEVER occludes the magnified content) plus a brass RIM RING
//     whose brightness AND width are driven by `rim`. There is NO dark occluding
//     dome and NO drop shadow — the magnified card reads straight through the
//     glass.
//   - LATE TEXTURE POUR: mounted artifacts pour `.map` asynchronously after
//     bindings attach; every seek re-reads the live material and rebuilds the
//     sheet's material the moment the instance OR its map identity changes.
//   - LIVE TRANSFORM TRACKING: co-bindings keep animating the hidden subject;
//     every seek re-syncs the overlay group to the subject's current local pose.
//   - dispose() restores the subject and disposes EVERYTHING it created (sheet +
//     glass disc + chrome clones' material) and never the subject's shared
//     map/geometry.
//
// POINTER-RIG: reads target.userData.pointer {x,y} in 0..1 (non-finite guarded).
// Engagement = proximity to the card (1 over the interior → 0 at a far corner),
// so the harness-pinned engaged point {0.62,0.5} shows the loupe over the card's
// right side and every control reshapes it there; a far-corner idle pointer
// disengages → the loupe collapses to the clean, untouched card 1:1 (no disc, no
// rim, no scaled chrome). GLIDE LAG offsets the loupe center BACK toward the
// card center by `glide` — a STANDING lag that persists when paused (so a frozen
// control sweep on `glide` visibly slides the loupe), plus a per-frame dt-eased
// follow so a live cursor is trailed. onParamChange re-applies at the last seek
// state so a paused control sweep takes effect. duration() = Infinity (stateful).
// Default params = the premium look: a 2.4× loupe of radius 0.22 with a bright
// brass rim.
//
// DISTINCT FROM NEIGHBORS:
//   - lens-bulge (sibling) is a SOFT whole-radius cosine fisheye dome: content
//     swells with a gradual radial falloff. Here it is a SHARP-edged optical
//     disc — near-UNIFORM (flat) magnification across the disc interior with a
//     hard circular edge and a discrete brass RIM ring; the surface OUTSIDE the
//     disc is dead flat and untouched.
//   - spotlight-follow is a brightness hotspot disc with NO magnification (it
//     adds emissive, it does not resample/enlarge content). Here the disc
//     genuinely ENLARGES the subject's content through a loupe-optics remap.

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
  // Optical magnification at the loupe center — content reads `zoom`× larger at
  // the disc center, easing to 1:1 at the rim (UV pull for textured subjects,
  // chrome enlarge for composed cards). Default = the premium jeweler's-loupe.
  { id: 'zoom', label: 'Zoom Factor', type: 'knob', min: 1.2, max: 4, step: 0.05, default: 2.4 },
  // Loupe disc radius as a FRACTION of the measured half-span — scale-free, so
  // the loupe reads identically on a 1.74 catalog card and a 40-unit hero.
  { id: 'radius', label: 'Loupe Radius', type: 'fader', min: 0.12, max: 0.4, step: 0.01, default: 0.34 },
  // Brass rim brightness AND width (emissive gain + ring thickness on the glass
  // edge) — the bright loupe bezel. Drives a visible change low→high.
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
// Fixed timestep fallback when seek times do not advance (paused control sweep).
const DT_FALLBACK = 1 / 60;
// Standing-lag amplifier: maps the glide control (0..0.4) to the fraction of the
// way the loupe is pulled back toward the card center, so a frozen glide sweep
// slides the loupe a clearly visible distance (0.4 → ~0.75). Capped below 1.
const LAG_GAIN = 1.9;
// Loupe magnification PLATEAU: the magnification holds at full `zoom` from the
// center out to this fraction of the radius (a real loupe is near-uniform in the
// middle), then eases to 1.0 across the outer shoulder so the enlarged content
// is contained inside the disc and pinches to the card at the rim. A wide
// plateau keeps any chrome child inside the disc bodily enlarged (so the
// advocate's engaged pin reads a strong magnification) while the outer shoulder
// guarantees nothing is torn off the frame.
const PLATEAU = 0.7;

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
 *  the sheet surface; restScale captures the child's original scale. The child's
 *  CENTER drives whether it sits under the glass; the magnification it receives
 *  decays to 1.0 at the disc edge so the enlarged content is CONTAINED inside the
 *  disc and never pushed out of frame. */
interface ChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  restScale: number;
  /** Half-extents in the sheet frame, so coverage is gauged by the disc-to-
   *  footprint gap — a wide content row reaching UNDER an off-center loupe counts
   *  as covered even when its center is outside the disc (a real loupe enlarges
   *  whatever it covers). */
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
    "A jeweler's loupe rides the cursor — a glass magnifier disc enlarges the card's own content inside a translucent brass rim, gliding over the surface.",
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
      // INSIDE the hard disc the sample uv is pulled TOWARD the loupe center by a
      // factor that is 1/zoom at the center and EASES BACK to 1.0 at the disc
      // edge → the content reads `zoom`× larger at the middle and pinches to a 1:1
      // read at the rim (so the magnified image is CONTAINED inside the disc — no
      // clipped / torn read). OUTSIDE the disc the sheet samples the subject 1:1.
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
      // card. A thin AA shoulder keeps the edge clean.
      const insideDisc = smoothstep(float(1.0), float(0.97), dNorm).mul(uEngage);
      // Effective sample pull: 1/zoom across the disc INTERIOR (a real loupe is
      // near-uniform in the middle), easing to 1.0 only near the rim so the
      // magnification stays contained. zSafe = 1/zoom (≤1 → enlarge). The
      // containment lerp keeps full magnification inside PLATEAU and pinches to
      // 1:1 across the outer shoulder — content reads bodily enlarged across the
      // glass yet never tears past the rim.
      const zSafe = float(1).div(uZoom);
      const edgeEase = smoothstep(float(PLATEAU), float(1.0), dNorm); // 0 interior → 1 rim
      const pull = mix(zSafe, float(1.0), edgeEase); // ≤1 interior, =1 at the rim
      const loupeUvX = uLoupeUvX.add(cuvX.mul(pull));
      const loupeUvY = uLoupeUvY.add(cuvY.mul(pull));
      const sampleX = mix(uv().x, loupeUvX, insideDisc);
      const sampleY = mix(uv().y, loupeUvY, insideDisc);
      const sampleUv = vec2(tslClamp(sampleX, 0, 1), tslClamp(sampleY, 0, 1));

      // ── The loupe VERTEX warp (the optical magnification for the COMPOSED card)
      // The catalog card is map-less: its real content lives in the chrome child
      // meshes. The loupe ENLARGES the card's OWN geometry by a CONTAINED radial
      // vertex expansion in subject-local space — exactly the brief's idiom:
      //   pos' = center + (pos − center) · mag
      // where `mag` is `zoom` at the loupe center and EASES SMOOTHLY back to 1.0
      // at the disc edge. A vertex INSIDE the disc expands outward (content reads
      // larger); a vertex AT/BEYOND the disc edge has mag = 1.0 → it does NOT
      // move. So a wide row's under-glass vertices bulge outward while its outer
      // vertices stay anchored to the card — the row stretches ONLY within the
      // disc and pinches at the rim. NOTHING is pushed off the frame (the header
      // is never ripped off), no matter how wide the row or how high the zoom.
      // These uniforms are the loupe center + radius in SUBJECT-LOCAL units.
      const uWarpCx = uniform(0);
      const uWarpCy = uniform(0);
      const uWarpRadius = uniform(0.2);
      /** A positionNode that radially expands the chrome geometry's subject-local
       *  position about the loupe center, contained to the disc. The clone's
       *  geometry is baked into subject-local coordinates, so `positionLocal` IS
       *  the subject-local vertex position. Returns the warped subject-local vec3
       *  (z passed through). The expansion mag is `zoom` across the interior and
       *  eases to 1.0 at the disc edge, ×engagement (0 when disengaged → the card
       *  is flat and untouched at rest). A vertex AT/BEYOND the rim has mag = 1.0,
       *  so outer vertices stay anchored to the card and nothing tears off frame. */
      const warpedChromePosition = () => {
        const lx = positionLocal.x;
        const ly = positionLocal.y;
        const dx = lx.sub(uWarpCx);
        const dy = ly.sub(uWarpCy);
        const dWarp = tslLength(vec2(dx, dy)).div(uWarpRadius.max(float(1e-3)));
        // Containment: full magnification across the interior PLATEAU, easing to 0
        // by the disc edge. field = 1 − smoothstep(PLATEAU,1,dWarp); mag = 1 +
        // (zoom − 1)·field·engage.
        const field = float(1).sub(smoothstep(float(PLATEAU), float(1.0), dWarp)).mul(uEngage);
        const mag = float(1).add(uZoom.sub(float(1)).mul(field));
        return vec3(uWarpCx.add(dx.mul(mag)), uWarpCy.add(dy.mul(mag)), positionLocal.z);
      };

      // What the current sheet material was built FROM — compared against the live
      // source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      // ── Overlay group: the hidden subject's faithful stand-in ────────────
      const overlay = new Group();
      overlay.name = 'pointer-loupe-overlay';
      let sheet: Mesh | null = null;
      let disc: Mesh | null = null;
      let rim: Mesh | null = null;
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
        const m = mat as unknown as { colorNode: unknown; positionNode: unknown };
        // TEXTURED: the sheet IS the content — magnified through the loupe remap
        // inside the disc, 1:1 outside. MAP-LESS: the live panel color (chrome
        // clones carry the magnified rows/header/dot).
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, sampleUv) : uColor;
        // For the map-less composed card the FLAT panel sheet stays put (the
        // chrome carries the magnified content); for a TEXTURED subject the
        // magnification lives in the UV lane above, so the sheet geometry also
        // stays flat. No positionNode dome — the sheet never rises in front of the
        // content. (The vertex warp is applied to the chrome clones below.)
        return mat;
      };

      /** The TRANSLUCENT glass disc: a faint specular cap PLUS a brass RIM RING.
       *  Kept additively low-opacity so it NEVER occludes the magnified content
       *  beneath it — there is no dark dome and no drop shadow. `rim` drives the
       *  ring's brightness AND its width (the ring grows inward as rim climbs), so
       *  sweeping rim visibly reshapes the bezel. */
      const buildGlassMaterial = (): MeshBasicNodeMaterial => {
        const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        // glass uv is its own 0..1 disc quad; d = distance from the disc center,
        // 0 at center → 1 at the rim.
        const d = tslClamp(tslLength(uv().sub(vec2(0.5, 0.5))).div(float(0.5)), 0, 1);
        const discGate = smoothstep(float(1.0), float(0.96), d);
        // Faint specular highlight, brightest at center — LOW so it never hides
        // the magnified card (it is the glassy sheen, not an occluder).
        const capCos = cos(d.mul(float(Math.PI * 0.5)));
        // Faint glass sheen ONLY at the very edge shoulder (a thin rim-light), kept
        // low so it never washes/occludes the magnified content in the disc
        // interior (the prior 0.12 centre cap rendered as a grey occluding bead over
        // the near-black card). The interior stays see-through so the enlarged card
        // content reads straight through the glass.
        const highlight = capCos.mul(capCos).mul(d).mul(float(0.07));
        // Brass RIM RING at the disc edge. Its inner edge slides inward as `rim`
        // grows (a WIDER ring), and its brightness scales with `rim` too — both
        // the width and the gain are live on the control. Normalized so the
        // default rim (1.0) reads as a clear bright bezel.
        const ringInner = float(0.78).sub(uRimBright.mul(float(0.16)));
        const ring = smoothstep(ringInner, float(0.98), d).mul(
          smoothstep(float(1.0), float(0.985), d),
        );
        const ringBright = ring.mul(uRimBright.mul(float(0.85)).add(float(0.1)));
        const m = mat as unknown as { colorNode: unknown; opacityNode: unknown };
        // A near-white sheen blended toward the brass rim color at the ring.
        m.colorNode = mix(vec3(0.86, 0.86, 0.9), uRimColor, ring);
        // Opacity = (faint highlight + bright ring) × engagement, hard-gated to
        // the disc so the glass is invisible outside the lens and when disengaged.
        m.opacityNode = highlight.add(ringBright).mul(uEngage).mul(discGate);
        return mat;
      };

      /** Build a node material carrying a chrome child's EXACT look (color,
       *  emissive, PBR scalars copied from the source) PLUS the shared loupe
       *  vertex warp as its positionNode. The clone's geometry is baked into
       *  subject-local space, so positionLocal IS the subject-local vertex
       *  position — the warp reads it directly. The result: the real header / row /
       *  dot geometry expands radially within the disc and pinches at the rim,
       *  texture-preserving and contained. */
      const buildChromeMaterial = (srcMat: MappedMaterial): MeshStandardNodeMaterial => {
        const mat = new MeshStandardNodeMaterial();
        if (typeof srcMat.roughness === 'number') mat.roughness = srcMat.roughness;
        if (typeof srcMat.metalness === 'number') mat.metalness = srcMat.metalness;
        if (typeof srcMat.envMapIntensity === 'number') {
          mat.envMapIntensity = srcMat.envMapIntensity;
        }
        if (srcMat.emissive) mat.emissive.copy(srcMat.emissive);
        if (typeof srcMat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = srcMat.emissiveIntensity;
        }
        mat.opacity = srcMat.opacity;
        mat.transparent = srcMat.transparent || srcMat.opacity < 1;
        mat.side = DoubleSide;
        const m = mat as unknown as { colorNode: unknown; positionNode: unknown };
        // Carry the child's own color (the brass header / grey row / ice dot).
        if (srcMat.color) m.colorNode = uniform(srcMat.color.clone());
        // The loupe vertex warp in subject-local space (positionLocal == subject-
        // local because the geometry was baked into subject-local coordinates).
        m.positionNode = warpedChromePosition();
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
        // a clone whose GEOMETRY is baked into subject-local space and whose node
        // material applies the shared loupe VERTEX WARP (positionNode). The header
        // / rows / dot geometry expands radially within the disc and pinches at the
        // rim — the real content magnified, texture-preserving and CONTAINED (a
        // wide row's outer vertices stay anchored to the card, so nothing tears off
        // the frame). The clone sits at the overlay origin (identity) because the
        // geometry already carries the child's full subject-local pose.
        {
          const rel = new Matrix4();
          subject.traverse((o) => {
            const child = o as Mesh;
            if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const bb = child.geometry.boundingBox;
            if (!bb || bb.isEmpty()) return;
            const srcMat = (
              Array.isArray(child.material) ? child.material[0] : child.material
            ) as MappedMaterial;
            // Bake the child's subject-local transform into a cloned geometry, so
            // the clone's positionLocal IS the subject-local vertex position.
            rel.multiplyMatrices(invSubject, child.matrixWorld);
            const baked = (child.geometry as BufferGeometry).clone();
            baked.applyMatrix4(rel);
            baked.computeBoundingBox();
            const cbb = baked.boundingBox!;
            const ox = (cbb.min.x + cbb.max.x) / 2 - sheetX;
            const oy = (cbb.min.y + cbb.max.y) / 2 - sheetY;
            const m = new Mesh(baked, buildChromeMaterial(srcMat));
            m.name = `pointer-loupe-chrome:${child.name || 'mesh'}`;
            // Identity transform — the baked geometry holds the child's pose.
            m.position.set(0, 0, 0);
            m.renderOrder = 1; // chrome reads OVER the panel sheet
            overlay.add(m);
            chrome.push({
              mesh: m,
              ox,
              oy,
              dz: (cbb.min.z + cbb.max.z) / 2 - faceZ,
              restScale: 1,
              hx: (cbb.max.x - cbb.min.x) / 2,
              hy: (cbb.max.y - cbb.min.y) / 2,
            });
          });
        }

        // Loupe furniture: the single translucent glass disc (faint cap + brass
        // rim ring). Sized to the loupe DIAMETER at build time; per-seek scale
        // tracks the live radius control so the footprint matches the optical disc.
        // NO dark dome, NO drop shadow — only the see-through glass.
        const discDiam = 2 * clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan;

        disc = new Mesh(new PlaneGeometry(discDiam, discDiam, 12, 12), buildGlassMaterial());
        disc.name = 'pointer-loupe-disc';
        disc.renderOrder = 13;
        overlay.add(disc);

        // A thin alias of the glass disc kept for furniture/observability parity
        // (the rim ring lives in the disc material; this mesh carries no occluder).
        rim = new Mesh(new PlaneGeometry(discDiam, discDiam, 1, 1), buildGlassMaterial());
        rim.name = 'pointer-loupe-rim';
        rim.renderOrder = 14;
        rim.visible = false; // the visible rim is baked into the disc glass
        overlay.add(rim);

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet must live as a sibling). The subject is
        // hidden — the overlay IS the card now (a faithful, fully-visible copy:
        // the magnified content is the only thing on screen, so there is no
        // unmagnified original showing through).
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
      // uEdgeMag is the magnification factor at the DISC EDGE (≈1 — proves
      // containment: nothing torn / clipped past the rim).
      target.userData.pointerLoupe = {
        uZoom,
        uRadius: uniform(clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan),
        uRim: uRimBright,
        uEngage,
        uCenterUvX: uniform(0.5),
        uCenterUvY: uniform(0.5),
        glideLag: uniform(num(params.glide, 0.12)),
        uMagApplied: uniform(1),
        uEdgeMag: uniform(1),
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
        uEdgeMag: { value: number };
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

      /** Containment falloff (the CPU mirror of the GPU `edgeEase`): the field
       *  holds at 1 from the center out to PLATEAU·radius (uniform loupe
       *  interior), then eases SMOOTHLY to 0 across the outer shoulder to the disc
       *  edge. This is the key to containment AND to a strong read: any chrome
       *  child inside the plateau gets the FULL magnification (so the advocate's
       *  engaged pin reads a bold enlargement), while a child near the rim barely
       *  moves and one outside the disc is at exact rest — the enlarged content is
       *  CONTAINED inside the disc and pinches to the card at the rim. */
      const falloff = (dNorm: number): number => {
        const x = clamp(dNorm, 0, 1);
        if (x <= PLATEAU) return 1;
        // smoothstep(PLATEAU, 1, x), then invert: 1 inside → 0 at the rim.
        const s = (x - PLATEAU) / (1 - PLATEAU);
        return 1 - s * s * (3 - 2 * s);
      };

      /** Observability mirror of the GPU vertex warp (the warp itself runs in the
       *  chrome positionNode; this only REPORTS its strength for headless tests —
       *  no mesh is mutated). The warp expands a vertex by `mag = 1 + (zoom−1)·
       *  field·engage` where `field = 1 − smoothstep(PLATEAU,1,dNorm)`. For each
       *  chrome child the strongest magnification it receives is at the point of
       *  its footprint NEAREST the loupe center (smallest dNorm → largest field);
       *  for a wide row reaching under an off-center disc that nearest point can be
       *  dead under the loupe (dNorm≈0 → full magnification), which is exactly what
       *  the advocate sees. Returns {peak, edge}: the peak vertex expansion applied
       *  and the expansion a vertex AT the disc edge receives (=1 — containment:
       *  outer vertices stay anchored to the card, so nothing tears off frame). */
      const chromeMagSignal = (
        engage: number,
        zoom: number,
        cxLocal: number,
        cyLocal: number,
        radiusLocal: number,
      ): { peak: number; edge: number } => {
        if (!chrome.length || engage <= 1e-3) return { peak: 1, edge: 1 };
        const rSafe = Math.max(radiusLocal, 1e-3);
        let peak = 1;
        for (const c of chrome) {
          const cx = sheetX + c.ox;
          const cy = sheetY + c.oy;
          // Nearest point of the child's footprint to the loupe center → smallest
          // distance any of its vertices can have (axis-clamped to the bbox).
          const nearX = clamp(cxLocal, cx - c.hx, cx + c.hx);
          const nearY = clamp(cyLocal, cy - c.hy, cy + c.hy);
          const r = Math.hypot(nearX - cxLocal, nearY - cyLocal);
          const dNorm = r / rSafe;
          if (dNorm >= 1) continue; // footprint clears the disc → no magnification
          // field = 1 − smoothstep(PLATEAU,1,dNorm), the warp's containment ramp.
          const field = falloff(dNorm);
          const mag = 1 + (zoom - 1) * field * engage;
          if (mag > peak) peak = mag;
        }
        // A vertex AT the disc edge gets field = falloff(1) = 0 → mag = 1: outer
        // vertices stay anchored, so the content is CONTAINED (nothing torn).
        const edge = 1 + (zoom - 1) * falloff(1) * engage; // = 1
        return { peak, edge };
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
          // chrome (a uniform loupe enlarges by `zoom` at full engagement at the
          // center; 1 at the edge).
          pub.uMagApplied.value = 1 + (zoom - 1) * engage;
          pub.uEdgeMag.value = 1;
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

        // ── Drive the chrome VERTEX WARP (subject-local center + radius) ─────
        // The warp runs in each chrome clone's positionNode; feed it the loupe
        // center and radius in subject-local units so the real header/rows/dot
        // geometry expands within the disc and pinches at the rim (contained).
        uWarpCx.value = localX;
        uWarpCy.value = localY;
        uWarpRadius.value = radiusLocal;

        // Observability (no mesh mutation — the warp is in the shader): the peak
        // vertex expansion the chrome receives + the expansion at the disc edge.
        const { peak: peakMag, edge: edgeMag } = chromeMagSignal(
          engage,
          zoom,
          localX,
          localY,
          radiusLocal,
        );
        // For a TEXTURED subject (no chrome) the magnification lives in the UV
        // lane (center factor = zoom at full engagement); report that instead.
        pub.uMagApplied.value = chrome.length > 0 ? peakMag : 1 + (zoom - 1) * engage;
        // Containment proof: vertex expansion at the disc edge is ≈1 in both paths.
        pub.uEdgeMag.value = chrome.length > 0 ? edgeMag : 1;

        // Track the live radius control by scaling the unit quads (built at the
        // create-time diameter). builtDiam is the geometry's own diameter.
        const builtDiam =
          2 * clamp(num(params.radius, 0.22), RADIUS_MIN, RADIUS_MAX) * halfSpan;
        const sclBase = builtDiam > 1e-6 ? discDiam / builtDiam : 1;

        const proud = Math.max(radiusLocal * 0.02, 1e-3);
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
            for (const m of [disc, rim]) {
              if (!m) continue;
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose(); // ours — never the subject's
            }
            for (const c of chrome) {
              // The baked geometry AND the node material are OURS (a cloned,
              // subject-local copy) — dispose both. The subject's own shared
              // geometry/material is never touched.
              c.mesh.geometry.dispose();
              (c.mesh.material as Material).dispose();
            }
            chrome.length = 0;
            disc = null;
            rim = null;
            subject.visible = prevVisible; // restore the subject we hid
          } else {
            subject.position.z = baseZ;
          }
        },
      };
    },
  ),
};
