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
  viewportMipTexture, viewportSafeUV, screenUV, mx_noise_float, texture, pmremTexture,
} = tsl;

export interface ChromeUniforms {
  /** Pointer position, CSS px viewport coords (y down). */
  pointer: TSLUniform<THREE.Vector2>;
  /** 0..1 pointer presence (fades when the pointer leaves the window). */
  pointerActive: TSLUniform<number>;
}

export interface ChromeInstanceBuffers {
  /** vec4 slab rect (centerX, centerY, width, height) CSS px viewport coords, y down.
   *  Packed to respect the WebGPU 8-vertex-buffer limit. */
  aRect: THREE.InstancedBufferAttribute;
  /** vec4 corner radii px (tl, tr, br, bl). */
  aRadii: THREE.InstancedBufferAttribute;
  /** vec4 (borderPx, accent, hover, press) — hover/press pre-damped CPU-side. */
  aState: THREE.InstancedBufferAttribute;
  /** vec4 (frost, brushAxis 0|1, styleId, reserved). */
  aMisc: THREE.InstancedBufferAttribute;
  /** vec4 ancestor-overflow clip window, viewport CSS px (minX, minY, maxX, maxY). */
  aClip: THREE.InstancedBufferAttribute;
}

// PRISM PORT F1 (chrome-material replacement 2026-06-19): the slab recipe is
// REPLACED with the GATE-PASSED slice material language (redesign-slice/index.html
// + SLICE-REPORT.md). The plumbing (SDF / bevel / clip / instancing) is byte-
// stable; only the recipe changed. LOCKED IDENTITY (tokens.ts / OpenDesign
// prism DESIGN.md): polished chrome #dfe2e6 (metalness 1, roughness ~0.035, NO
// clearcoat — clearcoat-over-metal reads as plastic, a documented HARD FAIL),
// brushed titanium #b8bcc0, mercury #e0e4ea, anodized #2d5fa3 (dielectric oxide
// over metal: metalness 0.9, thin clearcoat, iridescence — TINT only), arc-cyan
// #1ec8ff as the SINGLE emission, only on active. ZERO brass/gold/amber.
const METAL = new THREE.Color(DS.metal400);   // titanium
const METAL_HI = new THREE.Color(DS.metal100); // mercury highlight / specular hot point
// Arc-cyan is the SINGLE emissive accent (active states, selection, focus). Never
// a paint fill on inactive elements — it only ever rides `accent`/state terms.
const ARC = new THREE.Color(DS.arc);       // #1ec8ff
const ARC_HOT = new THREE.Color(DS.arcHot); // #96e0ff hot core
const ANODIZED = new THREE.Color(DS.anodized); // #2d5fa3 — surface TINT only
// SLAB BODY RAMPS — machined-metal albedo under the studio env. Metals carry a
// near-mirror chrome→titanium→graphite ramp (lit by the env, not painted);
// these are the diffuse floors that keep a slab reading as LIT metal even where
// the dim hub env contributes little.
// Polished chrome face (mercury highlight cap → chrome → titanium → graphite flank).
const METAL_TOP = new THREE.Color('#cfd4da'); // bright machined chrome cap
const METAL_BOT = new THREE.Color('#2b3038'); // graphite shadowed flank
// Anodized inlay (ceramic style) — dielectric oxide over metal, anodized-blue TINT.
const CERAMIC_TOP = new THREE.Color('#33486a'); // lit anodized oxide
const CERAMIC_BOT = new THREE.Color('#16202f'); // shaded anodized base
// Recessed dark-anodized pocket (well style).
const WELL_TOP = new THREE.Color('#0c1118');
const WELL_BOT = new THREE.Color('#141a24');
// Lit smoked-glass body floor (top key-lit → bottom shade) — the guaranteed
// presence a glass panel keeps even when the scene behind it is pure black.
const GLASS_BODY_TOP = new THREE.Color('#272f3e');
const GLASS_BODY_BOT = new THREE.Color('#11151d');

const c3 = (c: THREE.Color) => vec3(c.r, c.g, c.b);

export function createChromeUniforms(): ChromeUniforms {
  return {
    pointer: uniform(new THREE.Vector2(-4096, -4096)),
    pointerActive: uniform(0),
  };
}

export interface ChromeTextures {
  brushedNormal: THREE.Texture;
  brushedRough: THREE.Texture;
  ceramicNormal: THREE.Texture;
  ceramicRough: THREE.Texture;
  /** COOL-NEUTRAL studio equirect — the chrome's OWN reflection environment.
   *  F2b (2026-06-19): the original fal asset carried a WARM observatory ambient
   *  (shadow/mid bands R-B +5..+6, ~10% distinctly-amber pixels) which the
   *  near-mirror metal reflected as an amber/brown highlight running the rail's
   *  vertical spine at grazing angles (Fresnel peak). The asset is now
   *  desaturated toward neutral + slightly cool-shifted at source (mid band
   *  R-B −3.4, warm pixels 2.75%) so the rail reads as cool machined metal with
   *  ZERO amber/copper. Cool softbox strips on near-black are preserved so the
   *  chrome still resolves crisp specular streaks. Hub light rigs vary wildly;
   *  chrome must read as the same machined instrument in every hub. */
  env: THREE.Texture;
  /** 0 until all maps decoded — the graph blends them in over the procedural
   *  noise so slabs never flash a broken black-normal state. */
  ready: TSLUniform<number>;
}

/**
 * fal.ai-generated micro-material maps (FIDELITY-2 ADDENDUM 3: generated
 * assets FEED the TSL materials — they never replace real rendering).
 * Tileable Patina maps baked to public/prism-assets/chrome/.
 */
export function createChromeTextures(): ChromeTextures {
  const ready = uniform(0);
  const loader = new THREE.TextureLoader();
  let pending = 4;
  const load = (url: string) =>
    loader.load(url, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.NoColorSpace; // data maps, not color
      t.needsUpdate = true;
      if (--pending === 0) ready.value = 1;
    });
  const env = new THREE.TextureLoader().load(
    '/prism-assets/chrome/observatory-env.png',
    (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    },
  );
  return {
    brushedNormal: load('/prism-assets/chrome/brushed-metal.normal.png'),
    brushedRough: load('/prism-assets/chrome/brushed-metal.roughness.png'),
    ceramicNormal: load('/prism-assets/chrome/ceramic-grain.normal.png'),
    ceramicRough: load('/prism-assets/chrome/ceramic-grain.roughness.png'),
    env,
    ready,
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
  const rectA = instancedBufferAttribute(bufs.aRect);
  const center = rectA.xy;
  const size = vec2(rectA.z, rectA.w);
  const radii = instancedBufferAttribute(bufs.aRadii);
  const state = instancedBufferAttribute(bufs.aState);
  const misc = instancedBufferAttribute(bufs.aMisc);

  // PlaneGeometry uv: (0,0) bottom-left → local px, y down:
  const p = vec2(uv().x.sub(0.5).mul(size.x), float(0.5).sub(uv().y).mul(size.y));

  // Per-quadrant corner radius (tl, tr, br, bl) in y-down space, clamped to
  // the half-extent so pill radii (--ds-r-pill: 999px) stay valid SDFs.
  const half = vec2(size.x.mul(0.5), size.y.mul(0.5));
  const rMax = min(half.x, half.y);
  const rTop = mix(radii.x, radii.y, step(0.0, p.x)); // p.y < 0 (top edge)
  const rBot = mix(radii.w, radii.z, step(0.0, p.x)); // p.y > 0 (bottom edge)
  const r = min(mix(rTop, rBot, step(0.0, p.y)), rMax);

  // Rounded-box SDF (IQ), px units. Negative inside.
  const q = abs(p).sub(half).add(r);
  const dBox = min(max(q.x, q.y), 0.0).add(length(max(q, vec2(0.0, 0.0)))).sub(r);

  // Ancestor-overflow clip: intersect with the scroll container's window so
  // slabs inside scrollable flyouts crop exactly like their DOM twins.
  const clip = instancedBufferAttribute(bufs.aClip);
  const vp = vec2(center.x.add(p.x), center.y.add(p.y)); // fragment in viewport CSS px
  const clipC = vec2(clip.x.add(clip.z).mul(0.5), clip.y.add(clip.w).mul(0.5));
  const clipH = vec2(clip.z.sub(clip.x).mul(0.5), clip.w.sub(clip.y).mul(0.5));
  const cq = abs(vp.sub(clipC)).sub(clipH);
  const dClip = max(cq.x, cq.y);
  const d = max(dBox, dClip);

  // Coverage with screen-space-derivative AA (never a fixed epsilon).
  // Uses the clip-intersected field so scroll-cropping cuts cleanly…
  const coverage = clamp(float(0.5).sub(d.div(fwidth(d).max(1e-4))), 0.0, 1.0);

  // …while bevel/keyline geometry derives from the BOX field only (a scroll
  // clip is a cut, not an edge — it must not grow a bevel or keyline).
  const gradDir = normalize(vec2(dFdx(dBox), dFdy(dBox)).add(vec2(1e-5, 0.0)));

  // Bevel profile: 0 on the flat face → 1 at the rim, circular fillet.
  const borderPx = state.x;
  // EDITOR-EXP P2 (C12 hero) — a hero key (misc.w > 0) grows a chamfered side so
  // the SDF bevel reads as the extruded WALL of a raised metal button, not a 1px
  // rim. The chamfer is SIZE-RELATIVE (a fraction of the short side) so a flat
  // metal top cap always survives — a fixed-px chamfer on a small pill would
  // consume the whole face and roll the normal everywhere (no lit cap). misc.w
  // is 0 for every non-hero slab → bevel unchanged there.
  const heroAmt = misc.w;
  const heroBevel = min(size.x, size.y).mul(0.2).mul(heroAmt);
  const bevelPx = borderPx.mul(2.0).add(4.0).add(heroBevel);
  const bevelT = smoothstep(bevelPx.negate(), 0.0, dBox);
  const fillet = bevelT.mul(bevelT).mul(float(3.0).sub(bevelT.mul(2.0)));

  // Border keyline band (the .ds-edge 1px masked border, now lit geometry).
  const keyline = float(1.0).sub(smoothstep(0.0, borderPx.max(1.0), abs(dBox.add(borderPx))));

  // Pointer, slab-local (CSS px, y down) — magnetic glow rides the SDF band.
  const pointerLocal = vec2(u.pointer.x, u.pointer.y).sub(center);
  const pointerDist = length(p.sub(pointerLocal));
  const magnet = exp(pointerDist.mul(pointerDist).div(-14400.0)).mul(u.pointerActive); // σ≈120px
  const borderBand = float(1.0).sub(smoothstep(0.0, bevelPx, abs(dBox)));
  const magneticGlow = magnet.mul(borderBand);

  // Soft face sheen toward the pointer (the real speculars come from the
  // PointLight; this keeps faces away from the light from going dead).
  const sheen = exp(pointerDist.mul(pointerDist).div(-90000.0)).mul(0.2).mul(u.pointerActive);

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

// Polished-chrome edge ramp: mercury hot-point → titanium. Used for lit keylines
// and machined edge bevels (the metal speculars themselves come from the env).
const metalGradient = (t: TSLNode | number) => mix(c3(METAL_HI), c3(METAL), t);
// Arc-cyan emissive ramp: hot core → arc. The ONLY emissive color for active
// states (selection, focus, active mode-toggle / hub-pill grooves).
const arcGradient = (t: TSLNode | number) => mix(c3(ARC_HOT), c3(ARC), t);


/** Opaque family: metal (1) / ceramic (2) / well (3) selected per instance. */
export function createOpaqueSlabMaterial(
  bufs: ChromeInstanceBuffers,
  u: ChromeUniforms,
  tex?: ChromeTextures,
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
  // EDITOR-EXP P2 (C12) — raised hero-key amount (0 = flat slab; >0 = extruded
  // metal key). Read from the reserved aMisc.w; drives the steep wall normal,
  // the top-lit/bottom-shaded body, and the brighter lit chamfer below.
  const hero = c.misc.w;

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
  // Accent = a REAL metal plate face (not a wash): primary keys keep their
  // dark-ink labels legible because the face under them is actually bright
  // metal, exactly like the CSS --ds-grad-metal they replace (advocate
  // MUST-FIX: unreadable primary confirm key).
  const accented = mix(
    baseColor,
    metalGradient(vT).mul(0.82),
    accent.mul(0.8).add(hover.mul(0.08)),
  ) as TSLNode;
  // EDITOR-EXP P2 (C12) — vertical extrusion shade: a hero key's top cap lifts
  // and its base sinks into shadow so it reads as a raised 3D metal form.
  // Identity (×1) for every non-hero slab (hero === 0).
  const heroShade = mix(float(1.0), mix(float(0.74), float(1.18), vT.oneMinus()), hero) as TSLNode;
  n.colorNode = vec4(accented.mul(press.mul(-0.18).add(1.0)).mul(heroShade), 1.0);

  // Wells sink inward (inverted bevel); plates rise. Brushing/grain on top.
  const plateNormal = bevelNormal(c.gradDir, c.fillet, 1.35, 1);
  // EDITOR-EXP P2 (C12) — a steeper extruded-wall normal for hero keys, mixed in
  // by `hero` so non-hero plates keep the gentle 1.35 rim. Kept moderate (2.1)
  // so the chamfer catches light without rolling so hard it mirrors the dark
  // scene and darkens the metal cap.
  const heroNormal = bevelNormal(c.gradDir, c.fillet, 2.1, 1);
  const raisedNormal = mix(plateNormal, heroNormal, hero) as TSLNode;
  const wellNormal = bevelNormal(c.gradDir, c.fillet, 1.1, -1);
  let microXY = vec2(
    brush.mul(0.1).mul(isMetal),
    brush.mul(0.04).mul(isMetal).add(grain.mul(0.03).mul(isCeramic)),
  );
  let roughDetail = float(0.0);
  if (tex) {
    // fal-generated Patina micro-maps (tileable) blend in over the procedural
    // terms once decoded (tex.ready) — brushed striations follow brushAxis by
    // swapping the tile lookup axes.
    const tileUV = vec2(c.p.x.div(384.0), c.p.y.div(384.0));
    const brushedUV = mix(tileUV, vec2(tileUV.y, tileUV.x), brushAxis);
    const bN = texture(tex.brushedNormal, brushedUV).xy.mul(2.0).sub(vec2(1.0, 1.0));
    const cN = texture(tex.ceramicNormal, tileUV).xy.mul(2.0).sub(vec2(1.0, 1.0));
    const texXY = bN.mul(0.55).mul(isMetal).add(cN.mul(0.3).mul(isCeramic));
    microXY = mix(microXY, texXY, tex.ready) as TSLNode;
    const bR = texture(tex.brushedRough, brushedUV).r.sub(0.5);
    const cR = texture(tex.ceramicRough, tileUV).r.sub(0.5);
    roughDetail = bR.mul(0.16).mul(isMetal).add(cR.mul(0.1).mul(isCeramic)).mul(tex.ready) as TSLNode;
  }
  const baseNormal = mix(raisedNormal, wellNormal, isWell);
  n.normalNode = normalize(vec3(baseNormal.x.add(microXY.x), baseNormal.y.add(microXY.y), baseNormal.z));

  // SLICE RECIPE — material physics per family:
  //   metal  = POLISHED CHROME / brushed titanium: pure metal mirror (metalness
  //            1.0), very low roughness (~0.05) so the studio env resolves as
  //            crisp specular streaks (the chrome read). The brush term lifts
  //            roughness slightly along the brush axis → the satin titanium
  //            anisotropic streak. NO CLEARCOAT (clearcoat-over-metal = the
  //            documented plastic HARD FAIL → the isMetal clearcoat term is GONE).
  //   ceramic = ANODIZED aluminium: dielectric oxide over metal (metalness 0.9),
  //            a thin clearcoat for the oxide gloss + iridescence thin-film sheen
  //            (set below) — this is exactly what separates real anodized metal
  //            from painted plastic.
  //   well   = recessed dark-anodized pocket: dielectric, matte.
  n.metalnessNode = isMetal.mul(1.0).add(isCeramic.mul(0.9)).add(isWell.mul(0.2));
  n.roughnessNode = isMetal
    .mul(float(0.05).add(brush.mul(0.14).abs()).sub(hover.mul(0.012)))
    .add(isCeramic.mul(float(0.18).add(grain.mul(0.05))))
    .add(isWell.mul(0.62))
    .add(roughDetail);
  // Clearcoat lives ONLY on the dielectric families (anodized oxide gloss / well).
  // Zero on metal — clearcoat over metal reads as coated plastic (HARD FAIL).
  n.clearcoatNode = isCeramic.mul(0.28).add(isWell.mul(0.16));
  n.clearcoatRoughnessNode = isCeramic.mul(0.12).add(isWell.mul(0.42)).add(0.02);
  // Anodized thin-film iridescence — the oxide-over-aluminium sheen. Gated to
  // ceramic so chrome/titanium stay pure mirror; setting the node enables the
  // iridescence lighting path (useIridescence). ior bumped on metal toward the
  // chrome-mirror read (slice chrome ior 2.9), dielectric elsewhere.
  n.iridescenceNode = isCeramic.mul(0.32);
  n.iridescenceIORNode = float(1.32);
  // thickness range [120,420]nm mapped across the vertical gradient → a shifting
  // oxide sheen rather than a flat tint.
  n.iridescenceThicknessNode = mix(float(140.0), float(400.0), vT);
  n.iorNode = isMetal.mul(1.5).add(1.4); // chrome-leaning ior on metal, dielectric base

  // Emissive: machined-metal keyline + magnetic pointer glow + pointer sheen + a
  // static top-edge glint so pointer-less frames still read dimensional.
  // ARC-CYAN ACTIVE EMISSION (F1): the keyline edge is the .ds-edge bezel light.
  // At rest it is a neutral machined-metal edge; as `accent` rises (the active
  // mode-toggle segment, selected hub pill, focus ring) the edge GROOVE shifts to
  // an arc-cyan emissive rim — emission ONLY on active, never a paint fill on an
  // inactive slab (accent === 0 → pure metal edge, zero cyan).
  const edgeColor = mix(metalGradient(vT), arcGradient(vT), accent);
  const keylineColor = edgeColor.mul(c.keyline).mul(accent.mul(1.6).add(0.55));
  // Active arc-cyan groove: a tight inner-rim emissive band that lights only on
  // active slabs (the selection / focus signature). toneMapped-bright via the
  // hot core so the restrained bloom picks it up as a real arc of light.
  const arcGroove = c3(ARC).mul(c.keyline).mul(accent.mul(0.9));
  const magnetGlow = metalGradient(0.2).mul(c.magneticGlow).mul(0.5);
  // Pointer sheen stays a cool neutral metal catch (NOT cyan — cyan is reserved
  // for active state only); arc-cyan only enters via `accent`.
  const sheenGlow = c3(METAL_HI).mul(c.sheen).mul(0.14);
  const topGlint = vec3(0.92, 0.94, 0.98).mul(smoothstep(0.1, 0.0, vT).mul(0.045)).mul(isMetal);
  // VOID FIX (Logan): a broad baked key-light sheen graced across the upper
  // face of every opaque panel so the tool rail + inspector bodies read as LIT
  // machined graphite at rest, regardless of how dim the hub env is — not the
  // near-black slabs that disappeared into the scene.
  const keySheen = vec3(0.84, 0.87, 0.92)
    .mul(smoothstep(0.72, 0.0, vT))
    .mul(float(0.06).mul(isMetal.add(isCeramic)));
  // Accent faces are SELF-LIT like the CSS --ds-grad-metal they replace: an
  // albedo-only metal plate goes near-black under a dim scene env, which made
  // primary-key ink labels unreadable (advocate MUST-FIX). The emissive term
  // guarantees instrument-key luminance under any hub lighting. An active key
  // carries a faint arc-cyan wash over the lit chrome face (emission only when
  // active), so the active mode-toggle / hub pill reads as energised metal.
  const accentFace = mix(metalGradient(vT), arcGradient(vT), accent.mul(0.34))
    .mul(accent.mul(0.46).add(accent.mul(hover).mul(0.08)));
  // EDITOR-EXP P2 (C12) — hero key luminance. A 0.92-metal metal face reflects
  // the (dark) scene env and reads near-black, so a hero gets a FORM-FOLLOWING
  // self-lit metal body: bright at the top cap, dim at the shaded base, so it
  // reads as a RAISED, lit 3D metal key — while the metallic chamfer still
  // catches the moving pointer-light specular. Plus a brighter lit edge on the
  // thick chamfer. All gated by `hero` (0 for every non-hero slab).
  const heroFaceLum = smoothstep(float(1.0), float(-0.1), vT).mul(0.55).add(0.32); // 0.87 cap → 0.32 base
  const heroFace = metalGradient(vT).mul(heroFaceLum).mul(hero);
  const heroEdge = metalGradient(vT).mul(c.keyline).mul(hero.mul(1.9));
  n.emissiveNode = mix(
    keylineColor.add(arcGroove).add(magnetGlow).add(sheenGlow).add(topGlint).add(keySheen).add(accentFace).add(heroFace).add(heroEdge),
    vec3(0.0, 0.0, 0.0),
    isWell.mul(0.78),
  );

  n.opacityNode = c.coverage;
  if (tex) n.envNode = pmremTexture(tex.env);
  m.transparent = true;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  // Polished chrome wants a strong env contribution so the controlled studio
  // reflection resolves as crisp specular streaks (the slice ran chrome at
  // 1.3–1.9). The pmrem(observatory-env) is the controlled chrome reflection
  // env regardless of how dim the active hub is.
  m.envMapIntensity = 1.45;
  return m;
}

/** Glass family: smoked refractive glass — refracts the LIVE scene. */
export function createGlassSlabMaterial(
  bufs: ChromeInstanceBuffers,
  u: ChromeUniforms,
  tex?: ChromeTextures,
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

  // Wider chromatic split at the rim → a stronger, more obviously-refractive
  // lens read (the prior 0.12 split was barely perceptible).
  const frostMip = frost.mul(3.2).add(hover.mul(0.8)).add(c.fillet.mul(1.4));
  const uvR = viewportSafeUV(screenUV.add(shiftUV.mul(1.2)));
  const uvG = viewportSafeUV(screenUV.add(shiftUV));
  const uvB = viewportSafeUV(screenUV.add(shiftUV.mul(0.82)));
  const refracted = vec3(
    viewportMipTexture(uvR).level(frostMip).r,
    viewportMipTexture(uvG).level(frostMip).g,
    viewportMipTexture(uvB).level(frostMip).b,
  );

  // Beer–Lambert smoked tint, thicker at the rim (the bevel doubles as depth).
  // F1: COOL-NEUTRAL absorption (slice glass attenuationColor #dfeeff) — pass the
  // cool end, sink red slightly, so smoked glass reads as cool machined crystal,
  // never the warm bias that flirts with the condemned brass palette.
  const thicknessG = c.fillet.mul(2.2).add(1.0);
  const absorb = vec3(0.2, 0.15, 0.11); // cool smoked crystal: sink red, pass cyan-blue
  const tinted = refracted.mul(exp(absorb.mul(thicknessG).negate()));
  // VOID FIX (Logan): a guaranteed LIT smoked-glass floor (top key-light →
  // bottom shade) so the panel reads as a crafted instrument even when the scene
  // behind it is pure black. Scene refraction is layered ON TOP at reduced
  // weight so distortion still reads where the backdrop has content; the sum is
  // clamped so bright scene content can never wash the DOM labels sitting over
  // it (advocate MUST-FIX history: specular wash).
  const vTb = uv().y.oneMinus(); // 0 top → 1 bottom of slab
  const litFloor = mix(c3(GLASS_BODY_TOP), c3(GLASS_BODY_BOT), vTb);
  const glassBody = min(
    litFloor.add(tinted.mul(float(0.55).sub(frost.mul(0.12)))),
    vec3(0.4, 0.4, 0.42),
  ) as TSLNode;

  n.backdropNode = vec4(glassBody, 1.0);
  n.backdropAlphaNode = c.coverage;

  // Lit skin over the transmission: near-black diffuse, real speculars.
  // Glass is a DIELECTRIC, so clearcoat over its near-zero-metalness skin is
  // physically correct (NOT the metal HARD FAIL) — it gives the smoked crystal
  // its wet machined-glass gloss. metalness stays 0.
  n.colorNode = vec4(0.02, 0.022, 0.03, 1.0);
  n.normalNode = bevelNormal(c.gradDir, c.fillet, 1.6, 1);
  n.metalnessNode = float(0.0);
  // Lower roughness floor than the prior 0.32 → cleaner refractive crystal speculars,
  // but a floor (frost-scaled) still keeps on-panel pointer-light from blowing the
  // glass to white (W4 catch: cursor parked on a panel washed it out).
  n.roughnessNode = float(0.22).add(frost.mul(0.12));
  n.clearcoatNode = float(0.5);
  n.clearcoatRoughnessNode = float(0.06);
  n.iorNode = float(1.5); // crown-glass ior — the slice glass ran ior ~1.5
  m.envMapIntensity = 1.25;

  const vT = uv().y.oneMinus();
  // ARC-CYAN ACTIVE EMISSION (F1): the glass bezel edge is a neutral machined-
  // metal keyline at rest; on active (`accent`) it shifts to an arc-cyan groove —
  // the selection / focus signature on glass panels (search palette focus, armed
  // filter pills). Emission only on active.
  const glassEdge = mix(metalGradient(vT), arcGradient(vT), accent);
  const keyline = glassEdge.mul(c.keyline).mul(accent.mul(1.7).add(0.66));
  const arcGroove = c3(ARC).mul(c.keyline).mul(accent.mul(0.85));
  const magnet = metalGradient(0.15).mul(c.magneticGlow).mul(0.6);
  // Guaranteed Fresnel-read rim: the env may be dim, so the bevel always carries
  // an edge light (neutral metal at rest → arc-cyan with accent). Reads as a lit
  // machined bevel, not a flat dark band, over the black scene.
  const rim = mix(c3(METAL_HI), c3(ARC), accent.mul(0.7)).mul(c.fillet).mul(0.15);
  // Baked top key-glint: a soft specular catch on the top edge so a static
  // pointer-less panel still reads as a surface a light is grazing.
  const topKey = vec3(0.88, 0.91, 0.96).mul(smoothstep(0.16, 0.0, vT)).mul(0.06);
  n.emissiveNode = keyline.add(arcGroove).add(magnet).add(rim).add(topKey).add(c3(METAL_HI).mul(c.sheen).mul(0.1));

  n.opacityNode = c.coverage;
  if (tex) n.envNode = pmremTexture(tex.env);
  m.transparent = true;
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  // Cleaner crystal env reflection than the prior 0.7, still well under the
  // opaque chrome (1.45) so glass panels stay readable behind their DOM labels.
  m.envMapIntensity = 0.92;
  return m;
}
