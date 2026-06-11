'use client';

// PRISM EDITOR CHROME LAYER — TSL slab materials (UI-FIDELITY-2 W1).
//
// One node graph per material FAMILY (uikit batching rule: draw calls scale
// with material classes), styles selected per instance:
//   opaque family — metal (1) / ceramic (2) / well (3)
//   glass family  — smoked refractive glass (styleId 0)
//
// The techniques are the DESIGN-REFERENCES catalog, TSL-native:
//   §8 ray-marching/SDF        → rounded-box SDF chrome, fwidth AA,
//                                 bevel normals from the SDF gradient
//   §3 TSL/WebGPU              → the entire graph; viewport-texture
//                                 refraction of the LIVE scene (zero passes)
//   §11 cookbook (RGB shift,
//       heat refraction)       → 3-tap chromatic dispersion in the glass lens
//   §9 noise                   → brushed-metal micro-normals, ceramic grain
//   §7 cursor physics          → uPointer magnetic border glow (the SDF
//                                 border band IS the magnetic track)
//
// Real physics, not approximations: bevel normals feed normalNode on
// MeshPhysicalNodeMaterial, so GGX speculars, Fresnel edge response and IBL
// reflections come from the renderer against the live scene environment.

import * as THREE from 'three/webgpu';
import { DS } from '@/components/editor/design-system';
import { tsl, type TSLNode, type TSLUniform } from './tsl';

const {
  uniform, uv, vec2, vec3, vec4, float, mix, step, smoothstep, clamp, length,
  normalize, abs, min, max, exp, fwidth, dFdx, dFdy, instancedBufferAttribute,
  viewportMipTexture, viewportSafeUV, screenUV, mx_noise_float,
} = tsl;

export interface ChromeUniforms {
  /** Pointer position, CSS px viewport coords (y down). */
  pointer: TSLUniform<THREE.Vector2>;
  /** 0..1 pointer presence (fades when the pointer leaves the window). */
  pointerActive: TSLUniform<number>;
}

export interface ChromeInstanceBuffers {
  /** vec2 slab size (CSS px). */
  aSize: THREE.InstancedBufferAttribute;
  /** vec2 slab center (CSS px viewport coords, y down). */
  aCenter: THREE.InstancedBufferAttribute;
  /** vec4 corner radii px (tl, tr, br, bl). */
  aRadii: THREE.InstancedBufferAttribute;
  /** vec4 (borderPx, accent, hover, press) — hover/press pre-damped CPU-side. */
  aState: THREE.InstancedBufferAttribute;
  /** vec4 (frost, brushAxis 0|1, styleId, reserved). */
  aMisc: THREE.InstancedBufferAttribute;
}

const BRASS = new THREE.Color(DS.brass400);
const BRASS_HI = new THREE.Color(DS.brass200);
const ICE = new THREE.Color(DS.ice400);
const METAL_TOP = new THREE.Color('#353b4e');
const METAL_BOT = new THREE.Color('#13161f');
const CERAMIC_TOP = new THREE.Color('#23283a');
const CERAMIC_BOT = new THREE.Color('#161a28');
const WELL_TOP = new THREE.Color('#0a0c14');
const WELL_BOT = new THREE.Color('#10131e');
const GLASS_TINT = new THREE.Color('#141826');

const c3 = (c: THREE.Color) => vec3(c.r, c.g, c.b);

export function createChromeUniforms(): ChromeUniforms {
  return {
    pointer: uniform(new THREE.Vector2(-4096, -4096)),
    pointerActive: uniform(0),
  };
}

interface SlabCommon {
  p: TSLNode;
  size: TSLNode;
  state: TSLNode;
  misc: TSLNode;
  d: TSLNode;
  coverage: TSLNode;
  gradDir: TSLNode;
  fillet: TSLNode;
  keyline: TSLNode;
  magneticGlow: TSLNode;
  sheen: TSLNode;
}

/**
 * Shared SDF plumbing. All math in CSS-px slab-local space, y DOWN
 * (matches viewport coords so pointer math needs no flips).
 */
function slabCommon(bufs: ChromeInstanceBuffers, u: ChromeUniforms): SlabCommon {
  const size = instancedBufferAttribute(bufs.aSize);
  const center = instancedBufferAttribute(bufs.aCenter);
  const radii = instancedBufferAttribute(bufs.aRadii);
  const state = instancedBufferAttribute(bufs.aState);
  const misc = instancedBufferAttribute(bufs.aMisc);

  // PlaneGeometry uv: (0,0) bottom-left → local px, y down:
  const p = vec2(uv().x.sub(0.5).mul(size.x), float(0.5).sub(uv().y).mul(size.y));

  // Per-quadrant corner radius (tl, tr, br, bl) in y-down space.
  const rTop = mix(radii.x, radii.y, step(0.0, p.x)); // p.y < 0 (top edge)
  const rBot = mix(radii.w, radii.z, step(0.0, p.x)); // p.y > 0 (bottom edge)
  const r = mix(rTop, rBot, step(0.0, p.y));

  // Rounded-box SDF (IQ), px units. Negative inside.
  const half = vec2(size.x.mul(0.5), size.y.mul(0.5));
  const q = abs(p).sub(half).add(r);
  const d = min(max(q.x, q.y), 0.0).add(length(max(q, vec2(0.0, 0.0)))).sub(r);

  // Coverage with screen-space-derivative AA (never a fixed epsilon).
  const coverage = clamp(float(0.5).sub(d.div(fwidth(d).max(1e-4))), 0.0, 1.0);

  // SDF gradient via derivatives → outward edge direction (screen space).
  const gradDir = normalize(vec2(dFdx(d), dFdy(d)).add(vec2(1e-5, 0.0)));

  // Bevel profile: 0 on the flat face → 1 at the rim, circular fillet.
  const borderPx = state.x;
  const bevelPx = borderPx.mul(2.0).add(4.0);
  const bevelT = smoothstep(bevelPx.negate(), 0.0, d);
  const fillet = bevelT.mul(bevelT).mul(float(3.0).sub(bevelT.mul(2.0)));

  // Border keyline band (the .ds-edge 1px masked border, now lit geometry).
  const keyline = float(1.0).sub(smoothstep(0.0, borderPx.max(1.0), abs(d.add(borderPx))));

  // Pointer, slab-local (CSS px, y down) — magnetic glow rides the SDF band.
  const pointerLocal = vec2(u.pointer.x, u.pointer.y).sub(center);
  const pointerDist = length(p.sub(pointerLocal));
  const magnet = exp(pointerDist.mul(pointerDist).div(-14400.0)).mul(u.pointerActive); // σ≈120px
  const borderBand = float(1.0).sub(smoothstep(0.0, bevelPx, abs(d)));
  const magneticGlow = magnet.mul(borderBand);

  // Soft face sheen toward the pointer (the real speculars come from the
  // PointLight; this keeps faces away from the light from going dead).
  const sheen = exp(pointerDist.mul(pointerDist).div(-90000.0)).mul(0.35).mul(u.pointerActive);

  return { p, size, state, misc, d, coverage, gradDir, fillet, keyline, magneticGlow, sheen };
}

/**
 * Local-space normal from the bevel: flat face = +z; rim rolls outward.
 * Screen y-down gradient → plane local y-up flip. `sink` = -1 inverts (wells).
 */
function bevelNormal(gradDir: TSLNode, fillet: TSLNode, strength: number, sink = 1): TSLNode {
  const slope = fillet.mul(strength * sink);
  return normalize(vec3(gradDir.x.mul(slope), gradDir.y.mul(slope).negate(), 1.0));
}

const brassGradient = (t: TSLNode | number) => mix(c3(BRASS_HI), c3(BRASS), t);


/** Opaque family: metal (1) / ceramic (2) / well (3) selected per instance. */
export function createOpaqueSlabMaterial(
  bufs: ChromeInstanceBuffers,
  u: ChromeUniforms,
): THREE.MeshPhysicalNodeMaterial {
  const m = new THREE.MeshPhysicalNodeMaterial();
  // Node-slot assignments go through a permissive view (same escape-hatch
  // rationale as ./tsl.ts — the runtime accepts any compatible node).
  const n = m as unknown as Record<string, unknown>;
  const c = slabCommon(bufs, u);
  const styleId = c.misc.z;
  const isMetal = step(0.5, styleId).mul(step(styleId, 1.5));
  const isCeramic = step(1.5, styleId).mul(step(styleId, 2.5));
  const isWell = step(2.5, styleId);
  const hover = c.state.z;
  const press = c.state.w;
  const accent = c.state.y;

  // Vertical plate gradient per style (the tokens.css ramps, now lit).
  const vT = uv().y.oneMinus(); // 0 at top of slab → 1 at bottom
  const metalBase = mix(c3(METAL_TOP), c3(METAL_BOT), vT);
  const ceramicBase = mix(c3(CERAMIC_TOP), c3(CERAMIC_BOT), vT);
  const wellBase = mix(c3(WELL_TOP), c3(WELL_BOT), vT);

  // §9 noise — brushed-metal streaks: noise stretched hard along the brush
  // axis perturbs normal + roughness (anisotropic read under a moving light).
  const brushAxis = c.misc.y; // 0 = x, 1 = y
  const brushUV = mix(
    vec2(c.p.x.mul(0.012), c.p.y.mul(0.55)),
    vec2(c.p.x.mul(0.55), c.p.y.mul(0.012)),
    brushAxis,
  );
  const brush = mx_noise_float(vec3(brushUV.x, brushUV.y, 7.0));
  const grain = mx_noise_float(vec3(c.p.x.mul(0.9), c.p.y.mul(0.9), 3.0));

  const baseColor = metalBase.mul(isMetal).add(ceramicBase.mul(isCeramic)).add(wellBase.mul(isWell));
  // Brass accent wash on active/hover keys (replaces activeKeyStyle tint).
  const accented = mix(
    baseColor,
    baseColor.add(brassGradient(vT).mul(0.3)),
    accent.mul(0.85).add(hover.mul(0.15)),
  ) as TSLNode;
  n.colorNode = vec4(accented.mul(press.mul(-0.18).add(1.0)), 1.0);

  // Wells sink inward (inverted bevel); plates rise. Brushing/grain on top.
  const plateNormal = bevelNormal(c.gradDir, c.fillet, 1.35, 1);
  const wellNormal = bevelNormal(c.gradDir, c.fillet, 1.1, -1);
  const microXY = vec2(
    brush.mul(0.1).mul(isMetal),
    brush.mul(0.04).mul(isMetal).add(grain.mul(0.03).mul(isCeramic)),
  );
  const baseNormal = mix(plateNormal, wellNormal, isWell);
  n.normalNode = normalize(vec3(baseNormal.x.add(microXY.x), baseNormal.y.add(microXY.y), baseNormal.z));

  n.metalnessNode = isMetal.mul(0.92).add(isCeramic.mul(0.08)).add(isWell.mul(0.25));
  n.roughnessNode = isMetal
    .mul(float(0.34).add(brush.mul(0.1)).sub(hover.mul(0.06)))
    .add(isCeramic.mul(float(0.46).add(grain.mul(0.06))))
    .add(isWell.mul(0.7));
  n.clearcoatNode = isCeramic.mul(0.85).add(isMetal.mul(0.15));
  n.clearcoatRoughnessNode = float(0.3);

  // Emissive: brass keyline + magnetic pointer glow + pointer sheen + a
  // static top-edge glint so pointer-less frames still read dimensional.
  const keylineColor = brassGradient(vT).mul(c.keyline).mul(accent.mul(1.4).add(0.5));
  const magnetGlow = brassGradient(0.2).mul(c.magneticGlow).mul(0.85);
  const sheenGlow = c3(ICE).mul(c.sheen).mul(0.16);
  const topGlint = vec3(0.9, 0.85, 0.7).mul(smoothstep(0.1, 0.0, vT).mul(0.035)).mul(isMetal);
  n.emissiveNode = mix(
    keylineColor.add(magnetGlow).add(sheenGlow).add(topGlint),
    vec3(0.0, 0.0, 0.0),
    isWell.mul(0.7),
  );

  n.opacityNode = c.coverage;
  m.transparent = true;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.envMapIntensity = 0.9;
  return m;
}

/** Glass family: smoked refractive glass — refracts the LIVE scene. */
export function createGlassSlabMaterial(
  bufs: ChromeInstanceBuffers,
  u: ChromeUniforms,
): THREE.MeshPhysicalNodeMaterial {
  const m = new THREE.MeshPhysicalNodeMaterial();
  const n = m as unknown as Record<string, unknown>;
  const c = slabCommon(bufs, u);
  const hover = c.state.z;
  const accent = c.state.y;
  const frost = c.misc.x;

  // ── The lens: edge-weighted refraction of what the scene just rendered.
  // Shift direction = SDF gradient (outward); magnitude peaks at the rim —
  // the liquid-glass read, but sampling a LIVE photoreal scene.
  // viewportSafeUV guards against foreground smear (TSL wiki guidance).
  const lensPx = c.fillet.mul(14.0).add(1.5);
  const shiftUV = c.gradDir.mul(lensPx).mul(0.0012);

  const frostMip = frost.mul(3.2).add(hover.mul(0.8)).add(c.fillet.mul(1.4));
  const uvR = viewportSafeUV(screenUV.add(shiftUV.mul(1.12)));
  const uvG = viewportSafeUV(screenUV.add(shiftUV));
  const uvB = viewportSafeUV(screenUV.add(shiftUV.mul(0.88)));
  const refracted = vec3(
    viewportMipTexture(uvR).level(frostMip).r,
    viewportMipTexture(uvG).level(frostMip).g,
    viewportMipTexture(uvB).level(frostMip).b,
  );

  // Beer–Lambert smoked tint, thicker at the rim (the bevel doubles as depth).
  const thickness = c.fillet.mul(2.2).add(1.0);
  const absorb = vec3(0.18, 0.16, 0.1); // smoked brass: pass warm, sink blue
  const tinted = refracted.mul(exp(absorb.mul(thickness).negate()));
  // Lift toward the panel tone so DOM text always has contrast footing.
  const glassBody = mix(tinted, c3(GLASS_TINT), float(0.22).add(frost.mul(0.08)));

  n.backdropNode = vec4(glassBody, 1.0);
  n.backdropAlphaNode = c.coverage;

  // Lit skin over the transmission: near-black diffuse, real speculars.
  n.colorNode = vec4(0.02, 0.022, 0.03, 1.0);
  n.normalNode = bevelNormal(c.gradDir, c.fillet, 1.6, 1);
  n.metalnessNode = float(0.0);
  n.roughnessNode = float(0.18).add(frost.mul(0.1));
  n.clearcoatNode = float(0.6);
  m.envMapIntensity = 1.1;

  const vT = uv().y.oneMinus();
  const keyline = brassGradient(vT).mul(c.keyline).mul(accent.mul(1.5).add(0.65));
  const magnet = brassGradient(0.15).mul(c.magneticGlow);
  // Guaranteed Fresnel-read rim: the env may be dim, so the bevel always
  // carries a faint edge light (ice → brass with accent).
  const rim = mix(c3(ICE), brassGradient(0.3), accent.mul(0.6)).mul(c.fillet).mul(0.085);
  n.emissiveNode = keyline.add(magnet).add(rim).add(c3(ICE).mul(c.sheen).mul(0.1));

  n.opacityNode = c.coverage;
  m.transparent = true;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  return m;
}
