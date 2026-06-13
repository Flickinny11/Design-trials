// pointer-twist-warp — the cursor wrings the surface. A LOCAL twist vortex
// centered on the pointer's subject-space position rotates the content around
// the pointer; the rotation angle decays with radius (a classic swirl kernel),
// and an elastic engagement envelope untwists smoothly as the pointer leaves
// rather than snapping back. MEDIUM / pointer / TEXTURE-PRESERVING displacement.
//
// DESIGN-REFERENCES §11 ("Advanced Shader Techniques Cookbook" — the swirl /
// fisheye lens-distortion family) made pointer-localized, fused with the §1
// curtains.js/VFX-JS hover-distortion class (a mouse-reactive uniform pushing
// the image's OWN texture around). Implemented natively in TSL on three/webgpu.
//
// THE WAVE-3 DIFFERENTIATOR (texture-preserving, mountable): the 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look —
// which is why the category sits in UNMOUNTABLE_CATEGORIES. This one carries the
// subject's OWN look THROUGH the distortion (the curtains move), so it declares
// `mountable: true` and the AI builder may drop it on ANY mounted element:
//   - The subject's materials/geometry are NEVER mutated. A subdivided sheet
//     overlay (sized/placed from the subject's MEASURED local bbox — never
//     hardcoded world units) stands in; the subject is hidden while the sheet is
//     active and restored on dispose().
//   - colorNode samples the live `.map` BY REFERENCE (sampled at the swirl-
//     warped UV — the content visibly wrings), re-checked EVERY seek so a
//     mounted artifact's ASYNC texture pour / material swap rebuilds the sheet
//     material. Map-less subjects copy color + PBR scalars onto the node
//     material so it shades identically under the rig — never an invented fill.
//
// THE SWIRL FIELD F(p, t, params), one analytic kernel shared by the vertex
// lane, the UV lane, and the CPU chrome poser:
//   d      = |p_xy - center|                       (subject-local distance)
//   fall   = smoothstep(radius, 0, d)              (1 at the core → 0 at radius)
//   ang    = strength * engage * fall              (twist, decays with radius)
//   p'_xy  = rotate(p_xy, center, ang)             (in-plane swirl)
//   p'_z  += lift * fall * engage                  (tiny z bulge at the vortex)
// The UV is COUNTER-rotated by -ang about the pointer so the sampled texture
// content rotates WITH the surface (curtains-class wring). `engage` is the
// elastic envelope (below) so the whole field breathes in and out smoothly.
//
// POINTER-RIG FACTS encoded:
//   - Pointer arrives as target.userData.pointer {x,y} in 0..1 (UV space, the
//     pointer-tilt-3d convention); guarded for non-finite. Its subject-local
//     position is center = (pointer - 0.5) * span, so 0.62 → just right of the
//     panel center, and y is flipped (UV-v up vs local-y up handled in mapping).
//   - ENGAGEMENT envelope (the elastic untwist): proximity = how centered the
//     pointer is on the subject (1 at center → 0 off it). A dt-normalized
//     damped lerp drives uEngage toward proximity; disengage (pointer leaves)
//     unwinds the vortex through that damped return instead of snapping. dt is
//     the clamped delta of consecutive seek times. The control `damping` sets
//     the return speed, so a sweep of it visibly changes how fast it unwinds.
//   - The harness pins the engaged pointer at {x:0.62, y:0.5} (proximity high)
//     and repeats seeks at a held t for CONTROL sweeps: onParamChange re-applies
//     the field at the last seek state, so radius/strength/lift/damping all
//     reshape the frozen frame. The idle frame (t=0, pointer DISENGAGED) decays
//     uEngage → 0, leaving the card fully legible and essentially undistorted.
//   - FRAMING: radius is a FRACTION of the subject span and lift is a FRACTION
//     of it too, so the whole envelope stays inside the tile at default params,
//     and everything scales to a 1.8-unit catalog card or a 40-unit hero alike.
//
// CHROME CO-TREATMENT (composite card subject): the brass header, grey rows,
// and violet dot become RIGID CLONES (real child geometry shared by reference +
// a material clone) POSED per seek by a CPU mirror of the swirl field at each
// child's center — a row near the vortex visibly COCKS (rotates about the
// pointer) and shifts toward it. Rigid (not vertex-bent) because the swirl is an
// in-plane RIGID rotation about the pointer — evaluating it at the child center
// captures it exactly, and a sphere/short-bar would only distort under
// subdivision. With nothing to overlay (no geometry/material/parent) the WHOLE
// subject twists rigidly instead — nothing spawned, restored exactly on dispose.
//
// DISTINCT from its neighbors: swirl-warp is a TIME-driven whole-surface swirl
// that SWAPS the material (unmountable, no pointer, no elastic return);
// pointer-orbit rigidly orbits the whole card around a point (no per-vertex
// falloff, no local vortex). pointer-twist-warp is the only one that wrings a
// LOCAL, pointer-centered vortex into the subject's OWN preserved content and
// untwists elastically as the cursor leaves.

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
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  cos,
  float,
  length as tslLength,
  max as tslMax,
  positionLocal,
  sin,
  smoothstep,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  uv as tslUv,
  vec2,
  vec3,
  faceDirection,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Twist strength — peak swirl angle (radians) at the vortex core, before the
  // engagement envelope scales it. ~1.1 rad reads as a confident wring.
  { id: 'strength', label: 'Twist Strength', type: 'knob', min: 0.2, max: 2.2, step: 0.05, default: 1.1, unit: 'rad' },
  // Vortex radius as a FRACTION of the subject span — scale-free framing.
  { id: 'radius', label: 'Vortex Radius', type: 'knob', min: 0.18, max: 0.9, step: 0.01, default: 0.5 },
  // Core lift as a FRACTION of the span — a small z bulge at the vortex so the
  // wring catches the rig key light. 0 = perfectly in-plane.
  { id: 'lift', label: 'Core Lift', type: 'fader', min: 0, max: 0.4, step: 0.01, default: 0.12 },
  // Untwist damping — how fast the engagement envelope unwinds when the pointer
  // leaves. Higher = snappier elastic return; lower = a long, languid unwind.
  { id: 'damping', label: 'Untwist Damping', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
] as const;

// Sheet subdivision (both axes — the vortex can sit anywhere on the surface).
const SEG = 72;
// Max per-seek dt (s) used to normalize the damped envelope — guards against a
// huge jump (paused tab) snapping the return.
const MAX_DT = 1 / 30;
// Proximity falloff: how the pointer's centeredness maps to target engagement.
// The pointer is "engaged" while it sits within ENGAGE_REACH spans of center.
const ENGAGE_REACH = 0.85;
// Fallback whole-subject twist swing (radians) at full engagement.
const FALLBACK_SWING = 0.9;

interface PointerXY {
  x: number;
  y: number;
}

/** Read userData.pointer {x,y} in 0..1, guarded for non-finite (the rig may
 *  feed NaN/Infinity at the edges). Defaults to center. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = (userData as { pointer?: Partial<PointerXY> }).pointer;
  return {
    x: num(p?.x as number | undefined, 0.5),
    y: num(p?.y as number | undefined, 0.5),
  };
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

/** A chrome child posed rigidly per seek (CPU mirror of the swirl field).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center, dz proud of
 *  the sheet surface. baseRotZ is the child's own settled z-rotation. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  baseRotZ: number;
}

export const pointerTwistWarpPrimitive: PrimitiveDefinition = {
  name: 'pointer-twist-warp',
  label: 'Pointer Twist Warp',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  // TEXTURE-PRESERVING (W3): carries the subject's own look through the twist,
  // so it runs on mounted artifacts despite the 'displacement' category skip.
  mountable: true,
  description:
    'The cursor wrings the surface — a local twist vortex rotating the content around the pointer, untwisting smoothly as it leaves.',
  create: defineAnimatable(
    { name: 'pointer-twist-warp', category: 'displacement', schema: SCHEMA },
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
      // GEOMETRY-BASED (the genie-suck lesson, inherited from cylinder-unroll):
      // each mesh's geometry bbox is mapped mesh-local → subject-local directly;
      // a world-AABB route double-inflates whenever the subject is tilted at
      // measure time. The sheet's w/h covers the UNION of all meshes; its face z
      // comes from the REPRESENTATIVE mesh (chrome proud of the face must not
      // push the sheet forward off the panel).
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

      // ── Fallback state (whole subject twists rigidly about its center) ───
      const baseRotZ = subject.rotation.z;
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // ── Swirl uniforms (one analytic kernel serves vertex + uv + chrome) ──
      const uCenter = uniform(vec2(0, 0)); // vortex center, subject-local xy
      const uAngle = uniform(0); // effective twist = strength * engage (rad)
      const uRadius = uniform(0.5); // absolute local-unit falloff radius
      const uLift = uniform(0); // absolute local-unit core z bulge
      const uEngage = uniform(0); // elastic engagement envelope 0..1
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let spanRef = 1; // max(width,height) — scale reference for radius/lift
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The TSL swirl bend (built ONCE, shared sheet + uv) ───────────────
      // Distance from the vortex center in the sheet's local xy.
      const rel2 = vec2(positionLocal.x, positionLocal.y).sub(uCenter);
      const dist = tslLength(rel2);
      // Falloff: 1 at the core → 0 at the radius (classic swirl decay).
      const fall = smoothstep(uRadius, float(0), dist);
      // Local twist angle at this vertex.
      const ang = uAngle.mul(fall);
      const ca = cos(ang);
      const sa = sin(ang);
      // In-plane rotation of (x,y) about the center.
      const rx = rel2.x.mul(ca).sub(rel2.y.mul(sa));
      const ry = rel2.x.mul(sa).add(rel2.y.mul(ca));
      const twistedX = uCenter.x.add(rx);
      const twistedY = uCenter.y.add(ry);
      // Core z bulge — a small lift peaking at the vortex (engagement-scaled
      // through uLift's set value, but spatially weighted by the falloff).
      const zLift = uLift.mul(fall);
      const bentPos = vec3(twistedX, twistedY, positionLocal.z.add(zLift));
      // Honest bent normal: a rotational in-plane field tilts the surface by a
      // small radial slope where the lift rises/falls. dz/dr is largest at the
      // mid-falloff; approximate the tilt with the radial gradient of the lift,
      // pointing the normal slightly outward where the bulge climbs. Multiply by
      // faceDirection so a DoubleSide back face still shades (custom normalNode
      // bypasses three's automatic flip).
      const radialDir = vec2(
        rel2.x.div(tslMax(dist, float(1e-4))),
        rel2.y.div(tslMax(dist, float(1e-4))),
      );
      // Slope of the bulge: lift * d(fall)/dr. Approximated by a smooth ramp so
      // the wring catches light without a true derivative (visual, not exact).
      const slope = uLift.mul(fall).mul(float(2)).div(tslMax(uRadius, float(1e-4)));
      const bentNormal = vec3(
        radialDir.x.mul(slope).negate(),
        radialDir.y.mul(slope).negate(),
        float(1),
      ).normalize();
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── UV-lane counter-rotation (the curtains-class wring) ──────────────
      // Map the vortex center from sheet-local xy → uv (0..1). The sheet spans
      // [-halfW,halfW] x [-halfH,halfH] in its own frame; uv.x = x/(2*halfW)+0.5,
      // uv.y = y/(2*halfH)+0.5. Uniforms carry that mapping so it tracks live.
      const uUvCenter = uniform(vec2(0.5, 0.5));
      const uUvRadius = uniform(0.5); // falloff radius in uv units
      const uvBase = tslUv();
      const uvRel = uvBase.sub(uUvCenter);
      const uvDist = tslLength(uvRel);
      const uvFall = smoothstep(uUvRadius, float(0), uvDist);
      // Counter-rotate the UV by -ang so the texture content rotates WITH the
      // surface (a point that moved +ang in space samples from -ang in texture).
      const uvAng = uAngle.mul(uvFall).negate();
      const uca = cos(uvAng);
      const usa = sin(uvAng);
      const uvX = uvRel.x.mul(uca).sub(uvRel.y.mul(usa));
      const uvY = uvRel.x.mul(usa).add(uvRel.y.mul(uca));
      const warpedUv = vec2(uUvCenter.x.add(uvX), uUvCenter.y.add(uvY));

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ─────────
      const overlay = new Group();
      overlay.name = 'pointer-twist-warp-overlay';
      let sheet: Mesh | null = null;
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM — compared against the
      // live source each seek (async texture pour / material swap → rebuild).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture by reference AT THE WARPED UV (the content
       *  wrings), or the live color via uColor — never an invented fill. PBR
       *  scalars are copied so the sheet shades identically under the rig. */
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
          uOpacity.value = src.opacity;
        }
        // The lifted vortex can show a grazing back face under DoubleSide.
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
        };
        // Sample the shared texture at the warped uv (wring), else the tracked
        // live color uniform. NEVER an invented flat fill.
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, warpedUv) : uColor;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        spanRef = Math.max(w, h);
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z; // the PANEL's front face (chrome sits proud)

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'pointer-twist-warp-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh rides the field as a
        // RIGID clone (the swirl is an in-plane rigid rotation about the
        // pointer; evaluating it at each child center captures it exactly).
        // Geometry shared by reference (never disposed by us); material cloned.
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
            m.name = `pointer-twist-warp-chrome:${child.name || 'mesh'}`;
            // Preserve the child's own non-translation pose (rotation/scale) so
            // the clone reads identically before the field rotates it.
            m.quaternion.copy(child.quaternion);
            m.scale.copy(child.scale);
            overlay.add(m);
            rigidChrome.push({
              mesh: m,
              ox,
              oy,
              dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              baseRotZ: m.rotation.z,
            });
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        // The sheet IS the subject now — hide the original until dispose().
        subject.visible = false;
      }

      /** CPU mirror of the TSL swirl for the rigid chrome clones: rotate each
       *  child's center about the vortex by the local twist angle (= effective
       *  angle * falloff at that center), lift it along z by the same falloff,
       *  and COCK the clone (rotation.z += local angle) so a row near the vortex
       *  visibly turns. Disengagement unwinds it via uEngage. */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        const cx = uCenter.value.x;
        const cy = uCenter.value.y;
        const r = Math.max(uRadius.value, 1e-4);
        const ang = uAngle.value;
        const lift = uLift.value;
        for (const c of rigidChrome) {
          const dx = c.ox - cx;
          const dy = c.oy - cy;
          const d = Math.hypot(dx, dy);
          // smoothstep(r, 0, d): 1 at core → 0 at radius.
          const tnorm = clamp(1 - d / r, 0, 1);
          const fall = tnorm * tnorm * (3 - 2 * tnorm);
          const local = ang * fall;
          const ca = Math.cos(local);
          const sa = Math.sin(local);
          const nx = cx + (dx * ca - dy * sa);
          const ny = cy + (dx * sa + dy * ca);
          const zl = lift * fall;
          c.mesh.position.set(sheetX + nx, sheetY + ny, faceZ + c.dz + zl);
          c.mesh.rotation.z = c.baseRotZ + local;
        }
      };

      // Publish the driven uniforms for the host + headless tests (the
      // water-droplet pattern: no GPU to read pixels from in node).
      target.userData.pointerTwistWarp = {
        uAngle, uCenter, uRadius, uLift, uEngage, uColor,
      };

      let lastT = 0;
      let lastSeekT = 0; // for dt-normalized envelope smoothing
      let initialized = false;

      const apply = (t: number) => {
        // dt from consecutive seek times (clamped) — never Math.random, never
        // wall-clock: deterministic given the seek schedule.
        const dtRaw = initialized ? t - lastSeekT : 0;
        const dt = clamp(Number.isFinite(dtRaw) ? dtRaw : 0, 0, MAX_DT);
        lastSeekT = t;
        initialized = true;
        lastT = t;

        const { x: px, y: py } = readPointer(target.userData);
        const strength = clamp(num(params.strength, 1.1), 0, 2.2);
        const radiusFrac = clamp(num(params.radius, 0.5), 0.05, 1);
        const liftFrac = clamp(num(params.lift, 0.12), 0, 0.5);
        const damping = clamp(num(params.damping, 5), 0.2, 20);

        // Pointer (0..1 uv) → subject-local position. The sheet spans
        // [-halfW,halfW] x [-halfH,halfH]; uv.x maps linearly to x, and uv.y is
        // flipped (texture-v runs bottom→top, local-y likewise here, but the
        // host reports pointer.y top→down on screen — flip so a high y sits at
        // the top of the card).
        const cxLocal = (px - 0.5) * (halfW * 2) + sheetX;
        const cyLocal = (0.5 - py) * (halfH * 2) + sheetY;

        // Proximity / target engagement: 1 when the pointer sits on the subject
        // near center, decaying to 0 as it leaves. Measured in span units so it
        // is scale-free. A pointer far outside (the disengaged idle frame, or a
        // parked off-card pointer) drives target → 0.
        const reach = ENGAGE_REACH * spanRef;
        const distToCenter = Math.hypot(cxLocal - sheetX, cyLocal - sheetY);
        const proximity = clamp(1 - distToCenter / Math.max(reach, 1e-4), 0, 1);

        // Elastic engagement: damped lerp toward proximity. dt-normalized so the
        // return speed is frame-rate-independent; `damping` sets how fast it
        // unwinds when the pointer leaves (proximity drops). At dt=0 (the rig's
        // repeated-seek-at-held-t control sweeps) it holds steady — controls
        // still reshape the frame because uAngle/uRadius/uLift are recomputed
        // from the current params and the held engagement below.
        const k = 1 - Math.exp(-damping * dt);
        uEngage.value += (proximity - uEngage.value) * k;
        // Snap tiny residuals so the idle frame is exactly legible.
        if (uEngage.value < 1e-4) uEngage.value = 0;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — twist the WHOLE subject rigidly about
          // its center by the engaged swing (never placeholder geometry). A
          // small z lift rides the engagement too.
          subject.rotation.z = baseRotZ + FALLBACK_SWING * strength * uEngage.value;
          subject.position.z = baseZ + liftFrac * uEngage.value;
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

        // Drive the swirl field. Effective angle scales with engagement so the
        // whole vortex breathes in and out smoothly (the elastic untwist).
        uCenter.value.set(cxLocal, cyLocal);
        uAngle.value = strength * uEngage.value;
        uRadius.value = radiusFrac * spanRef;
        uLift.value = liftFrac * spanRef * uEngage.value;

        // UV-lane mapping: vortex center + radius in uv units (sheet frame →
        // uv). uv.x = (x - sheetX)/(2*halfW) + 0.5; flip y to match the warpedUv
        // counter-rotation reading top→down screen space.
        const uvCx = (cxLocal - sheetX) / Math.max(halfW * 2, 1e-4) + 0.5;
        const uvCy = (cyLocal - sheetY) / Math.max(halfH * 2, 1e-4) + 0.5;
        uUvCenter.value.set(clamp(uvCx, -1, 2), clamp(uvCy, -1, 2));
        uUvRadius.value = radiusFrac * (spanRef / Math.max(halfW * 2, halfH * 2, 1e-4));

        // Rigid chrome re-poses on the swirl field every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0, disengaged).
      apply(0);

      return {
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at a held t) take effect without a new seek.
        onParamChange: () => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const c of rigidChrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            rigidChrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.rotation.z = baseRotZ;
            subject.position.z = baseZ;
          }
        },
      };
    },
  ),
};
