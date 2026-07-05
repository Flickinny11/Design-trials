// lens-bulge — a magnifying bulge swells under the cursor. The lens is a
// SEE-THROUGH optical magnifier: inside its radius the card's OWN content reads
// ENLARGED (a glass loupe laid over paper), easing back to identity at the rim;
// the card outside the lens is untouched and the brass header is never eaten.
// POINTER / DISPLACEMENT / medium.
//
// TECHNIQUE — §11 "Fisheye / Lens Distortion" cookbook kernel, applied
// pointer-locally rather than full-frame. The magnification is driven two ways,
// faithful to whatever the subject actually IS:
//
//   centered  = (p - lensCenter)                 // radial vector from the lens
//   d         = |centered| / radius              // 0 at center → 1 at the rim
//   inv       = 1 / sqrt(1 - d²·magnify)         // the §11 fisheye term (>1 = pull out)
//   stretched = lensCenter + centered·inv·(1 + rim·d)   // rim edge-stretch ring
//
//   • TEXTURED subject (mounted artifact with a live `.map`): the COLOR lane
//     samples `texture(map, warpedUv)` where warpedUv pulls the sample radially
//     INWARD by 1/inv — so the content magnifies optically, the curtains-class
//     "displacement on hover" done as a pure UV warp on the subject's real pixels.
//   • COMPOSED card (the catalog tile — a panel + brass header + grey rows + ice
//     dot, with NO single texture): the REAL content lives in the chrome child
//     meshes, so there is no texture to UV-warp. The lens instead MAGNIFIES THE
//     CHROME directly — a CPU mirror of the same fisheye field pushes each chrome
//     child's planar offset OUTWARD by `inv` (content under the lens spreads =
//     enlarges) and scales it up, with an extra tangential `rim` edge-stretch near
//     the boundary, easing to the child's exact rest pose at/outside the radius.
//     The panel sheet stays FLAT at the card face so it never rises in front of
//     and occludes the content — the magnified chrome reads THROUGH a transparent
//     glass cap, never under a dark dome.
//
// THE GLASS CAP — a transparent (low-opacity, additive) cosine dome with a bright
// Fresnel-ish RIM RING floats just proud of the lens. It gives the loupe its
// glassy read (a faint highlight + a warm refraction ring at the edge) WITHOUT
// occluding: you see the magnified card straight through it. The `rim` control
// drives the ring's width and brightness — the visible "edge-stretch / refraction
// ring" at the lens boundary. Disengaged, the cap fades to nothing and every
// field collapses to identity → the card is flat and fully legible at rest (the
// rig pins idle t=0 disengaged).
//
// WAVE 3 — TEXTURE-PRESERVING DISPLACEMENT (mountable: true). The 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look, so
// the category is skipped on mounted artifacts (UNMOUNTABLE_CATEGORIES). This
// one PRESERVES the subject's own look: it NEVER mutates the subject's
// material/geometry. It hides the real subject and stands an OVERLAY in its place
// (the scroll-stagger-rise / pointer-loupe discipline):
//   - the sheet's colorNode samples the live `.map` BY REFERENCE through the warp,
//     or — when map-less — carries the live color (tracked uniform) AND copies the
//     PBR scalars (roughness/metalness/envMapIntensity/emissive) so the sheet
//     shades identically under the rig lights. NEVER an invented flat fill.
//   - the chrome children become rigid CLONES (real geometry shared by reference,
//     material clone) carrying their EXACT look — so the brass header / grey rows /
//     ice dot stay legible and tack-sharp, magnified through the lens.
//   - LATE TEXTURE POUR: mounted artifacts pour `.map` asynchronously after
//     bindings attach; every seek re-reads the live material and rebuilds the
//     sheet material the moment the instance OR its map identity changes.
//   - LIVE TRANSFORM TRACKING: co-bindings keep animating the hidden subject;
//     every seek re-syncs the overlay group to the subject's current local pose.
//   - dispose() restores the subject (visibility) and disposes EVERYTHING it
//     created, never the subject's shared map/geometry.
//
// POINTER-RIG: reads target.userData.pointer {x,y} in 0..1; non-finite guarded.
// Engagement = proximity to the card inside the radius (1 at center → 0 at the
// edge), so the harness-pinned engaged point {0.62,0.5} produces a real, visible
// magnification and every control reshapes it there. onParamChange re-applies at
// the last seek state so a paused control sweep takes effect. duration() =
// Infinity (stateful).
//
// DISTINCT FROM NEIGHBORS:
//   - pointer-attract-scale rigidly scales the WHOLE card toward the pointer (one
//     uniform scale, no local optics). Here the magnification is LOCAL to the lens
//     disc — only the region under the lens enlarges, the rest of the card is 1:1.
//   - pointer-loupe (sibling) is a small SHARP-edged loupe disc that floats over a
//     still-visible card. Here the lens is a SOFT, full-radius cosine cap and the
//     card's own content is bodily magnified through it (the chrome rides the
//     fisheye field), not sampled into a hard cutout.

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
  max as tslMax,
  mix,
  positionLocal,
  smoothstep,
  sqrt as tslSqrt,
  texture as tslTexture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Overall strength of the lens — how forcefully the content swells under the
  // cursor (a global gain on the magnification + glass-cap relief). Default = the
  // premium loupe swell.
  { id: 'strength', label: 'Bulge Strength', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.5 },
  // Lens radius as a fraction of the half-span — the size of the affected disc.
  { id: 'radius', label: 'Lens Radius', type: 'knob', min: 0.2, max: 0.9, step: 0.01, default: 0.5 },
  // Optical magnification at the dome center (the §11 fisheye `strength`): how
  // much LARGER the content reads through the lens. The literal heart of the claim.
  { id: 'magnify', label: 'Magnification', type: 'knob', min: 0.05, max: 0.8, step: 0.01, default: 0.45 },
  // The edge-stretch / refraction ring at the lens boundary — how hard content
  // smears tangentially at the rim and how bright the glass ring reads there.
  { id: 'rim', label: 'Rim Refraction', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
] as const;

// Proximity engagement (pointer distance from the card center, in uv units):
// at/inside PROX_INNER the lens is fully engaged; beyond PROX_OUTER it is flat.
// The harness pins the engaged sweep at {0.62,0.5} (dCenter ≈ 0.12, well inside
// PROX_OUTER), so every control reshapes a real lens there; a far-corner idle
// pointer (dCenter ≈ 0.68) lands past PROX_OUTER → fully disengaged (flat).
const PROX_INNER = 0.05;
const PROX_OUTER = 0.62;
// Sheet subdivision — the textured warp lane needs a dense mesh; for the chrome
// path the sheet stays flat so a moderate grid is plenty.
const SEG = 64;
// Map the magnify knob (0.05..0.8) to the fisheye d²·strength coefficient. Tuned
// so the default 0.45 reads as a clear, premium ~1.4-1.6× swell at the center.
const FISHEYE_GAIN = 1.15;
// Glass-cap relief height as a fraction of the lens radius (the transparent
// highlight dome — never the content carrier, so it can be subtle).
const CAP_FRAC = 0.16;

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

/** A chrome child posed rigidly per seek (CPU mirror of the lens field). Offsets
 *  are in the SHEET's frame: ox/oy from the sheet center, dz proud of the sheet
 *  surface; restScale captures the child's original scale. */
interface ChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  restScale: number;
}

export const lensBulgePrimitive: PrimitiveDefinition = {
  name: 'lens-bulge',
  label: 'Lens Bulge',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  mountable: true,
  schema: SCHEMA,
  description:
    'A magnifying bulge swells under the cursor — the surface domes out optically, content magnified and stretching at the rim like glass over paper.',
  create: defineAnimatable(
    { name: 'lens-bulge', category: 'displacement', schema: SCHEMA },
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
      // GEOMETRY-BASED (the genie-suck lesson the cylinder-unroll inherited):
      // each mesh's geometry bbox is mapped mesh-local → subject-local directly
      // — a world-AABB route double-inflates whenever the subject is tilted at
      // measure time. The sheet's w/h covers the UNION of all meshes (Group
      // subjects keep their full footprint) while its face z comes from the
      // REPRESENTATIVE mesh (chrome proud of the face must not push the sheet
      // forward off the panel).
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

      // ── Fallback state ('whole subject domes toward camera') ─────────────
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // ── Lens uniforms (one graph; pointer-local, set per seek) ───────────
      const uCenterX = uniform(0); // lens center, subject-local x
      const uCenterY = uniform(0); // lens center, subject-local y
      const uRadius = uniform(0.5); // lens radius in subject-local units
      const uHeight = uniform(0); // glass-cap relief height (engage × strength × span)
      const uMag = uniform(0.45); // fisheye magnification coefficient
      const uRim = uniform(0.55); // rim refraction / edge-stretch amount
      const uEngage = uniform(0); // proximity engagement 0..1 (0 = flat)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uRimColor = uniform(new Color('#cd9f55')); // warm brass refraction ring

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfSpan = 0.5; // half of min(w,h) — the lens-radius reference
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The TSL fisheye UV warp (texture lane — the optical magnification) ─
      // The sheet's planar uv runs 0..1; map the lens center into uv space and
      // pull the sample radially INWARD inside the disc so the content magnifies:
      //   centered = uv - lensUV; d = |centered|/uvR;
      //   inv = 1/sqrt(1 - d²·mag·gain);           (>1 toward the center)
      //   stretch = (1 + rim·d);                   (tangential edge-stretch ring)
      //   sampleUv = lensUV + centered / (inv·stretch)   (1/inv = magnify)
      const uLensUvX = uniform(0.5);
      const uLensUvY = uniform(0.5);
      const uUvRadius = uniform(0.5);
      const cuvX = uv().x.sub(uLensUvX);
      const cuvY = uv().y.sub(uLensUvY);
      const duv = tslClamp(tslLength(vec2(cuvX, cuvY)).div(tslMax(uUvRadius, float(1e-3))), 0, 1);
      // §11 fisheye magnification: inv = 1/sqrt(1 - d²·mag·gain). Larger toward
      // the center → dividing the sample offset by it pulls the read inward =
      // content reads enlarged.
      const fishZ = tslSqrt(
        tslMax(float(1).sub(duv.mul(duv).mul(uMag.mul(FISHEYE_GAIN))), float(1e-3)),
      );
      const invMag = float(1).div(fishZ); // ≥ 1
      // Tangential edge-stretch ring at the rim, driven by `rim`.
      const rimStretch = float(1).add(uRim.mul(duv));
      const sampleScale = float(1).div(invMag.mul(rimStretch)); // ≤ 1 → magnify
      // Only warp inside the engaged disc; outside or disengaged → identity uv.
      const warpAmt = uEngage.mul(smoothstep(float(1), float(0.9), duv));
      const warpedX = uLensUvX.add(cuvX.mul(mix(float(1), sampleScale, warpAmt)));
      const warpedY = uLensUvY.add(cuvY.mul(mix(float(1), sampleScale, warpAmt)));
      const warpedUv = vec2(tslClamp(warpedX, 0, 1), tslClamp(warpedY, 0, 1));

      // ── Overlay sheet (the hide/overlay texture-preservation pattern) ────
      const overlay = new Group();
      overlay.name = 'lens-bulge-overlay';
      let sheet: Mesh | null = null;
      let glass: Mesh | null = null;
      const chrome: ChromeClone[] = [];

      // What the current sheet material was built FROM — compared against the
      // live source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build the sheet material carrying the subject's OWN look: when the
       *  subject is TEXTURED the colorNode samples the live texture through the
       *  fisheye warp (genuine optical magnification of the real pixels); when
       *  map-less it carries the live color via the tracked uColor uniform and
       *  copies the PBR scalars — never an invented fill. The sheet stays FLAT
       *  (no positionNode dome) so it never rises in front of the content. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
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
          // Derive the warm refraction-ring tone from the subject (lean brass),
          // so it never reads as an invented accent fighting the artifact.
          if (src.color) {
            uRimColor.value.copy(src.color.clone().lerp(new Color('#cd9f55'), 0.6));
          }
        }
        mat.side = DoubleSide;
        const m = mat as unknown as { colorNode: unknown };
        // Texture sampled through the fisheye warp (the optical magnification),
        // or the live color when map-less (chrome carries the content instead).
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, warpedUv) : uColor;
        return mat;
      };

      /** The transparent GLASS CAP: a low-opacity cosine dome with a warm
       *  Fresnel-ish RIM RING, floating just proud of the lens. It NEVER
       *  occludes — additive-blended at low opacity so the magnified content
       *  reads straight through it. `rim` drives the ring width + brightness. */
      const buildGlassMaterial = (): MeshBasicNodeMaterial => {
        const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
        // glass uv is its own 0..1 disc quad; d = distance from the disc center.
        const dGlass = tslLength(uv().sub(vec2(0.5, 0.5))).div(float(0.5));
        const dClamped = tslClamp(dGlass, 0, 1);
        // Soft central highlight (a faint specular cap) — brightest at center.
        const capCos = cos(dClamped.mul(float(Math.PI * 0.5)));
        const highlight = capCos.mul(capCos).mul(float(0.18));
        // Refraction ring near the rim: a bright annulus whose width + brightness
        // scale with `rim`. innerEdge slides inward as rim grows (wider ring).
        const ringInner = float(0.62).sub(uRim.mul(float(0.34)));
        const ring = smoothstep(ringInner, float(0.96), dClamped).mul(
          smoothstep(float(1), float(0.985), dClamped),
        );
        const ringBright = ring.mul(uRim.mul(float(0.9)).add(float(0.12)));
        const m = mat as unknown as {
          colorNode: unknown;
          opacityNode: unknown;
          positionNode: unknown;
        };
        // Warm glass tint: a near-white highlight plus the brass refraction ring.
        m.colorNode = mix(vec3(0.85, 0.85, 0.9), uRimColor, ring);
        // Opacity = (highlight + ring) × engagement, hard-gated to the disc so the
        // glass is invisible outside the lens and when disengaged.
        const discGate = smoothstep(float(1), float(0.96), dClamped);
        m.opacityNode = highlight.add(ringBright).mul(uEngage).mul(discGate);
        // A slight glass relief so the cap catches a touch of parallax — kept low
        // (this is the highlight carrier, never the content carrier).
        const cap = capCos.mul(capCos);
        m.positionNode = vec3(
          positionLocal.x,
          positionLocal.y,
          positionLocal.z.add(uHeight.mul(cap).mul(discGate)),
        );
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfSpan = Math.min(w, h) / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z; // the PANEL's front face (chrome sits proud)

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'lens-bulge-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        sheet.renderOrder = 0;
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the lens as
        // a rigid clone (real geometry shared by reference, material clone),
        // MAGNIFIED per seek by the CPU mirror of the fisheye field. Footprints
        // are measured in the subject's local frame → baked into the sheet frame.
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
            m.name = `lens-bulge-chrome:${child.name || 'mesh'}`;
            // Pre-pose to the child's full local transform so the clone matches
            // exactly at rest (subject-local → sheet-frame offset applied below).
            m.position.copy(child.position);
            m.quaternion.copy(child.quaternion);
            m.scale.copy(child.scale);
            m.renderOrder = 1; // chrome reads OVER the panel sheet, never under it
            overlay.add(m);
            chrome.push({
              mesh: m,
              ox,
              oy,
              dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              restScale: child.scale.x,
            });
          });
        }

        // The transparent glass cap, sized to the lens diameter and floated just
        // proud of the chrome so its highlight + ring read over everything — but
        // additively at low opacity, so it NEVER occludes the magnified content.
        const glassDiam = 2 * clamp(num(params.radius, 0.5), 0.2, 0.9) * halfSpan;
        glass = new Mesh(new PlaneGeometry(glassDiam, glassDiam, 12, 12), buildGlassMaterial());
        glass.name = 'lens-bulge-glass';
        glass.renderOrder = 2;
        overlay.add(glass);

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        // The sheet IS the subject now — hide the original until dispose().
        subject.visible = false;
      }

      // Publish the driven uniforms for the host + headless tests (the
      // water-droplet pattern: no GPU to read pixels from in node).
      const uStrengthPub = uniform(num(params.strength, 0.5));
      // A measurable proof of magnification: the peak content-pull factor applied
      // to a chrome child at the lens center this seek (1 = no magnification).
      const uMagApplied = uniform(1);
      target.userData.lensBulge = {
        uStrength: uStrengthPub,
        uRadius,
        uMag,
        uRim,
        uCenterX,
        uCenterY,
        uEngage,
        uHeight,
        uMagApplied,
        get builtMap(): Texture | null {
          return builtSrcMap;
        },
      };

      /** Read userData.pointer in 0..1, guarding non-finite. */
      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: Partial<PointerXY> }).pointer;
        const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
      };

      /** Proximity engagement 0..1 from the pointer's distance to the card
       *  center: 1 at/inside PROX_INNER, ramping to 0 at PROX_OUTER. Center is
       *  fully engaged, the harness-pinned {0.62,0.5} is strongly engaged, a
       *  far-corner idle pointer is flat. */
      const engagementOf = (ptr: PointerXY): number => {
        const dCenter = Math.hypot(ptr.x - 0.5, ptr.y - 0.5);
        return clamp((PROX_OUTER - dCenter) / (PROX_OUTER - PROX_INNER), 0, 1);
      };

      /** CPU mirror of the fisheye field for the chrome clones: MAGNIFY each
       *  child by pulling its planar offset OUTWARD from the lens center by the
       *  fisheye `inv` (content under the lens spreads = enlarges), scaling it up
       *  by the same factor, with a tangential `rim` edge-stretch near the rim.
       *  Eases to the child's EXACT rest pose at/outside the radius and when
       *  disengaged. Returns the peak applied magnification (for observability). */
      const placeChrome = (
        engage: number,
        magnify: number,
        rim: number,
        strength: number,
        radius: number,
        capHeight: number,
      ): number => {
        if (!chrome.length) return 1;
        const cxLocal = uCenterX.value;
        const cyLocal = uCenterY.value;
        const rSafeV = Math.max(radius, 1e-3);
        const gain = magnify * FISHEYE_GAIN;
        let peak = 1;
        for (const c of chrome) {
          const dx = c.ox - cxLocal;
          const dy = c.oy - cyLocal;
          const r = Math.hypot(dx, dy);
          const dn = Math.min(r / rSafeV, 1);
          // inDisc gate (mirrors the TSL smoothstep(1, 0.92, d)) × engagement.
          const disc = dn >= 1 ? 0 : dn <= 0.92 ? 1 : (1 - dn) / 0.08;
          const field = engage * disc;
          if (field <= 0) {
            // Rest pose: child sits exactly where it started, no lift, no scale.
            c.mesh.position.set(sheetX + c.ox, sheetY + c.oy, faceZ + c.dz);
            c.mesh.scale.setScalar(c.restScale);
            continue;
          }
          // §11 fisheye magnification factor at this radius (≥ 1 toward center).
          const fishZ = Math.sqrt(Math.max(1 - dn * dn * gain, 1e-3));
          const inv = 1 / fishZ;
          // Tangential edge-stretch ring near the rim (driven by rim).
          const rimStretch = 1 + rim * dn;
          // Blend the magnification in by the field (×strength as a global gain).
          const magFactor = 1 + (inv * rimStretch - 1) * field * (0.5 + 0.5 * strength);
          if (magFactor > peak) peak = magFactor;
          // Push the offset OUTWARD from the lens center by magFactor → content
          // spreads = enlarges; centered children spread least (clean dead-center
          // zoom), rim children stretch outward.
          const nx = r > 1e-5 ? dx / r : 0;
          const ny = r > 1e-5 ? dy / r : 0;
          const pulled = r * magFactor;
          const newOx = cxLocal + nx * pulled;
          const newOy = cyLocal + ny * pulled;
          // Lift a hair toward the camera so magnified chrome reads proud of the
          // flat sheet (NOT a tall dome — just enough to sit clearly on top).
          const lift = capHeight * 0.5 * field;
          c.mesh.position.set(sheetX + newOx, sheetY + newOy, faceZ + c.dz + lift);
          c.mesh.scale.setScalar(c.restScale * magFactor);
        }
        return peak;
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const strength = clamp(num(params.strength, 0.5), 0.1, 1);
        const radiusFrac = clamp(num(params.radius, 0.5), 0.2, 0.9);
        const magnify = clamp(num(params.magnify, 0.45), 0.05, 0.8);
        const rim = clamp(num(params.rim, 0.55), 0, 1);
        uStrengthPub.value = strength;
        uMag.value = magnify;
        uRim.value = rim;

        const ptr = readPointer();

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject domes toward the
          // camera by the engaged field (never placeholder geometry). Use a
          // generic half-span so the lift is subject-relative even with no box.
          const ref = localBox
            ? Math.min(localBox.max.x - localBox.min.x, localBox.max.y - localBox.min.y) / 2
            : 1;
          const engage = engagementOf(ptr);
          uEngage.value = engage;
          uHeight.value = engage * strength * ref;
          uMagApplied.value = 1 + engage * (magnify + rim) * strength;
          subject.position.z = baseZ + uHeight.value;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the
        // live source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // ── Lens placement in subject-local space ──────────────────────────
        // Pointer uv (0..1) maps to the sheet's planar extent: uv 0 = min edge.
        const w = localBox!.max.x - localBox!.min.x;
        const h = localBox!.max.y - localBox!.min.y;
        const localX = localBox!.min.x + ptr.x * w;
        const localY = localBox!.min.y + ptr.y * h;
        uCenterX.value = localX;
        uCenterY.value = localY;
        // The lens uv center mirrors the pointer; the uv radius is the lens radius
        // expressed in uv units (radius is a fraction of the half-span, and uv
        // spans the full sheet, so uvRadius = radiusFrac·halfSpan/min(w,h)).
        uLensUvX.value = ptr.x;
        uLensUvY.value = ptr.y;
        const radiusLocal = radiusFrac * halfSpan;
        uRadius.value = radiusLocal;
        uUvRadius.value = radiusLocal / Math.min(w, h);

        // Engagement: the lens is centered on the POINTER, so engagement reads
        // "is the pointer over the card?" — full over the interior, fading to flat
        // as the pointer heads to a far corner.
        const engage = engagementOf(ptr);
        uEngage.value = engage;
        // Glass-cap relief height (the transparent highlight dome, kept low).
        const capHeight = engage * strength * radiusLocal * CAP_FRAC * 2;
        uHeight.value = capHeight;

        // Magnify the real content (chrome) and float the glass cap on it.
        const peakMag = placeChrome(engage, magnify, rim, strength, radiusLocal, capHeight);
        if (chrome.length > 0) {
          uMagApplied.value = peakMag;
        } else {
          // No chrome to magnify (a single textured subject): the magnification
          // lives in the UV warp lane instead. Report the analytic peak center
          // magnification 1/sqrt(1 - mag·gain), blended by engagement, so the
          // observability signal is honest for textured artifacts too.
          const fishZ0 = Math.sqrt(Math.max(1 - magnify * FISHEYE_GAIN, 1e-3));
          const centerMag = 1 / fishZ0; // ≥ 1
          uMagApplied.value = 1 + (centerMag - 1) * engage * (0.5 + 0.5 * strength);
        }

        if (glass) {
          // The glass cap tracks the lens center + diameter; built at the create-
          // time radius, scaled per seek to the live radius control.
          glass.position.set(localX, localY, faceZ + capHeight + Math.max(radiusLocal * 0.02, 1e-3));
          const builtDiam = 2 * clamp(num(params.radius, 0.5), 0.2, 0.9) * halfSpan;
          glass.scale.setScalar(builtDiam > 1e-6 ? (2 * radiusLocal) / builtDiam : 1);
        }
      };

      // Deterministic initial state. The rig pins idle at t=0 with the pointer
      // disengaged — apply once so a fresh instance is in a valid (flat) state.
      apply(0);

      return {
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at a frozen t) take effect without a new seek.
        onParamChange: () => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            if (glass) {
              glass.geometry.dispose();
              (glass.material as Material).dispose();
              glass = null;
            }
            for (const c of chrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            chrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.position.z = baseZ;
          }
        },
      };
    },
  ),
};
