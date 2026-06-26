'use client';

// Build a real MeshPhysicalMaterial from a MaterialDef (+ optional per-instance
// param overrides). Analytic materials (gems, glass, most exotics) need NO
// textures — pure PBR params. Textured materials (worn-alloy seeds + every
// prompt-to-texture result) layer a matched, delit PBR map set on top. One shared
// StudioEnv IBL drives all reflection/refraction so the whole library is coherent.

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useMaterialStore } from './use-material-store';
import type { WornMaps } from '@/components/editor/chassis/materials';
import type {
  MaterialDef,
  MaterialMapsRef,
  MaterialParams,
  ParamFaderDef,
  MaterialFamily,
} from './material-types';
import { TEXTURED_MAP_SETS, MAP_SET_KEY } from './material-registry';

const TEXTURE_DIR = '/prism-mock/editor/textures/chassis-worn';

// Resolve the 5 PBR map URLs for a maps ref (worn keys vs generated dir layout).
export function mapUrlsFor(ref: MaterialMapsRef): {
  albedo: string;
  normal: string;
  rough: string;
  metal: string;
  ao: string;
} {
  if (ref.source === 'worn') {
    const k = ref.wornKey ?? 'gunmetal';
    return {
      albedo: `${TEXTURE_DIR}/${k}-albedo.png`,
      normal: `${TEXTURE_DIR}/${k}-normal.png`,
      rough: `${TEXTURE_DIR}/${k}-rough.png`,
      metal: `${TEXTURE_DIR}/${k}-metal.png`,
      ao: `${TEXTURE_DIR}/${k}-ao.png`,
    };
  }
  const d = ref.dir ?? '';
  return {
    albedo: `${d}/albedo.png`,
    normal: `${d}/normal.png`,
    rough: `${d}/rough.png`,
    metal: `${d}/metal.png`,
    ao: `${d}/ao.png`,
  };
}

// Load EVERY textured map set the registry references (the 5 worn seeds + the
// pre-generated prompt-to-texture sets), once, with correct colour spaces. Keyed
// by MAP_SET_KEY(ref) so a built material can grab its set in O(1). Must be called
// inside the Canvas tree (suspends until the textures stream in).
export function useMaterialMapSets(): Record<string, WornMaps> {
  const refs = TEXTURED_MAP_SETS;
  const urls: string[] = [];
  for (const ref of refs) {
    const u = mapUrlsFor(ref);
    urls.push(u.albedo, u.normal, u.rough, u.metal, u.ao);
  }
  const textures = useTexture(urls) as THREE.Texture[];
  // re-merge when a live generation lands a new runtime set (store rev bumps).
  const rev = useMaterialStore((s) => s.rev);
  return useMemo(() => {
    const out: Record<string, WornMaps> = {};
    refs.forEach((ref, i) => {
      const base = i * 5;
      const map = textures[base];
      const normalMap = textures[base + 1];
      const roughnessMap = textures[base + 2];
      const metalnessMap = textures[base + 3];
      const aoMap = textures[base + 4];
      map.colorSpace = THREE.SRGBColorSpace;
      for (const t of [normalMap, roughnessMap, metalnessMap, aoMap]) {
        t.colorSpace = THREE.NoColorSpace;
      }
      const [rx, ry] = ref.repeat ?? [1, 1];
      for (const t of [map, normalMap, roughnessMap, metalnessMap, aoMap]) {
        t.anisotropy = 8;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.needsUpdate = true;
      }
      out[MAP_SET_KEY(ref)] = { map, normalMap, roughnessMap, metalnessMap, aoMap };
    });
    // merge any live-generated sets loaded imperatively after boot.
    return { ...out, ...RUNTIME_MAP_CACHE };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textures, rev]);
}

// ── runtime-loaded generated map sets (live prompt-to-texture) ──────────────────
// Pre-generated seeds load via the Suspense hook; LIVE generations (W-PROMPT) load
// imperatively here and merge into the record the hook returns. Keyed by MAP_SET_KEY.
const RUNTIME_MAP_CACHE: Record<string, WornMaps> = {};
const _texLoader = new THREE.TextureLoader();

function loadTex(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => _texLoader.load(url, resolve, undefined, reject));
}

// Load a generated PBR set imperatively into the runtime cache (correct colour
// spaces + tiling). Returns once all 5 maps are ready. Idempotent per key.
export async function loadGeneratedMapSet(ref: MaterialMapsRef): Promise<string> {
  const key = MAP_SET_KEY(ref);
  if (RUNTIME_MAP_CACHE[key]) return key;
  const u = mapUrlsFor(ref);
  const [map, normalMap, roughnessMap, metalnessMap, aoMap] = await Promise.all([
    loadTex(u.albedo), loadTex(u.normal), loadTex(u.rough), loadTex(u.metal), loadTex(u.ao),
  ]);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [normalMap, roughnessMap, metalnessMap, aoMap]) t.colorSpace = THREE.NoColorSpace;
  const [rx, ry] = ref.repeat ?? [1, 1];
  for (const t of [map, normalMap, roughnessMap, metalnessMap, aoMap]) {
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
  }
  RUNTIME_MAP_CACHE[key] = { map, normalMap, roughnessMap, metalnessMap, aoMap };
  return key;
}

export function runtimeMapCache(): Record<string, WornMaps> {
  return RUNTIME_MAP_CACHE;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Merge a def's params with any per-instance overrides.
export function resolveParams(def: MaterialDef, overrides?: Partial<MaterialParams>): MaterialParams {
  return { ...def.params, ...(overrides ?? {}) };
}

// Build a fresh MeshPhysicalMaterial. The caller owns disposal (useMemo +
// cleanup). `mapSets` is the record from useMaterialMapSets(); analytic materials
// ignore it.
export function buildMaterialFromDef(
  def: MaterialDef,
  mapSets: Record<string, WornMaps>,
  overrides?: Partial<MaterialParams>,
): THREE.MeshPhysicalMaterial {
  const p = resolveParams(def, overrides);
  const m = new THREE.MeshPhysicalMaterial();

  // ── core PBR ──
  m.color = new THREE.Color(p.baseColor);
  m.metalness = clamp01(p.metalness);
  m.roughness = clamp01(p.roughness);

  // ── transmission / refraction ──
  if ((p.transmission ?? 0) > 0) {
    m.transmission = clamp01(p.transmission!);
    m.ior = p.ior ?? 1.5;
    m.thickness = p.thickness ?? 0.6;
    m.transparent = true;
    if (p.dispersion) m.dispersion = p.dispersion;
    if (p.attenuationColor) m.attenuationColor = new THREE.Color(p.attenuationColor);
    if (p.attenuationDistance != null) m.attenuationDistance = p.attenuationDistance;
  } else if (p.ior != null) {
    m.ior = p.ior;
  }

  // ── clearcoat ──
  if (p.clearcoat != null) m.clearcoat = clamp01(p.clearcoat);
  if (p.clearcoatRoughness != null) m.clearcoatRoughness = clamp01(p.clearcoatRoughness);

  // ── sheen (fabric / velvet) ──
  if (p.sheen != null) m.sheen = clamp01(p.sheen);
  if (p.sheenRoughness != null) m.sheenRoughness = clamp01(p.sheenRoughness);
  if (p.sheenColor) m.sheenColor = new THREE.Color(p.sheenColor);

  // ── anisotropy (brushed metal) ──
  if (p.anisotropy != null) m.anisotropy = clamp01(p.anisotropy);
  if (p.anisotropyRotation != null) m.anisotropyRotation = p.anisotropyRotation;

  // ── iridescence (thin film) ──
  if (p.iridescence != null) m.iridescence = clamp01(p.iridescence);
  if (p.iridescenceIOR != null) m.iridescenceIOR = p.iridescenceIOR;
  if (p.iridescenceThicknessRange) m.iridescenceThicknessRange = [...p.iridescenceThicknessRange];

  // ── specular / env / emissive ──
  if (p.specularIntensity != null) m.specularIntensity = p.specularIntensity;
  m.envMapIntensity = p.envMapIntensity ?? 1;
  if (p.emissive) m.emissive = new THREE.Color(p.emissive);
  if (p.emissiveIntensity != null) m.emissiveIntensity = p.emissiveIntensity;

  // ── baked maps (worn-alloy seeds + prompt-to-texture) ──
  if (def.maps) {
    const set = mapSets[MAP_SET_KEY(def.maps)];
    if (set) {
      // the matched albedo carries the colour; keep `color` white so it is not
      // double-tinted (worn metals bake the jewel-tone into the albedo).
      m.map = set.map;
      m.color = new THREE.Color('#ffffff');
      m.normalMap = set.normalMap;
      m.normalScale = new THREE.Vector2(p.normalScale ?? 1, p.normalScale ?? 1);
      m.roughnessMap = set.roughnessMap;
      m.roughness = 1; // map drives the range
      m.metalnessMap = set.metalnessMap;
      if (p.metalness > 0.5) m.metalness = 1; // map drives the alloy range
      m.aoMap = set.aoMap;
      m.aoMapIntensity = 1;
    }
  }

  // ── wear: roughen + thin the coat (patina / use) ──
  if (p.wear) {
    const w = clamp01(p.wear);
    m.roughness = clamp01(m.roughness + 0.35 * w * (def.maps ? 0 : 1));
    m.clearcoat = clamp01(m.clearcoat * (1 - 0.6 * w));
    if (def.maps) m.normalScale = new THREE.Vector2((p.normalScale ?? 1) * (1 + 0.5 * w), (p.normalScale ?? 1) * (1 + 0.5 * w));
  }

  m.needsUpdate = true;
  return m;
}

// ── per-family Inspector fader sets (only the params that matter) ────────────────
const COMMON_TAIL: ParamFaderDef[] = [
  { key: 'envMapIntensity', label: 'REFLECT', min: 0, max: 2 },
  { key: 'wear', label: 'WEAR', min: 0, max: 1 },
];

export function paramFadersFor(family: MaterialFamily): ParamFaderDef[] {
  switch (family) {
    case 'Metals':
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0, max: 1 },
        { key: 'metalness', label: 'METALNESS', min: 0, max: 1 },
        { key: 'clearcoat', label: 'CLEARCOAT', min: 0, max: 1 },
        { key: 'anisotropy', label: 'ANISO', min: 0, max: 1 },
        ...COMMON_TAIL,
      ];
    case 'Glass':
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0, max: 0.6 },
        { key: 'transmission', label: 'TRANSMIT', min: 0, max: 1 },
        { key: 'ior', label: 'IOR', min: 1, max: 2.4 },
        { key: 'thickness', label: 'THICKNESS', min: 0.05, max: 2 },
        { key: 'clearcoat', label: 'CLEARCOAT', min: 0, max: 1 },
        { key: 'envMapIntensity', label: 'REFLECT', min: 0, max: 2 },
      ];
    case 'Gems':
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0, max: 0.4 },
        { key: 'transmission', label: 'TRANSMIT', min: 0, max: 1 },
        { key: 'ior', label: 'IOR', min: 1.3, max: 2.42 },
        { key: 'dispersion', label: 'FIRE', min: 0, max: 6 },
        { key: 'thickness', label: 'THICKNESS', min: 0.1, max: 2 },
        { key: 'envMapIntensity', label: 'REFLECT', min: 0, max: 2 },
      ];
    case 'Fabrics':
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0.4, max: 1 },
        { key: 'sheen', label: 'SHEEN', min: 0, max: 1 },
        { key: 'sheenRoughness', label: 'SHEEN RGH', min: 0, max: 1 },
        ...COMMON_TAIL,
      ];
    case 'Exotic':
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0, max: 1 },
        { key: 'metalness', label: 'METALNESS', min: 0, max: 1 },
        { key: 'iridescence', label: 'IRIDESCE', min: 0, max: 1 },
        { key: 'iridescenceIOR', label: 'FILM IOR', min: 1, max: 2.4 },
        { key: 'clearcoat', label: 'CLEARCOAT', min: 0, max: 1 },
        { key: 'envMapIntensity', label: 'REFLECT', min: 0, max: 2 },
      ];
    case 'Stones':
    case 'Woods':
    case 'Ceramics':
    case 'Generated':
    default:
      return [
        { key: 'roughness', label: 'ROUGHNESS', min: 0, max: 1 },
        { key: 'metalness', label: 'METALNESS', min: 0, max: 1 },
        { key: 'clearcoat', label: 'CLEARCOAT', min: 0, max: 1 },
        { key: 'normalScale', label: 'RELIEF', min: 0, max: 2.5 },
        ...COMMON_TAIL,
      ];
  }
}
