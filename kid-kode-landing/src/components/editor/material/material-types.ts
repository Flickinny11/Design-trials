'use client';

// PRISM PRIMITIVE SYSTEM — PHASE P-2: the MATERIAL SYSTEM (spec §2).
//
// A structured, layered material library. Each material is a PARAMETRIC node-
// material descriptor (`MaterialDef`) — editable PBR params (baseColor/tint,
// roughness, metalness, clearcoat, transmission, IOR, thickness, sheen,
// anisotropy, iridescence, normal/wear) — that builds a real `MeshPhysicalMaterial`
// (three r184 node-material on WebGPU; the isolated chassis lab renders on the
// approved WebGL surface). Real PBR + transmission + clearcoat under ONE shared
// HDRI/IBL (StudioEnv) so EVERY material refracts/reflects correctly by
// construction — the founder-approved /toolbar-chassis + /keyframe-editor look.
//
// The library is a REUSABLE REGISTRY keyed by id (§2.5); primitive schemas
// reference a material by id + optional per-instance param overrides. The list is
// effectively infinite via prompt-to-texture (§2.4, W-PROMPT) — a generated set is
// saved as a `MaterialDef` with a `maps` reference and joins the registry.

// ── families (§2.1) ──────────────────────────────────────────────────────────
export type MaterialFamily =
  | 'Metals'
  | 'Stones'
  | 'Glass'
  | 'Gems'
  | 'Woods'
  | 'Ceramics'
  | 'Fabrics'
  | 'Exotic'
  | 'Generated';

// Canonical display order (drives the library palette rows).
export const FAMILIES: readonly MaterialFamily[] = Object.freeze([
  'Metals',
  'Stones',
  'Glass',
  'Gems',
  'Woods',
  'Ceramics',
  'Fabrics',
  'Exotic',
  'Generated',
] as const);

// ── the editable PBR surface (§2.2) ──────────────────────────────────────────
// Every field maps 1:1 to a MeshPhysicalMaterial property (forward-compatible
// with MeshPhysicalNodeMaterial on WebGPU). All optional except the core four.
export interface MaterialParams {
  /** albedo / base color (hex). For metals this is the specular F0 tint. */
  baseColor: string;
  /** 0 = dielectric, 1 = metal. */
  metalness: number;
  /** 0 = mirror, 1 = fully diffuse. */
  roughness: number;

  /** 0 = opaque, 1 = fully transmissive (glass). */
  transmission?: number;
  /** index of refraction (air 1.0 … diamond 2.42). */
  ior?: number;
  /** refraction slab thickness (transmission depth). */
  thickness?: number;
  /** chromatic dispersion (Abbe-style fire), 0 = none. */
  dispersion?: number;
  /** absorption colour for transmissive bodies (deep tint). */
  attenuationColor?: string;
  /** mean free path before `attenuationColor` saturates. */
  attenuationDistance?: number;

  /** clear lacquer / glaze coat strength. */
  clearcoat?: number;
  clearcoatRoughness?: number;

  /** retro-reflective fabric/velvet rim sheen. */
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;

  /** brushed-metal directional highlight (0..1). */
  anisotropy?: number;
  anisotropyRotation?: number;

  /** thin-film interference (soap-film / oil-slick / nacre). */
  iridescence?: number;
  iridescenceIOR?: number;
  /** film thickness sweep in nm — drives the hue band. */
  iridescenceThicknessRange?: [number, number];

  /** dielectric specular strength (matte vs. wet). */
  specularIntensity?: number;
  /** IBL reflection strength on this material. */
  envMapIntensity?: number;

  emissive?: string;
  emissiveIntensity?: number;

  /** tangent-space normal influence (texture relief). */
  normalScale?: number;
  /** semantic wear amount 0..1 — roughens + de-coats edges (patina). */
  wear?: number;
}

// A baked PBR map set reference (worn-alloy seeds or prompt-to-texture output).
// `worn` keys into the committed chassis-worn sets; `generated` points at a public
// dir holding albedo/normal/rough/metal/ao from ONE matched + delit latent (§2.4).
export interface MaterialMapsRef {
  source: 'worn' | 'generated';
  /** chassis-worn textureKey (emerald/sapphire/bronze/oxblood/gunmetal). */
  wornKey?: string;
  /** public dir (no trailing slash), e.g. /prism-mock/editor/textures/generated/copper. */
  dir?: string;
  /** repeat tiling for the maps (allover surfaces tile; object scans do not). */
  repeat?: [number, number];
}

// A curated or generated material — a registry entry (§2.5).
export interface MaterialDef {
  /** stable registry key, family-prefixed, e.g. 'metal.brass', 'gem.ruby'. */
  id: string;
  family: MaterialFamily;
  /** human label for the engraved swatch caption. */
  label: string;
  /** the editable PBR params. */
  params: MaterialParams;
  /** optional baked maps (textured families + generated). */
  maps?: MaterialMapsRef;
  /** swatch hint when the material reads dark/transmissive (engraving legibility). */
  swatchTint?: string;
}

// Which params actually matter for a family — drives the Inspector fader set so a
// gem shows IOR/dispersion and a fabric shows sheen, never a wall of dead knobs.
export interface ParamFaderDef {
  key: keyof MaterialParams;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
}
