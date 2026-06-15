'use client';

// PRISM NODE-EDITOR V2 — photoreal hub PLANET (criteria D1). Each galaxy hub
// renders as a lit, glowing PBR planet in one of FIVE premium HERO identities —
// brass-gas-giant / bone-rock / ice-crystal / deep-ocean / ember-forge —
// orbiting the <app>_world body. One renderer (three/webgpu); TSL-free standard
// materials (already used by HubHull); the scene Bloom enhances the emissive rim
// + atmosphere halo. Sized by the hub's content metric (D2). Each identity is
// strongly distinct in base/band/speck/halo + PBR so no two hubs read alike and
// none read like a dormant node sphere. No purple/magenta; Observatory-Brass
// palette only (deep-ocean stays in the cool ice/teal family; ember-forge keeps
// emissive in the brass/amber/ember warm range).

import { useMemo } from 'react';
import * as THREE from 'three';
import { DS } from '@/components/editor/design-system';
import { getBrandAsset } from '@/lib/capabilities/brand-assets';
import type { PrismNode } from '@/lib/prism-graph/types';

// Five distinct HERO planet identities. (Authorable later via hub.identity.)
export type HubPlanetIdentity =
  | 'brass-gas-giant'
  | 'bone-rock'
  | 'ice-crystal'
  | 'deep-ocean'
  | 'ember-forge';

// Back-compat alias — the prior 3-family name. New code should prefer
// HubPlanetIdentity; this keeps any external importers of PlanetFamily working.
export type PlanetFamily = HubPlanetIdentity;

// The five identities in canonical order, for hashing unknown ids.
const IDENTITIES: readonly HubPlanetIdentity[] = [
  'brass-gas-giant',
  'bone-rock',
  'ice-crystal',
  'deep-ocean',
  'ember-forge',
] as const;

// The five KNOWN mock-app hubs are pinned to five DISTINCT identities so the
// galaxy overview reads as five unmistakable worlds (POLISH PA). Unknown ids
// fall back to a stable FNV-1a hash spread across all five.
const KNOWN_HUB_IDENTITY: Record<string, HubPlanetIdentity> = {
  's1-arrival': 'ice-crystal',     // arrival — cool, glassy, inviting
  's2-movement': 'ember-forge',    // movement — kinetic, hot, high-energy
  's3-materia': 'bone-rock',       // materia — matte, mineral, tactile
  's4-celestia': 'brass-gas-giant',// celestia — banded brass giant, the centerpiece
  's5-acquire': 'deep-ocean',      // acquire — deep teal, gathering
};

// Deterministic identity from a hub id (stable across reloads). Known hubs map
// to fixed identities; everything else hashes across the five.
export function planetFamily(hubId: string): HubPlanetIdentity {
  const pinned = KNOWN_HUB_IDENTITY[hubId];
  if (pinned) return pinned;
  let h = 2166136261;
  for (let i = 0; i < hubId.length; i++) { h ^= hubId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return IDENTITIES[(h >>> 0) % IDENTITIES.length];
}

interface FamilySpec {
  base: string;
  band: string;
  speck: string;
  halo: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  ior: number;
  emissive: string;
  emissiveIntensity: number;
  envMapIntensity: number;
  bumpScale: number;       // crisper relief per identity (PC sharpness)
  emissiveMapStrength?: number; // 0..1 — ember cracks routed through emissive
}

const FAMILIES: Record<HubPlanetIdentity, FamilySpec> = {
  // Warm metallic banded gas giant — brass bands, bright specular, high metalness.
  'brass-gas-giant': {
    base: '#b98f4e', band: '#7e5c2a', speck: '#f7e9c6', halo: DS.brass200,
    metalness: 1.0, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.24,
    transmission: 0, ior: 1.5, emissive: '#3a2a12', emissiveIntensity: 0.24,
    envMapIntensity: 1.6, bumpScale: 0.5,
  },
  // Matte cratered bone/ivory rocky world — low metalness, high roughness, crisp craters.
  'bone-rock': {
    base: '#e3d8c0', band: '#b9a884', speck: '#f6efdd', halo: DS.textHi,
    metalness: 0.03, roughness: 0.72, clearcoat: 0.1, clearcoatRoughness: 0.6,
    transmission: 0, ior: 1.45, emissive: '#241f17', emissiveIntensity: 0.06,
    envMapIntensity: 0.8, bumpScale: 0.72,
  },
  // Glassy blue ice — clearcoat 1, slight transmission, sharp speculars.
  'ice-crystal': {
    base: '#bcd6e6', band: '#86adc4', speck: '#eef7fc', halo: DS.ice200,
    metalness: 0.0, roughness: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.05,
    transmission: 0.18, ior: 1.31, emissive: '#163040', emissiveIntensity: 0.18,
    envMapIntensity: 1.8, bumpScale: 0.22,
  },
  // Deep blue-teal ocean world — lighter swirling cloud bands, subtle clearcoat.
  // Stays in the cool ice/teal family — NO purple.
  'deep-ocean': {
    base: '#163f52', band: '#cfe2ea', speck: '#eaf6fb', halo: DS.ice300,
    metalness: 0.0, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.22,
    transmission: 0.0, ior: 1.34, emissive: '#0a2734', emissiveIntensity: 0.14,
    envMapIntensity: 1.35, bumpScale: 0.34,
  },
  // Dark basalt with glowing ember cracks — low-key base, high contrast,
  // emissive warm cracks routed through the speck/emissive channel. Brass/amber/
  // ember warm range only — NO purple/magenta.
  'ember-forge': {
    base: '#1c1712', band: '#2c211a', speck: '#ff8a3c', halo: DS.brass300,
    metalness: 0.18, roughness: 0.66, clearcoat: 0.0, clearcoatRoughness: 0.7,
    transmission: 0, ior: 1.46, emissive: '#ff7a2e', emissiveIntensity: 0.55,
    envMapIntensity: 0.6, bumpScale: 0.62, emissiveMapStrength: 1.0,
  },
};

// ── procedural planet surface texture (banded + speckled, per identity) ──────
// 2048×1024 with a high-frequency detail octave + crisp grain for a detailed
// PBR read (POLISH PC). For ember-forge a separate emissive crack map is baked
// so the cracks glow without lifting the base. Cached per identity.
interface SurfaceTextures {
  surface: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture | null;
}
const _surfaceCache: Partial<Record<HubPlanetIdentity, SurfaceTextures>> = {};

function buildSurface(fam: HubPlanetIdentity): SurfaceTextures | null {
  if (_surfaceCache[fam]) return _surfaceCache[fam]!;
  if (typeof document === 'undefined') return null;
  const spec = FAMILIES[fam];
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);

  const band = new THREE.Color(spec.band);
  const bandRGB = `${(band.r * 255) | 0},${(band.g * 255) | 0},${(band.b * 255) | 0}`;

  // latitudinal bands (sine-warped) for a gas/marble/ocean surface
  const bandCount = fam === 'bone-rock' ? 16 : 34;
  for (let i = 0; i < bandCount; i++) {
    const y = (i / bandCount) * h;
    const amp = 8 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 30;
    const a = 0.05 + (Math.sin(i * 4.13) * 0.5 + 0.5) * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x * 0.011 + i) * amp + Math.sin(x * 0.041 + i * 2.1) * (amp * 0.35);
      ctx.lineTo(x, yy);
    }
    ctx.lineWidth = 6 + (Math.cos(i * 2.7) * 0.5 + 0.5) * 24;
    ctx.strokeStyle = `rgba(${bandRGB},${a})`;
    ctx.stroke();
  }

  // soft swirl blobs (cloud/marble masses)
  for (let i = 0; i < 56; i++) {
    const x = (Math.abs(Math.sin(i * 91.7)) * w);
    const y = (Math.abs(Math.sin(i * 47.3)) * h);
    const r = 20 + (Math.abs(Math.sin(i * 12.3)) * 140);
    const a = 0.03 + Math.abs(Math.sin(i * 5.1)) * 0.07;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${bandRGB},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // crisp craters for the rocky world (dark pit + bright rim)
  if (fam === 'bone-rock') {
    for (let i = 0; i < 90; i++) {
      const x = Math.abs(Math.sin(i * 73.1) * 21731.7) % w;
      const y = Math.abs(Math.sin(i * 19.7) * 9133.3) % h;
      const r = 6 + (Math.abs(Math.sin(i * 3.7)) * 34);
      const pit = ctx.createRadialGradient(x, y, 0, x, y, r);
      pit.addColorStop(0, 'rgba(0,0,0,0.30)');
      pit.addColorStop(0.7, 'rgba(0,0,0,0.10)');
      pit.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pit;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
    }
  }

  // high-frequency detail octave — fine streaks for a detailed, non-soft read
  const speck = new THREE.Color(spec.speck);
  const speckRGB = `${(speck.r * 255) | 0},${(speck.g * 255) | 0},${(speck.b * 255) | 0}`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 220; i++) {
    const y = Math.abs(Math.sin(i * 53.7) * 7331.1) % h;
    const a = 0.02 + (Math.abs(Math.sin(i * 9.3)) % 1) * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.09 + i) * 2.4 + Math.sin(x * 0.31 + i * 1.7) * 1.1);
    }
    ctx.strokeStyle = `rgba(${speckRGB},${a})`;
    ctx.stroke();
  }

  // speckle highlights (crisp surface grain), denser for the larger canvas
  for (let i = 0; i < 4600; i++) {
    const x = Math.abs(Math.sin(i * 127.1) * 43758.5) % w;
    const y = Math.abs(Math.sin(i * 311.7) * 12543.1) % h;
    const a = 0.04 + (Math.abs(Math.sin(i * 7.7)) % 1) * 0.12;
    ctx.fillStyle = `rgba(${speckRGB},${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const surface = new THREE.CanvasTexture(c);
  surface.colorSpace = THREE.SRGBColorSpace;
  surface.anisotropy = 8;
  surface.wrapS = THREE.RepeatWrapping;

  // ember-forge: a dedicated emissive crack map so cracks glow on a dark base.
  let emissive: THREE.CanvasTexture | null = null;
  if (spec.emissiveMapStrength) {
    const ec = document.createElement('canvas');
    ec.width = w; ec.height = h;
    const ex = ec.getContext('2d')!;
    ex.fillStyle = '#000000';
    ex.fillRect(0, 0, w, h);
    const crack = new THREE.Color(spec.emissive);
    const crackRGB = `${(crack.r * 255) | 0},${(crack.g * 255) | 0},${(crack.b * 255) | 0}`;
    ex.lineCap = 'round';
    for (let i = 0; i < 38; i++) {
      let x = Math.abs(Math.sin(i * 61.3) * 5417.7) % w;
      let y = Math.abs(Math.sin(i * 23.9) * 8123.1) % h;
      const segs = 8 + ((Math.abs(Math.sin(i * 3.1)) * 10) | 0);
      ex.lineWidth = 1.6 + Math.abs(Math.sin(i * 1.9)) * 2.6;
      ex.strokeStyle = `rgba(${crackRGB},0.9)`;
      ex.shadowColor = `rgba(${crackRGB},0.9)`;
      ex.shadowBlur = 8;
      ex.beginPath();
      ex.moveTo(x, y);
      for (let s = 0; s < segs; s++) {
        x += Math.sin(i * 7.1 + s * 2.3) * 60;
        y += Math.cos(i * 4.3 + s * 1.7) * 36;
        ex.lineTo(x, y);
      }
      ex.stroke();
    }
    ex.shadowBlur = 0;
    emissive = new THREE.CanvasTexture(ec);
    emissive.colorSpace = THREE.SRGBColorSpace;
    emissive.anisotropy = 8;
    emissive.wrapS = THREE.RepeatWrapping;
  }

  const out: SurfaceTextures = { surface, emissive };
  _surfaceCache[fam] = out;
  return out;
}

// soft radial glow for the atmosphere halo (bloom-enhanced)
let _glow: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture | null {
  if (_glow) return _glow;
  if (typeof document === 'undefined') return null;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _glow = tex;
  return tex;
}

export default function HubPlanet({
  radius,
  hubId,
  isActive,
  dimFactor = 1,
  identity,
}: {
  radius: number;
  hubId: string;
  isActive: boolean;
  dimFactor?: number;
  /** Optional authored override; wins over the hubId-derived identity. */
  identity?: HubPlanetIdentity;
}) {
  // Prefer an authored identity (live-graph hub.identity) over the deterministic
  // hubId-derived one.
  const fam = useMemo(() => identity ?? planetFamily(hubId), [identity, hubId]);
  const spec = FAMILIES[fam];
  const tex = useMemo(() => buildSurface(fam), [fam]);
  const surf = tex?.surface ?? null;
  const emis = tex?.emissive ?? null;
  const glow = useMemo(() => glowTexture(), []);

  return (
    <group userData={{ hubPlanet: true, family: fam }}>
      {/* Photoreal PBR planet surface */}
      <mesh castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshPhysicalMaterial
          color={spec.base}
          map={surf ?? undefined}
          bumpMap={surf ?? undefined}
          bumpScale={spec.bumpScale}
          roughnessMap={surf ?? undefined}
          metalness={spec.metalness}
          roughness={spec.roughness}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          transmission={spec.transmission}
          thickness={spec.transmission > 0 ? radius * 0.6 : 0}
          ior={spec.ior}
          // ember cracks ride the emissive map; other identities use a flat tint
          emissive={new THREE.Color(spec.emissive)}
          emissiveMap={emis ?? undefined}
          emissiveIntensity={spec.emissiveIntensity * (isActive ? 1.5 : 1) * dimFactor}
          envMapIntensity={spec.envMapIntensity * dimFactor}
        />
      </mesh>

      {/* Atmosphere halo — billboard glow, additive (Bloom lifts it) */}
      {glow && (
        <sprite scale={[radius * 3.0, radius * 3.0, 1]}>
          <spriteMaterial
            map={glow}
            color={new THREE.Color(spec.halo)}
            transparent
            opacity={(isActive ? 0.5 : 0.32) * dimFactor}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}

      {/* Thin rim atmosphere shell (BackSide additive) — a lit limb / fresnel
          edge that crisps the silhouette against the void (PC sharpness). */}
      <mesh scale={1.045}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color={new THREE.Color(spec.halo)}
          transparent
          opacity={(isActive ? 0.18 : 0.11) * dimFactor}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ── NODE-EDITOR-V2 D3 — per-integration content icons on a dormant node ──────
// Small brand-tinted billboard marks above the node sphere: one per connected
// integration (its provider accent) + one per unique attached-function platform.
// These are the §3.3 "content icons" that show what a node HOLDS, surfaced in
// galaxy. Bloom lifts them so they read as little glowing badges.
export function NodeContentIcons({
  sourceNode,
  radius,
  dimFactor = 1,
}: {
  sourceNode: PrismNode | undefined;
  radius: number;
  dimFactor?: number;
}) {
  const items = useMemo(() => {
    const out: { key: string; color: string }[] = [];
    for (const ir of sourceNode?.integrationRefs ?? []) {
      out.push({ key: ir.id, color: getBrandAsset(ir.contentIcon?.brandKey ?? ir.platformId).accent });
    }
    const seen = new Set<string>();
    for (const ft of sourceNode?.functionTiles ?? []) {
      if (!seen.has(ft.brandKey)) { seen.add(ft.brandKey); out.push({ key: 'fn-' + ft.id, color: getBrandAsset(ft.brandKey).accent }); }
    }
    return out.slice(0, 6);
  }, [sourceNode]);

  const glow = useMemo(() => glowTexture(), []);
  if (!items.length || !glow) return null;

  return (
    <group position={[0, radius * 1.6, 0]}>
      {items.map((it, i) => {
        const x = (i - (items.length - 1) / 2) * 2.4;
        const col = new THREE.Color(it.color);
        return (
          <group key={it.key} position={[x, 0, 0]}>
            {/* glow halo (bloom-lifted) */}
            <sprite scale={[3.0, 3.0, 1]}>
              <spriteMaterial map={glow} color={col} transparent opacity={0.85 * dimFactor} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </sprite>
            {/* crisp solid core so the badge reads as a distinct content icon */}
            <mesh>
              <sphereGeometry args={[0.85, 16, 16]} />
              <meshBasicMaterial color={col} toneMapped={false} transparent opacity={0.98 * dimFactor} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
