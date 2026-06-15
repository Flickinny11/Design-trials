'use client';

// PRISM NODE-EDITOR V2 — photoreal hub PLANET (criteria D1). Each galaxy hub
// renders as a lit, glowing PBR planet in one of three premium families —
// brass / bone / ice — orbiting the <app>_world body. One renderer
// (three/webgpu); TSL-free standard materials (already used by HubHull); the
// scene Bloom enhances the emissive rim + atmosphere halo. Sized by the hub's
// content metric (D2). No purple; Observatory-Brass palette only.

import { useMemo } from 'react';
import * as THREE from 'three';
import { DS } from '@/components/editor/design-system';
import { getBrandAsset } from '@/lib/capabilities/brand-assets';
import type { PrismNode } from '@/lib/prism-graph/types';

export type PlanetFamily = 'brass' | 'bone' | 'ice';

// Deterministic family from a hub id (stable across reloads).
export function planetFamily(hubId: string): PlanetFamily {
  let h = 2166136261;
  for (let i = 0; i < hubId.length; i++) { h ^= hubId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (['brass', 'bone', 'ice'] as const)[(h >>> 0) % 3];
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
}

const FAMILIES: Record<PlanetFamily, FamilySpec> = {
  brass: { base: '#b98f4e', band: '#7e5c2a', speck: '#f1dca6', halo: DS.brass200, metalness: 1.0, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.28, transmission: 0, ior: 1.5, emissive: '#3a2a12', emissiveIntensity: 0.22, envMapIntensity: 1.5 },
  bone: { base: '#e3d8c0', band: '#c5b696', speck: '#f6efdd', halo: DS.textHi, metalness: 0.05, roughness: 0.54, clearcoat: 0.22, clearcoatRoughness: 0.45, transmission: 0, ior: 1.45, emissive: '#2b2820', emissiveIntensity: 0.1, envMapIntensity: 0.85 },
  ice: { base: '#bcd6e6', band: '#86adc4', speck: '#eef7fc', halo: DS.ice200, metalness: 0.0, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.06, transmission: 0.16, ior: 1.31, emissive: '#163040', emissiveIntensity: 0.16, envMapIntensity: 1.7 },
};

// ── procedural planet surface texture (banded + speckled, per family) ────────
const _surfaceCache: Partial<Record<PlanetFamily, THREE.CanvasTexture>> = {};
function surfaceTexture(fam: PlanetFamily): THREE.CanvasTexture | null {
  if (_surfaceCache[fam]) return _surfaceCache[fam]!;
  if (typeof document === 'undefined') return null;
  const spec = FAMILIES[fam];
  const w = 1024, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);
  // latitudinal bands (sine-warped) for a gas/marble surface
  const band = new THREE.Color(spec.band);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * h;
    const amp = 6 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 18;
    const a = 0.05 + (Math.sin(i * 4.13) * 0.5 + 0.5) * 0.16;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 8) {
      const yy = y + Math.sin(x * 0.012 + i) * amp;
      ctx.lineTo(x, yy);
    }
    ctx.lineWidth = 4 + (Math.cos(i * 2.7) * 0.5 + 0.5) * 14;
    ctx.strokeStyle = `rgba(${(band.r * 255) | 0},${(band.g * 255) | 0},${(band.b * 255) | 0},${a})`;
    ctx.stroke();
  }
  // soft swirl blobs
  for (let i = 0; i < 40; i++) {
    const x = (Math.abs(Math.sin(i * 91.7)) * w);
    const y = (Math.abs(Math.sin(i * 47.3)) * h);
    const r = 10 + (Math.abs(Math.sin(i * 12.3)) * 60);
    const a = 0.03 + Math.abs(Math.sin(i * 5.1)) * 0.06;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${(band.r * 255) | 0},${(band.g * 255) | 0},${(band.b * 255) | 0},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // speckle highlights (crisp surface grain)
  const sp = new THREE.Color(spec.speck);
  for (let i = 0; i < 1400; i++) {
    const x = Math.abs(Math.sin(i * 127.1) * 43758.5) % w;
    const y = Math.abs(Math.sin(i * 311.7) * 12543.1) % h;
    const a = 0.04 + (Math.abs(Math.sin(i * 7.7)) % 1) * 0.10;
    ctx.fillStyle = `rgba(${(sp.r * 255) | 0},${(sp.g * 255) | 0},${(sp.b * 255) | 0},${a})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  _surfaceCache[fam] = tex;
  return tex;
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
}: {
  radius: number;
  hubId: string;
  isActive: boolean;
  dimFactor?: number;
}) {
  const fam = useMemo(() => planetFamily(hubId), [hubId]);
  const spec = FAMILIES[fam];
  const surf = useMemo(() => surfaceTexture(fam), [fam]);
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
          bumpScale={fam === 'ice' ? 0.18 : 0.42}
          roughnessMap={surf ?? undefined}
          metalness={spec.metalness}
          roughness={spec.roughness}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          transmission={spec.transmission}
          thickness={spec.transmission > 0 ? radius * 0.6 : 0}
          ior={spec.ior}
          emissive={new THREE.Color(spec.emissive)}
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

      {/* Thin rim atmosphere shell (BackSide additive) for a lit limb */}
      <mesh scale={1.045}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial
          color={new THREE.Color(spec.halo)}
          transparent
          opacity={(isActive ? 0.16 : 0.1) * dimFactor}
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
